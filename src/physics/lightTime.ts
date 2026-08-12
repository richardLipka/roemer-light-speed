/**
 * Light-time retardation — the one piece of physics `@orrery/core` does not
 * already contain, and the reason this repository exists.
 *
 * The orrery's positions are geometric: it applies no light-time correction,
 * because for reading a body's zodiac sign the effect is about 0.01° against a
 * 30° sign. Here the omitted effect *is* the subject.
 *
 * What an observer sees at time `t` is where the body was at `t − τ`, with τ the
 * light travel time over the distance the light actually crossed. That distance
 * depends on where the body was, which depends on τ, so it is solved by
 * iteration. Convergence is fast — the correction after the first pass is of
 * order (v/c)·τ, and Jupiter moves at about 5×10⁻⁵ c.
 *
 * **Not aberration.** The observer's own motion tilts the apparent *direction*
 * of a body by up to 20.5″, which is a different effect, discovered by a
 * different observation (Bradley, 1728), and deliberately excluded — see
 * CLAUDE.md §5.3. Nothing in this file touches direction.
 */

import type { BodyId, Vec3 } from '@orrery/core';
import type { PositionSet } from '@orrery/core/engines/types';
import { sub } from '@orrery/core';
import { length } from '@orrery/core/vec';

import { LIGHT_TIME_PER_AU_DAYS } from './constants.js';

/**
 * Whatever supplies positions for a date — in practice `nbodyEngine.positionsAt`,
 * wrapped in `cachedPositions` below.
 *
 * Taken as a parameter rather than imported so this module stays pure and the
 * tests can drive it with a known analytic orbit instead of an integrator.
 */
export type PositionsAt = (jd: number) => PositionSet;

/** Light travel time over a distance in AU, expressed in days. */
export const lightTimeDays = (distanceAu: number): number =>
  distanceAu * LIGHT_TIME_PER_AU_DAYS;

export interface Retarded {
  /** Where the body was when the light left it — what the observer sees. */
  seen: Vec3;
  /** Where the body actually is at the moment of observation. */
  actual: Vec3;
  /** The date the light left, JD. */
  jdEmitted: number;
  /** Light travel time, days. */
  lightTimeDays: number;
  /** The distance the light actually crossed, AU. */
  distanceAu: number;
  /** Iterations used, so a test can assert the loop is not merely capped out. */
  iterations: number;
}

/**
 * Where a body appears to be, to an observer at `jdObserve`.
 *
 * The observer is taken at the observation date and the target at the emission
 * date, which is the whole asymmetry: you are here now, the light left there
 * then.
 */
export function retardedPosition(
  positionsAt: PositionsAt,
  target: BodyId,
  observer: BodyId,
  jdObserve: number,
  toleranceDays = 1e-9,
): Retarded {
  const observerPosition = required(positionsAt(jdObserve), observer);

  let tau = 0;
  let jdEmitted = jdObserve;
  let seen = required(positionsAt(jdObserve), target);
  let distanceAu = length(sub(seen, observerPosition));
  let iterations = 0;

  // Three passes is ample at solar-system distances; the loop is capped at six
  // so a pathological input fails loudly in a test rather than hanging a frame.
  for (; iterations < 6; iterations++) {
    const next = lightTimeDays(distanceAu);
    const converged = Math.abs(next - tau) < toleranceDays;
    tau = next;
    jdEmitted = jdObserve - tau;
    seen = required(positionsAt(jdEmitted), target);
    distanceAu = length(sub(seen, observerPosition));
    if (converged) break;
  }

  return {
    seen,
    actual: required(positionsAt(jdObserve), target),
    jdEmitted,
    lightTimeDays: tau,
    distanceAu,
    iterations,
  };
}

/**
 * Just the delay, without the positions — the app's headline readout, and what
 * the eclipse solver needs to turn a true time into a seen time.
 */
export function lightTimeBetween(
  positionsAt: PositionsAt,
  target: BodyId,
  observer: BodyId,
  jdObserve: number,
): number {
  return retardedPosition(positionsAt, target, observer, jdObserve).lightTimeDays;
}

/**
 * Light time for an event that happened at a known instant, rather than for an
 * observation made at one.
 *
 * The eclipse case, and the direction of the arrow matters. An eclipse happens
 * at `jdTrue` and is *then* seen; the retardation above starts from the seeing
 * and works back. Here the emission date is known outright, so there is nothing
 * to iterate: the light crosses whatever gap separated the two bodies at the
 * moment it left, and the observer moves during the crossing.
 *
 * That last part is the only subtlety. Earth travels about 0.017 AU in the ~45
 * minutes the light is in transit, so its position at *arrival* is not its
 * position at emission, and a single pass would be wrong by roughly a second.
 * One correction pass settles it.
 */
export function seenAt(
  positionsAt: PositionsAt,
  target: BodyId,
  observer: BodyId,
  jdTrue: number,
): { jdSeen: number; lightTimeDays: number; distanceAu: number } {
  const emitted = required(positionsAt(jdTrue), target);

  let tau = 0;
  let distanceAu = 0;
  for (let i = 0; i < 4; i++) {
    const observerAtArrival = required(positionsAt(jdTrue + tau), observer);
    distanceAu = length(sub(observerAtArrival, emitted));
    const next = lightTimeDays(distanceAu);
    if (Math.abs(next - tau) < 1e-9) {
      tau = next;
      break;
    }
    tau = next;
  }

  return { jdSeen: jdTrue + tau, lightTimeDays: tau, distanceAu };
}

/**
 * Memoize a position provider by date.
 *
 * The n-body engine integrates from a checkpoint, so asking it for a date it has
 * just answered should not cost a second integration — and the retardation loop
 * above asks for nearly the same date three or four times running, while the
 * eclipse solver asks for the same bracket dozens of times.
 *
 * Dates are keyed at a resolution of about a tenth of a second, far finer than
 * anything the app resolves and coarse enough that the repeated asks actually
 * hit. The cache is bounded and simply cleared when full: a seek jumps to an
 * entirely new part of the timeline and the old entries have no value.
 */
export function cachedPositions(positionsAt: PositionsAt, limit = 4096): PositionsAt {
  const cache = new Map<number, PositionSet>();
  return (jd: number): PositionSet => {
    const key = Math.round(jd * 1e6);
    const hit = cache.get(key);
    if (hit) return hit;
    if (cache.size >= limit) cache.clear();
    const value = positionsAt(jd);
    cache.set(key, value);
    return value;
  };
}

/**
 * A position set is keyed by `BodyId` and every engine supplies every body, so a
 * miss is a programming error rather than a condition to handle. Failing here
 * beats a silent `undefined` propagating into the geometry as a NaN.
 */
function required(positions: PositionSet, id: BodyId): Vec3 {
  const position = positions.get(id);
  if (!position) throw new Error(`engine supplied no position for '${id}'`);
  return position;
}
