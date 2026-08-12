/**
 * Turning a log of eclipse timings into a speed of light — twice.
 *
 * There is a correct way to do this and an understandable way, and CLAUDE.md
 * §7.3 settles the order: the understandable one first, the correct one offered
 * afterwards as *"now let's use all your measurements instead of two"*.
 *
 * Both rest on the same quantity, and it is the one Rømer actually worked with:
 * **how late an eclipse was against the prediction.** He did not fit a straight
 * line to eclipse times; he had Cassini's tables, and he compared. So does this.
 *
 * That choice is not only historical. Numbering eclipses and multiplying by a
 * period — the obvious alternative, and this module's first design — leaves a
 * systematic behind. The shadow points away from the Sun and Jupiter's orbital
 * speed is not constant, so eclipses are not *quite* evenly spaced even with no
 * light-time at all: measured over 1676, the true times wander ±1.1 minutes
 * about a straight line. Small, except that the wander is smooth and partly
 * tracks the Earth–Jupiter distance, so it aliases into the answer at around
 * 10% and no quantity of extra observations reduces it. Comparing against a
 * prediction that already contains Jupiter's motion removes it exactly.
 *
 * The prediction is **not** the answer. It carries no light-time whatever —
 * that is precisely the thing left over — so the solver still has to find the
 * relationship with distance, and a bug in it would still show.
 */

import { AU_IN_KM } from '@orrery/core';

import { C_KM_PER_S, LIGHT_TIME_PER_AU_S, SECONDS_PER_DAY } from './constants.js';
import type { EclipsePhase } from './eclipses.js';

export interface Observation {
  /** The moment the student recorded, JD. Their reading, not the true time. */
  jdRecorded: number;
  /**
   * When the almanac says it should happen, JD — the model's own geometry with
   * light travel left out. Cassini's tables, in other words.
   */
  jdPredicted: number;
  phase: EclipsePhase;
  /** Earth–Jupiter distance for this event, AU, recorded alongside it. */
  distanceAu: number;
}

/**
 * How late the eclipse was, seconds — the number the whole measurement is made
 * of, and the one column in the log a student can read the pattern off directly.
 */
export const latenessSeconds = (observation: Observation): number =>
  (observation.jdRecorded - observation.jdPredicted) * SECONDS_PER_DAY;

// --- route 1: Rømer's own arithmetic --------------------------------------

export interface TwoEclipseSolution {
  near: Observation;
  far: Observation;
  /** How late the nearer eclipse was, seconds. */
  nearLatenessSeconds: number;
  /** How late the further one was, seconds. */
  farLatenessSeconds: number;
  /** The difference — how much longer the light took, seconds. */
  extraDelaySeconds: number;
  /** How much further it had to go, km. */
  extraDistanceKm: number;
  speedKmPerS: number;
  /** Signed, against the defined value. */
  percentError: number;
}

/**
 * Two eclipses, one near and one far, and one division.
 *
 * The far one is later against the almanac than the near one. The difference is
 * how much longer the light took; the extra ground it covered is the change in
 * the Earth–Jupiter distance. Divide.
 *
 *     speed = extra distance ÷ extra time
 *
 * No period, no counting, no straight line to fit — which makes this both the
 * version a sixteen-year-old can follow in one breath and the version with the
 * fewest places to go wrong. It is on screen when the words *you have just
 * measured the speed of light* appear.
 */
export function solveFromTwo(near: Observation, far: Observation): TwoEclipseSolution {
  const nearLatenessSeconds = latenessSeconds(near);
  const farLatenessSeconds = latenessSeconds(far);
  const extraDelaySeconds = farLatenessSeconds - nearLatenessSeconds;
  const extraDistanceKm = (far.distanceAu - near.distanceAu) * AU_IN_KM;

  const speedKmPerS = extraDistanceKm / extraDelaySeconds;
  return {
    near,
    far,
    nearLatenessSeconds,
    farLatenessSeconds,
    extraDelaySeconds,
    extraDistanceKm,
    speedKmPerS,
    percentError: (100 * (speedKmPerS - C_KM_PER_S)) / C_KM_PER_S,
  };
}

/**
 * The pair that makes the argument clearest: the largest change in distance.
 *
 * Which is, without having to explain it as such, one eclipse near opposition
 * and one near conjunction. Returned nearest first, so the story runs in the
 * direction the sentence does — *this one was on time, that one was late*.
 *
 * Phase does not matter here. Each eclipse is compared against its own
 * prediction, so a disappearance and a reappearance are directly comparable —
 * which they would not be if the two were being counted off a shared clock.
 */
export function widestPair(
  observations: readonly Observation[],
): [Observation, Observation] | null {
  if (observations.length < 2) return null;

  let near = observations[0]!;
  let far = observations[0]!;
  for (const observation of observations) {
    if (observation.distanceAu < near.distanceAu) near = observation;
    if (observation.distanceAu > far.distanceAu) far = observation;
  }

  return near === far ? null : [near, far];
}

// --- route 2: use all of it -----------------------------------------------

export interface FullSolution {
  /** Light travel time per AU, seconds — the quantity that carries c. */
  lightTimePerAuSeconds: number;
  speedKmPerS: number;
  /** One standard error, from the scatter of the student's own readings. */
  uncertaintyKmPerS: number;
  percentError: number;
  observationCount: number;
  /** Scatter left after the fit, seconds — how steady their hand was. */
  rmsResidualSeconds: number;
  /** The plot: how late each eclipse was against how far Jupiter was. */
  points: readonly { distanceAu: number; latenessSeconds: number }[];
  /** The line through them. Its steepness is the light travel time per AU. */
  line: { interceptSeconds: number; slopeSecondsPerAu: number };
}

/**
 * The same idea applied to every eclipse in the log rather than two of them.
 *
 * Plot lateness against distance; the points lie on a line; its steepness is
 * how long light takes to cross one AU. An ordinary least-squares fit, and the
 * gain over route 1 is simply that a hundred readings average their errors away
 * where two carry theirs straight into the answer.
 *
 * The intercept is fitted rather than forced to zero. In principle it should be
 * zero — an eclipse at zero distance would be seen instantly — but forcing it
 * would silently absorb any constant offset in the predictions into the slope,
 * and a constant offset is exactly what an imperfect almanac has.
 */
export function solveFromAll(observations: readonly Observation[]): FullSolution {
  if (observations.length < 3) throw new Error('need at least three eclipses');

  const points = observations.map((observation) => ({
    distanceAu: observation.distanceAu,
    latenessSeconds: latenessSeconds(observation),
  }));

  const meanDistance = mean(points.map((p) => p.distanceAu));
  const meanLateness = mean(points.map((p) => p.latenessSeconds));

  let covariance = 0;
  let variance = 0;
  for (const point of points) {
    const dx = point.distanceAu - meanDistance;
    covariance += dx * (point.latenessSeconds - meanLateness);
    variance += dx * dx;
  }

  if (variance === 0) {
    throw new Error('every eclipse was at the same distance — nothing to compare');
  }

  const slopeSecondsPerAu = covariance / variance;
  const interceptSeconds = meanLateness - slopeSecondsPerAu * meanDistance;

  let residualSumSquares = 0;
  for (const point of points) {
    const predicted = interceptSeconds + slopeSecondsPerAu * point.distanceAu;
    residualSumSquares += (point.latenessSeconds - predicted) ** 2;
  }

  const degreesOfFreedom = points.length - 2;
  const residualVariance = degreesOfFreedom > 0 ? residualSumSquares / degreesOfFreedom : 0;
  const slopeStandardError = Math.sqrt(residualVariance / variance);

  const speedKmPerS = AU_IN_KM / slopeSecondsPerAu;

  return {
    lightTimePerAuSeconds: slopeSecondsPerAu,
    speedKmPerS,
    // c = AU / slope, so a relative error in the slope is one in the speed.
    uncertaintyKmPerS: Math.abs(speedKmPerS * (slopeStandardError / slopeSecondsPerAu)),
    percentError: (100 * (speedKmPerS - C_KM_PER_S)) / C_KM_PER_S,
    observationCount: points.length,
    rmsResidualSeconds: Math.sqrt(residualVariance),
    points,
    line: { interceptSeconds, slopeSecondsPerAu },
  };
}

/** What the app knows the answer to be, for the "how did you do?" line. */
export const TRUE_SPEED_KM_PER_S = C_KM_PER_S;
export const TRUE_LIGHT_TIME_PER_AU_S = LIGHT_TIME_PER_AU_S;

const mean = (values: readonly number[]): number =>
  values.reduce((sum, v) => sum + v, 0) / values.length;
