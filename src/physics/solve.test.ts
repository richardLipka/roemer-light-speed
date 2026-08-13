import { afterEach, describe, expect, it } from 'vitest';
import { BODIES, jdFromCalendar } from '@orrery/core';
import { nbodyEngine } from '@orrery/core/engines/nbody';
import { vsop87Engine } from '@orrery/core/engines/vsop87';

import { earthJupiterAu } from './configuration.js';
import { LIGHT_TIME_PER_AU_S, SECONDS_PER_DAY } from './constants.js';
import { findEclipses } from './eclipses.js';
import { cachedPositions, type PositionsAt } from './lightTime.js';
import {
  buildTimetables,
  type Observation,
  setSlowTermOverride,
  solveFromAll,
  solveFromTwo,
  type TimingMode,
  widestPair,
} from './solve.js';

const JD_START = jdFromCalendar(1676, 1, 1);

/**
 * Two years — the shortest run the method is allowed to answer from.
 *
 * It was 400 days, and 400 days is now explicitly refused: over a single synodic
 * cycle the light-time curve and the drift in the eclipse interval cannot be
 * told apart. See `MINIMUM_CYCLES` in `solve.ts`.
 */
const SPAN_DAYS = 2 * 365.25;

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
 * A student's log: nothing but the moments they pressed.
 *
 * No true time and no prediction, because neither was ever available to anybody
 * — see the head of `solve.ts`. The timetable is fitted from these timings and
 * they are then compared against it.
 *
 * The scatter is not decoration. Io takes three and a half minutes to disappear
 * and a person judging the moment is worth about a minute of standard
 * deviation, so a log without it would give a suspiciously perfect answer and
 * prove nothing about whether the fit tolerates real readings (CLAUDE.md §7.4).
 */
function syntheticLog(
  positions: PositionsAt,
  options: {
    scatterSeconds?: number;
    seed?: number;
    phase?: 'disappearance';
    mode?: TimingMode;
    spanDays?: number;
  } = {},
): Observation[] {
  const { scatterSeconds = 60, seed = 20260811, mode = 'seen', spanDays = SPAN_DAYS } = options;
  const random = mulberry32(seed);

  return findEclipses(positions, 'io', JD_START, JD_START + spanDays)
    .filter((e) => !options.phase || e.phase === options.phase)
    .map((eclipse) => {
      // Box–Muller, so the error is normal rather than uniform.
      const u = Math.max(random(), 1e-12);
      const gaussian = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
      // Timing the event itself rather than its arrival is the control
      // experiment: identical readings, identical hand, no light travel.
      const watched = mode === 'seen' ? eclipse.jdSeen : eclipse.jdTrue;
      const jdRecorded = watched + (gaussian * scatterSeconds) / SECONDS_PER_DAY;
      return {
        jdRecorded,
        moon: 'io' as const,
        phase: eclipse.phase,
        // At the reading, from the orbital model — as `main.ts` records it, and
        // *not* `eclipse.distanceAu`, which is the distance the light actually
        // crossed and therefore a fact about the event rather than about the
        // observation.
        distanceAu: earthJupiterAu(positions, jdRecorded),
        mode,
      };
    });
}

const reference = cachedPositions((jd) => vsop87Engine.positionsAt(jd));

describe('the timetable, fitted from the student’s own timings', () => {
  const log = syntheticLog(reference, { scatterSeconds: 0 });

  it('recovers a period close to the moon’s own recurrence', () => {
    // Close, not equal. The fit is made through timings that carry the light
    // time, so it lands near the synodic 1.769861 d without being told it.
    const [table] = buildTimetables(log).timetables;
    expect(table!.periodDays).toBeCloseTo(1.769861, 3);
  });

  it('counts the eclipses correctly across gaps of many periods', () => {
    // Numbering is bookkeeping, not measurement — but it has to be right, or
    // every residual after the miscount is nonsense. Consecutive sequence
    // numbers must never go backwards or repeat within one kind of event.
    const rows = buildTimetables(log).rows.filter(
      (r) => r.observation.phase === 'disappearance',
    );
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.sequence).toBeGreaterThan(rows[i - 1]!.sequence);
    }
  });

  it('gives residuals that swing by the width of Earth’s orbit', () => {
    // The mean delay is absorbed by the fitted epoch and is gone for good; what
    // survives is the variation, which is the 16.6 minutes light takes to cross
    // the Earth's orbit. This is Rømer's "twenty-two minutes", and the reason he
    // reported a time rather than a delay.
    const minutes = buildTimetables(log).rows.map((r) => r.residualSeconds / 60);
    const swing = Math.max(...minutes) - Math.min(...minutes);
    expect(swing).toBeGreaterThan(13);
    expect(swing).toBeLessThan(22);
  });

  it('centres them on zero, which is a construction and not a result', () => {
    const minutes = buildTimetables(log).rows.map((r) => r.residualSeconds / 60);
    expect(Math.abs(minutes.reduce((a, b) => a + b, 0) / minutes.length)).toBeLessThan(0.1);
  });

  it('drops a kind of event it has only seen once', () => {
    // A lone reappearance would have the epoch fitted straight onto it, giving a
    // residual of exactly zero — a fabricated point at the origin, dragging the
    // slope toward nothing.
    const single = [
      ...log.filter((o) => o.phase === 'disappearance'),
      log.find((o) => o.phase === 'reappearance')!,
    ];
    const rows = buildTimetables(single).rows;
    expect(rows.every((r) => r.observation.phase === 'disappearance')).toBe(true);
  });
});

describe('route 2 — the whole log', () => {
  const log = syntheticLog(reference);

  it('recovers the speed of light to within about ten percent', () => {
    // THE assertion. Everything else in this repository exists to make it true,
    // and it is now made without any true eclipse time being consulted anywhere.
    //
    // Ten percent, not one. Dropping the model's own eclipse times cost an order
    // of magnitude of accuracy, and that is the honest price of the method
    // rather than a defect in it: what is left over is the drift in the eclipse
    // interval, which is exactly what made Cassini's tables imperfect and
    // exactly why Cassini did not believe the result. Rømer himself was 32% out.
    const solution = solveFromAll(log);
    expect(Math.abs(solution.percentError)).toBeLessThan(10);
    expect(solution.speedKmPerS).toBeGreaterThan(0);
  });

  it('holds that accuracy at every campaign length the app offers', () => {
    // Not "improves with length" — it does not, monotonically. The leftover
    // drift aliases against the 399-day cycle differently at each span. What
    // must be true is that a student who changes the setting never sees the
    // answer fall apart.
    for (const years of [2, 3, 6, 12]) {
      const solution = solveFromAll(syntheticLog(reference, { spanDays: years * 365.25 }));
      expect(Math.abs(solution.percentError), `${years} years`).toBeLessThan(10);
      expect(solution.slopeSigma, `${years} years`).toBeGreaterThan(20);
    }
  }, 180_000);

  it('recovers it even with Io’s epoch longitude deliberately wrong', () => {
    // CLAUDE.md §6, proved rather than argued. Core's `epochLongitude` for Io is
    // a round guess, so the app cannot say which date an eclipse falls on. The
    // error shifts every eclipse alike and cancels out of a comparison the
    // student makes against their own timings — so the measurement survives it.
    const orbit = BODIES.io.satellite!;
    const original = orbit.epochLongitude;
    try {
      orbit.epochLongitude = original + 137; // wrong by well over a third of an orbit
      const shifted = cachedPositions((jd) => vsop87Engine.positionsAt(jd));
      expect(Math.abs(solveFromAll(syntheticLog(shifted)).percentError)).toBeLessThan(10);
    } finally {
      orbit.epochLongitude = original;
    }
  });

  it('reports scatter consistent with the readings it was given', () => {
    const solution = solveFromAll(log);
    expect(solution.rmsResidualSeconds).toBeGreaterThan(30);
    expect(solution.rmsResidualSeconds).toBeLessThan(120);
  });

  it('does better on cleaner readings, as a measurement should', () => {
    const sloppy = solveFromAll(syntheticLog(reference, { scatterSeconds: 180 }));
    const careful = solveFromAll(syntheticLog(reference, { scatterSeconds: 10 }));
    expect(careful.uncertaintyKmPerS).toBeLessThan(sloppy.uncertaintyKmPerS);
  });

  it('works on a log of one kind of event only', () => {
    const oneKind = syntheticLog(reference, { phase: 'disappearance' });
    expect(oneKind.every((o) => o.phase === 'disappearance')).toBe(true);
    expect(Math.abs(solveFromAll(oneKind).percentError)).toBeLessThan(10);
  });
});

describe('nothing absolute reaches the answer', () => {
  /*
   * The audit these tests came out of. The method is supposed to rest on
   * *differences between observations* and nothing else, and that is a claim
   * strong enough to check rather than assert. Each of these perturbs something
   * an observer could not have known, and demands that the answer not move.
   */
  const log = syntheticLog(reference);

  it('is unmoved by shifting every recorded time by a constant', () => {
    // A calendar off by a week, a clock off by an hour, an epoch chosen
    // differently — none of it can matter, because only the intervals are used.
    // The distances travel with their rows, exactly as a column of an almanac
    // copied out by hand would.
    // Held to a relative tenth of a part per million. Not exact equality: a
    // Julian Date near 2 430 000 resolves about 40 microseconds in a double, so
    // shifting the log moves the readings themselves in the last bit. The fit is
    // done in days since the first reading precisely so that this is the *only*
    // thing left — before that change the same shift moved the answer eighty
    // times further, purely through cancellation.
    const shifted = log.map((o) => ({ ...o, jdRecorded: o.jdRecorded + 7.25 }));
    const before = solveFromAll(log).speedKmPerS;
    const after = solveFromAll(shifted).speedKmPerS;
    expect(Math.abs(after - before) / before).toBeLessThan(1e-7);
  });

  it('is unmoved by a counting aid that is three percent wrong', () => {
    // The one piece of model knowledge left in the analysis is the moon's rough
    // recurrence, used to round each gap to a whole number of eclipses. It is
    // bookkeeping an observatory does trivially, and this is the proof that it
    // is only bookkeeping: the period that reaches the answer is refitted from
    // the student's timings, so a hint wrong by fifty times the light-time
    // signal changes nothing.
    for (const scale of [0.97, 0.99, 1.01, 1.03]) {
      expect(solveFromAll(log, undefined, scale).speedKmPerS, `hint ×${scale}`).toBeCloseTo(
        solveFromAll(log).speedKmPerS,
        6,
      );
    }
  });

  it('never consults a true eclipse time, because a row cannot hold one', () => {
    // Structural rather than behavioural, and it is the assertion that keeps the
    // rest honest: an `Observation` carries a reading, a moon, a kind of event
    // and a distance. If a field for the true time ever comes back, this fails.
    expect(Object.keys(log[0]!).sort()).toEqual([
      'distanceAu',
      'jdRecorded',
      'mode',
      'moon',
      'phase',
    ]);
  });

  it('takes the distance at the reading, not at the event', () => {
    // The leak this audit found. `eclipse.distanceAu` is the distance the light
    // actually crossed, measured from the true emission — a fact about the
    // event. What an observer has is the distance at the moment they wrote the
    // time down. At the real speed of light the two differ by under a
    // thousandth of an AU, but the principle is what is being tested, and in the
    // game at twenty times slower it becomes 0.014 AU of imported answer.
    const eclipses = findEclipses(reference, 'io', JD_START, JD_START + 40);
    for (const eclipse of eclipses.slice(0, 5)) {
      const atReading = earthJupiterAu(reference, eclipse.jdSeen);
      expect(Math.abs(atReading - eclipse.distanceAu)).toBeGreaterThan(0);
      expect(Math.abs(atReading - eclipse.distanceAu)).toBeLessThan(0.002);
    }
  });
});

describe('why the timetable gets exactly one drift term or two', () => {
  /*
   * The boundary was measured, not reasoned, and both ways of crossing it are
   * dramatic enough to deserve a regression guard. See `slowTerms` in solve.ts.
   */
  const oneCycle = syntheticLog(reference, { spanDays: 402 });
  const nineYears = syntheticLog(reference, { spanDays: 9 * 365.25 });

  afterEach(() => setSlowTermOverride(null));

  it('erases the answer when a short run is given a second term', () => {
    // A quadratic over one synodic cycle can follow the light-time curve itself,
    // and the timetable absorbs the very thing being measured. Nothing in the
    // arithmetic complains; the number just comes out absurd.
    setSlowTermOverride(2);
    expect(Math.abs(solveFromAll(oneCycle).percentError)).toBeGreaterThan(100);
  });

  it('and swamps it when a long run is given only one', () => {
    // A constant interval cannot follow nine years of drift, and the leftover is
    // smooth, large, and partly in step with the Earth–Jupiter distance.
    setSlowTermOverride(1);
    expect(Math.abs(solveFromAll(nineYears).percentError)).toBeGreaterThan(50);
  }, 120_000);

  it('picks one term below the boundary and two above it', () => {
    const short = buildTimetables(oneCycle).timetables[0]!;
    const long = buildTimetables(nineYears).timetables[0]!;
    expect(short.slowTermCount).toBe(1);
    expect(long.slowTermCount).toBe(2);
  }, 120_000);
});

describe('a short run cannot work, and says so', () => {
  /*
   * The limitation that comes with doing it honestly. Over less than about one
   * and a half of Jupiter's cycles the Earth–Jupiter distance and the drift in
   * the eclipse interval trace curves no fit can tell apart. There is no
   * cleverness that avoids it — it is why Rømer needed years of Cassini's
   * accumulated observations, and an app that hid the requirement would be
   * teaching that he was merely slow.
   */
  const short = syntheticLog(reference, { spanDays: 150 });

  it('flags a run of a few months as too short', () => {
    expect(buildTimetables(short).tooShort).toBe(true);
  });

  it('flags a single synodic cycle as too short as well', () => {
    // The case that matters, because it looks long enough and is not: a
    // 402-day run is a whole apparition of Jupiter.
    expect(buildTimetables(syntheticLog(reference, { spanDays: 402 })).tooShort).toBe(true);
  });

  it('and passes the shortest length the app actually offers', () => {
    expect(buildTimetables(syntheticLog(reference, { spanDays: SPAN_DAYS })).tooShort).toBe(false);
  });

  it('loses most of the signal, which is the thing being warned about', () => {
    // Not "gets it slightly wrong". The fitted interval eats the drift, so what
    // is left is a fraction of the real slope.
    const solution = solveFromAll(short);
    expect(solution.lightTimePerAuSeconds).toBeLessThan(0.6 * LIGHT_TIME_PER_AU_S);
  });
});

describe('the control experiment — timing the events themselves', () => {
  /*
   * The run in which light is infinitely fast. Same eclipses, same hand, same
   * scatter; only the clock the reading is taken against changes. If any of
   * these assertions failed, the app's central claim — that the effect appears
   * *only* because the news has to travel — would be an assertion rather than
   * something a student can check.
   */
  const control = syntheticLog(reference, { mode: 'true', spanDays: 3 * 365.25 });
  const real = syntheticLog(reference, { mode: 'seen', spanDays: 3 * 365.25 });

  it('leaves nothing in the residuals but the observer’s own hand', () => {
    // Not zero, and it must not be asserted as zero: a minute of reading scatter
    // puts the odd three-sigma reading three minutes out. What has to vanish is
    // the *swing* — against 16.6 minutes when the light has to arrive.
    const minutes = buildTimetables(control).rows.map((r) => r.residualSeconds / 60);
    const swing = Math.max(...minutes) - Math.min(...minutes);
    expect(swing).toBeLessThan(8);
  }, 60_000);

  it('finds no dependence on Earth’s position at all', () => {
    // Not "a small slope" — a slope indistinguishable from zero against the
    // student's own scatter, which is what makes it a null result rather than a
    // poor measurement.
    expect(solveFromAll(control).slopeSigma).toBeLessThan(3);
  }, 60_000);

  it('spans the same distances as the real run, so it is a fair comparison', () => {
    // Not identical to the last decimal, and should not be: each row's distance
    // is taken at the moment it was *written down*, and the two runs write the
    // same eclipse down three quarters of an hour apart. Earth moves in that
    // time. A ten-thousandth of an AU against a swing of two and a quarter.
    const span = (log: Observation[]) =>
      Math.max(...log.map((o) => o.distanceAu)) - Math.min(...log.map((o) => o.distanceAu));
    expect(span(control)).toBeCloseTo(span(real), 3);
    expect(span(control)).toBeGreaterThan(1.5);
  });

  it('turns into a solid detection the moment the light has to travel', () => {
    expect(solveFromAll(real).slopeSigma).toBeGreaterThan(20);
  }, 60_000);
});

describe('route 1 — Rømer’s own arithmetic', () => {
  const rows = buildTimetables(syntheticLog(reference)).rows;

  it('lands in the same country as Rømer’s own answer', () => {
    // Measured: about 34% out, against Rømer's 32%. That is not a coincidence
    // worth hiding — it is what two readings can do. Each carries its full
    // timing error *and* whatever the drift in the interval was doing locally,
    // where two hundred readings average both away. Route 1 is kept because it
    // is the version a sixteen-year-old can follow in one breath (§7.3), and its
    // accuracy is now honestly that of the man who invented it.
    const [near, far] = widestPair(rows)!;
    expect(Math.abs(solveFromTwo(near, far).percentError)).toBeLessThan(45);
  });

  it('picks a pair separated by most of the Earth’s orbit', () => {
    const [near, far] = widestPair(rows)!;
    expect(far.observation.distanceAu - near.observation.distanceAu).toBeGreaterThan(1.5);
  });

  it('finds the far eclipse a quarter of an hour later than the near one', () => {
    // The 16.6 minutes, arrived at by subtracting one observation from another —
    // which is the entire lesson.
    const [near, far] = widestPair(rows)!;
    const solution = solveFromTwo(near, far);
    expect(solution.extraDelaySeconds / 60).toBeGreaterThan(13);
    expect(solution.extraDelaySeconds / 60).toBeLessThan(20);
  });

  it('cancels both epochs, so it compares two observations and nothing else', () => {
    // Adding an hour to the whole timetable must not move the answer by a
    // nanometre per second. If it ever does, a true time has crept back in.
    const [near, far] = widestPair(rows)!;
    const shifted = solveFromTwo(
      { ...near, residualSeconds: near.residualSeconds + 3600 },
      { ...far, residualSeconds: far.residualSeconds + 3600 },
    );
    expect(shifted.speedKmPerS).toBeCloseTo(solveFromTwo(near, far).speedKmPerS, 6);
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
    expect(Math.abs(fromNewton.percentError)).toBeLessThan(10);
  }, 120_000);
});

afterEach(() => {
  // The epoch-longitude test mutates the shared body table. If it ever leaked,
  // every later suite would be quietly measuring a different solar system.
  expect(BODIES.io.satellite!.epochLongitude).toBe(120);
});
