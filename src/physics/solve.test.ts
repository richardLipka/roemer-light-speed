import { afterEach, describe, expect, it } from 'vitest';
import { BODIES, jdFromCalendar } from '@orrery/core';
import { nbodyEngine } from '@orrery/core/engines/nbody';
import { vsop87Engine } from '@orrery/core/engines/vsop87';

import { C_KM_PER_S, LIGHT_TIME_PER_AU_S, SECONDS_PER_DAY } from './constants.js';
import { findEclipses } from './eclipses.js';
import { cachedPositions, type PositionsAt } from './lightTime.js';
import {
  latenessSeconds,
  type Observation,
  solveFromAll,
  solveFromTwo,
  widestPair,
} from './solve.js';

const JD_START = jdFromCalendar(1676, 1, 1);
const SPAN_DAYS = 400; // a little over one synodic period of Jupiter

/** Deterministic noise, so a failure means a regression and not a bad night. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A student's log: what the almanac said, and when they actually pressed.
 *
 * The scatter is not decoration. Io takes three and a half minutes to disappear
 * and a person judging the moment is worth about a minute of standard
 * deviation, so a log without it would give a suspiciously perfect answer and
 * prove nothing about whether the fit tolerates real readings (CLAUDE.md §7.4).
 */
function syntheticLog(
  positions: PositionsAt,
  options: { scatterSeconds?: number; seed?: number; phase?: 'disappearance' } = {},
): Observation[] {
  const { scatterSeconds = 60, seed = 20260811 } = options;
  const random = mulberry32(seed);

  return findEclipses(positions, 'io', JD_START, JD_START + SPAN_DAYS)
    .filter((e) => !options.phase || e.phase === options.phase)
    .map((eclipse) => {
      // Box–Muller, so the error is normal rather than uniform.
      const u = Math.max(random(), 1e-12);
      const gaussian = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
      return {
        jdRecorded: eclipse.jdSeen + (gaussian * scatterSeconds) / SECONDS_PER_DAY,
        jdPredicted: eclipse.jdTrue,
        phase: eclipse.phase,
        distanceAu: eclipse.distanceAu,
      };
    });
}

const reference = cachedPositions((jd) => vsop87Engine.positionsAt(jd));

describe('lateness — the quantity everything is made of', () => {
  it('is the light travel time, and nothing else', () => {
    const log = syntheticLog(reference, { scatterSeconds: 0 });
    for (const observation of log.slice(0, 20)) {
      // Not to more places than a Julian Date can carry: near JD 2.4 million a
      // double resolves about 40 microseconds, so differencing two of them
      // costs the last few digits of a quantity as small as three quarters of
      // an hour. Irrelevant at the scale of the measurement, worth knowing.
      expect(latenessSeconds(observation)).toBeCloseTo(
        observation.distanceAu * LIGHT_TIME_PER_AU_S,
        4,
      );
    }
  });

  it('runs from about 35 to about 52 minutes across the log', () => {
    // Scatter-free: with a minute of reading error on 452 observations the
    // extremes wander a couple of minutes further out, which is a fact about
    // the student's hand rather than about the light.
    const minutes = syntheticLog(reference, { scatterSeconds: 0 }).map(
      (o) => latenessSeconds(o) / 60,
    );
    expect(Math.min(...minutes)).toBeGreaterThan(33);
    expect(Math.max(...minutes)).toBeLessThan(54);
  });
});

describe('route 2 — the whole log', () => {
  const log = syntheticLog(reference);

  it('recovers the speed of light to within a few percent', () => {
    // THE assertion. Everything else in this repository exists to make it true.
    const solution = solveFromAll(log);
    expect(Math.abs(solution.percentError)).toBeLessThan(3);
    expect(solution.speedKmPerS).toBeGreaterThan(0);
  });

  it('recovers it even with Io’s epoch longitude deliberately wrong', () => {
    // CLAUDE.md §6, proved rather than argued. Core's `epochLongitude` for Io is
    // a round guess, so the app cannot say which date an eclipse falls on. The
    // error shifts every eclipse alike and cancels out of the comparison the
    // student actually makes — so the measurement survives it, and this says so.
    const orbit = BODIES.io.satellite!;
    const original = orbit.epochLongitude;
    try {
      orbit.epochLongitude = original + 137; // wrong by well over a third of an orbit
      const shifted = cachedPositions((jd) => vsop87Engine.positionsAt(jd));
      expect(Math.abs(solveFromAll(syntheticLog(shifted)).percentError)).toBeLessThan(3);
    } finally {
      orbit.epochLongitude = original;
    }
  });

  it('recovers the light travel time per AU directly', () => {
    // Held against careful readings rather than ordinary ones. With a minute of
    // scatter the slope's own standard error is about 4 s/AU, so demanding
    // better than that from a sloppy log would be asserting luck.
    const careful = solveFromAll(syntheticLog(reference, { scatterSeconds: 10 }));
    expect(careful.lightTimePerAuSeconds).toBeCloseTo(LIGHT_TIME_PER_AU_S, -0.5);
    expect(Math.abs(careful.lightTimePerAuSeconds - LIGHT_TIME_PER_AU_S)).toBeLessThan(
      3 * (careful.uncertaintyKmPerS / careful.speedKmPerS) * LIGHT_TIME_PER_AU_S,
    );
  });

  it('puts the fitted line through the origin, as the physics demands', () => {
    // An eclipse at zero distance would be seen the instant it happened. The
    // intercept is fitted rather than forced, so its coming out near zero is a
    // result rather than an assumption — and it is the check that the slope has
    // not quietly absorbed an offset.
    const solution = solveFromAll(log);
    expect(Math.abs(solution.line.interceptSeconds)).toBeLessThan(60);
  });

  it('reports scatter consistent with the readings it was given', () => {
    const solution = solveFromAll(log);
    expect(solution.rmsResidualSeconds).toBeGreaterThan(30);
    expect(solution.rmsResidualSeconds).toBeLessThan(100);
  });

  it('quotes an uncertainty that actually covers the true value', () => {
    const solution = solveFromAll(log);
    const missKmPerS = Math.abs(solution.speedKmPerS - C_KM_PER_S);
    expect(solution.uncertaintyKmPerS).toBeGreaterThan(0);
    expect(missKmPerS).toBeLessThan(3 * solution.uncertaintyKmPerS);
  });

  it('does better on cleaner readings, as a measurement should', () => {
    const sloppy = solveFromAll(syntheticLog(reference, { scatterSeconds: 180 }));
    const careful = solveFromAll(syntheticLog(reference, { scatterSeconds: 10 }));
    expect(careful.uncertaintyKmPerS).toBeLessThan(sloppy.uncertaintyKmPerS);
    expect(Math.abs(careful.percentError)).toBeLessThan(1);
  });

  it('works on a log of one kind of event only', () => {
    const oneKind = syntheticLog(reference, { phase: 'disappearance' });
    expect(oneKind.every((o) => o.phase === 'disappearance')).toBe(true);
    expect(Math.abs(solveFromAll(oneKind).percentError)).toBeLessThan(3);
  });
});

describe('route 1 — Rømer’s own arithmetic', () => {
  const log = syntheticLog(reference);

  it('gets within about ten percent from just two eclipses', () => {
    // Worse than route 2, and that is the honest result rather than a defect:
    // two readings carry their full timing error into the answer, where two
    // hundred average it away. If this ever beat the fit, something would be
    // wrong with the fit.
    const [near, far] = widestPair(log)!;
    expect(Math.abs(solveFromTwo(near, far).percentError)).toBeLessThan(12);
  });

  it('picks a pair separated by most of the Earth’s orbit', () => {
    const [near, far] = widestPair(log)!;
    expect(far.distanceAu - near.distanceAu).toBeGreaterThan(1.5); // of the 2 AU
  });

  it('finds the far eclipse a quarter of an hour later than the near one', () => {
    // The 16.6 minutes, arrived at by subtraction — which is the entire lesson.
    const [near, far] = widestPair(log)!;
    const solution = solveFromTwo(near, far);
    expect(solution.extraDelaySeconds / 60).toBeGreaterThan(14);
    expect(solution.extraDelaySeconds / 60).toBeLessThan(19);
  });

  it('needs no period, no counting and no straight line', () => {
    // Guards the simplification: route 1 takes two observations and nothing
    // else. If a period ever creeps back into its signature, the version that
    // fits on one screen has been lost.
    expect(solveFromTwo.length).toBe(2);
  });
});

describe('Newton against the reference', () => {
  const newton = cachedPositions((jd) => nbodyEngine.positionsAt(jd));

  it('gives the same speed of light, within the measurement’s own scatter', () => {
    // CLAUDE.md §12: if these disagreed, the choice of the n-body engine as the
    // one on show would need revisiting rather than defending.
    const fromNewton = solveFromAll(syntheticLog(newton));
    const fromReference = solveFromAll(syntheticLog(reference));
    const gap = Math.abs(fromNewton.speedKmPerS - fromReference.speedKmPerS);
    expect(gap).toBeLessThan(3 * fromReference.uncertaintyKmPerS);
    expect(Math.abs(fromNewton.percentError)).toBeLessThan(3);
  }, 120_000);
});

afterEach(() => {
  // The epoch-longitude test mutates the shared body table. If it ever leaked,
  // every later suite would be quietly measuring a different solar system.
  expect(BODIES.io.satellite!.epochLongitude).toBe(120);
});
