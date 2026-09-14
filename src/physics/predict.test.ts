/**
 * The prediction has to be a real bet, and these are the terms of it.
 *
 * Two things must hold or the panel is theatre. The light-corrected time has to
 * win against a genuine future eclipse the table never saw — and it has to win
 * by enough that a student who times the fade to a minute can tell which
 * prediction they landed on.
 */

import { describe, expect, it } from 'vitest';
import { jdFromCalendar } from '@orrery/core';
import { vsop87Engine } from '@orrery/core/engines/vsop87';

import { earthJupiterAu } from './configuration.js';
import { SECONDS_PER_DAY } from './constants.js';
import { nearestEclipse, nextEclipse } from './eclipses.js';
import { cachedPositions } from './lightTime.js';
import { MAX_REACH_DAYS, predictNextEclipse, scorePrediction } from './predict.js';
import type { Observation } from './solve.js';

const positions = cachedPositions((jd) => vsop87Engine.positionsAt(jd));
const OPENING_JD = jdFromCalendar(1676, 1, 1);
const DAYS_PER_YEAR = 365.25;

function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The app's own ready-made log, rebuilt here so the test drives what ships. */
function sampleLog(years: number, slipSeconds = 150): Observation[] {
  const random = seededRandom(1676);
  const observations: Observation[] = [];
  const count = Math.round(20 * years);
  const spacing = (years * DAYS_PER_YEAR) / count;
  const end = OPENING_JD + years * DAYS_PER_YEAR;
  let cursor = OPENING_JD;

  for (let i = 0; i < count; i++) {
    const from = Math.max(cursor, OPENING_JD + i * spacing);
    if (from >= end) break;
    const eclipse = nextEclipse(positions, 'io', from, 'disappearance');
    if (eclipse.jdTrue >= end) break;
    cursor = eclipse.jdTrue + 1 / 1440;
    const jdRecorded = eclipse.jdSeen + ((random() - 0.5) * slipSeconds) / SECONDS_PER_DAY;
    observations.push({
      jdRecorded,
      moon: 'io',
      phase: eclipse.phase,
      distanceAu: earthJupiterAu(positions, jdRecorded),
      mode: 'seen',
    });
  }
  return observations;
}

/**
 * What the sky actually does, which is the thing being bet against.
 *
 * Matched on *seen* time to the eclipse the prediction is about. Searching
 * forward from an offset instead lands on the neighbouring eclipse whenever the
 * offset exceeds the gap, and the first version of this helper did exactly that
 * — it reported the prediction wrong by 1.77 days, which is one Io period and
 * therefore obviously the helper rather than the physics.
 */
function truthFor(prediction: { steadyJd: number; correctedJd: number }): number {
  const middle = (prediction.steadyJd + prediction.correctedJd) / 2;
  const eclipse = nearestEclipse(positions, 'io', middle, {
    phase: 'disappearance',
    matchOn: 'seen',
    toleranceDays: 1 / 24,
  });
  if (!eclipse) throw new Error('no eclipse near the predicted time');
  return eclipse.jdSeen;
}

describe('the prediction', () => {
  const log = sampleLog(3);
  const prediction = predictNextEclipse({ positionsAt: positions, observations: log, moon: 'io' });

  it('is offered at all from a three-year run', () => {
    expect(prediction).not.toBeNull();
  });

  it('reaches past the end of the log, but not far past', () => {
    expect(prediction!.reachDays).toBeGreaterThan(0);
    expect(prediction!.reachDays).toBeLessThanOrEqual(MAX_REACH_DAYS);
    const lastSeen = Math.max(...log.map((o) => o.jdRecorded));
    // The eclipse being predicted is one nobody in this log has watched.
    expect(prediction!.steadyJd).toBeGreaterThan(lastSeen);
  });

  it('separates the two predictions by more than a student can time', () => {
    // The fade itself takes three and a half minutes, so anything under a couple
    // of minutes is a bet nobody can settle.
    expect(prediction!.gapSeconds).toBeGreaterThan(120);
  });

  it('is won by the light-corrected time, against the sky', () => {
    const actual = truthFor(prediction!);
    const outcome = scorePrediction(prediction!, actual);
    expect(outcome.lightWon).toBe(true);
    // And not by a hair: the steady table should miss by most of the gap.
    expect(Math.abs(outcome.fromSteadySeconds)).toBeGreaterThan(
      Math.abs(outcome.fromCorrectedSeconds) * 3,
    );
  });

  it('lands the corrected time inside the student’s own scatter', () => {
    const actual = truthFor(prediction!);
    const outcome = scorePrediction(prediction!, actual);
    // A ready-made log carries ±75 s of deliberate slip; the prediction should
    // be wrong by no more than a few times that, or it is not a measurement.
    expect(Math.abs(outcome.fromCorrectedSeconds)).toBeLessThan(300);
  });

  it('holds at every campaign length the interface offers', () => {
    for (const years of [2, 3, 6, 12]) {
      const run = sampleLog(years);
      const p = predictNextEclipse({ positionsAt: positions, observations: run, moon: 'io' });
      if (!p) continue; // a short run may legitimately refuse; that is tested below
      const outcome = scorePrediction(p, truthFor(p));
      expect(outcome.lightWon, `${years} years`).toBe(true);
    }
  }, 120_000);
});

describe('the prediction refuses what it cannot support', () => {
  it('says nothing from a log too short to have measured anything', () => {
    // Under one and a half synodic cycles the fit cannot separate light time
    // from the drift in the interval, so there is no figure to bet with.
    const short = sampleLog(1);
    expect(
      predictNextEclipse({ positionsAt: positions, observations: short, moon: 'io' }),
    ).toBeNull();
  });

  it('says nothing from an empty or thin log', () => {
    for (const observations of [[], sampleLog(3).slice(0, 2)]) {
      expect(
        predictNextEclipse({ positionsAt: positions, observations, moon: 'io' }),
      ).toBeNull();
    }
  });

  it('says nothing when the readings carry no signal', () => {
    // The control experiment: timed against the event itself, the slope is zero
    // and there is nothing to extrapolate. Betting on noise is the one thing
    // this panel must never invite.
    const random = seededRandom(99);
    const trueTimed: Observation[] = [];
    const years = 3;
    const count = Math.round(20 * years);
    const spacing = (years * DAYS_PER_YEAR) / count;
    let cursor = OPENING_JD;

    for (let i = 0; i < count; i++) {
      const from = Math.max(cursor, OPENING_JD + i * spacing);
      const eclipse = nextEclipse(positions, 'io', from, 'disappearance');
      cursor = eclipse.jdTrue + 1 / 1440;
      // The event itself, not the news of it — the one clock no observer has.
      const jdRecorded = eclipse.jdTrue + ((random() - 0.5) * 150) / SECONDS_PER_DAY;
      trueTimed.push({
        jdRecorded,
        moon: 'io',
        phase: eclipse.phase,
        distanceAu: earthJupiterAu(positions, jdRecorded),
        mode: 'true',
      });
    }

    expect(
      predictNextEclipse({ positionsAt: positions, observations: trueTimed, moon: 'io' }),
    ).toBeNull();
  }, 60_000);
});

describe('scoring', () => {
  it('names the nearer prediction the winner', () => {
    const base = {
      moon: 'io' as const,
      phase: 'disappearance' as const,
      sequence: 100,
      steadyJd: 2_400_000,
      correctedJd: 2_400_000 + 600 / SECONDS_PER_DAY,
      gapSeconds: 600,
      distanceAu: 6,
      tableDistanceAu: 5,
      lightTimePerAuSeconds: 499,
      reachDays: 200,
      baselineCount: 60,
    };
    expect(scorePrediction(base, base.correctedJd).lightWon).toBe(true);
    expect(scorePrediction(base, base.steadyJd).lightWon).toBe(false);
  });
});
