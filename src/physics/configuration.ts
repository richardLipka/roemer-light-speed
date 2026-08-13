/**
 * Where Earth and Jupiter stand relative to one another, and when that is
 * worth looking at.
 *
 * The light-time signal is *made of* this geometry: the delay is nothing but
 * the Earth–Jupiter distance divided by c. So the two moments that matter are
 * the closest approach and the widest separation — opposition and conjunction,
 * though the interface calls them "Jupiter at its nearest" and "at its
 * furthest", per CLAUDE.md §2.1.
 *
 * Both are found as extrema of the distance rather than as angles. That is the
 * quantity the measurement actually depends on, it needs no convention about
 * which elongation counts, and it is what a student is being shown.
 */

import type { BodyId } from '@orrery/core';
import { sub } from '@orrery/core';
import { length } from '@orrery/core/vec';

import { SECONDS_PER_DAY } from './constants.js';
import { lightTimeDays, type PositionsAt } from './lightTime.js';

/** Jupiter returns to the same arrangement with Earth every ~399 days. */
export const SYNODIC_PERIOD_DAYS = 398.88;

export type Extremum = 'nearest' | 'furthest';

export function earthJupiterAu(positionsAt: PositionsAt, jd: number): number {
  const positions = positionsAt(jd);
  const earth = positions.get('earth');
  const jupiter = positions.get('jupiter');
  if (!earth || !jupiter) throw new Error('engine supplied no Earth or Jupiter');
  return length(sub(jupiter, earth));
}

/**
 * The next date at which Earth and Jupiter are nearest, or furthest.
 *
 * Coarse sampling to bracket a turning point, then a ternary search — the
 * distance is smooth and single-peaked between consecutive extrema, which is
 * exactly the case ternary search is for, and it avoids differentiating a
 * quantity that comes out of an integrator.
 */
export function nextExtremum(
  positionsAt: PositionsAt,
  jdFrom: number,
  kind: Extremum,
): number {
  const step = 5;
  const better = (a: number, b: number) => (kind === 'nearest' ? a < b : a > b);

  let previous = earthJupiterAu(positionsAt, jdFrom);
  let current = earthJupiterAu(positionsAt, jdFrom + step);

  // Walk until the distance turns round. A synodic period plus a margin is
  // always enough, because nearest and furthest alternate every half of one.
  for (let jd = jdFrom + step; jd < jdFrom + SYNODIC_PERIOD_DAYS * 1.5; jd += step) {
    const next = earthJupiterAu(positionsAt, jd + step);
    if (better(current, previous) && better(current, next)) {
      return refineExtremum(positionsAt, jd - step, jd + step, kind);
    }
    previous = current;
    current = next;
  }

  throw new Error(`no ${kind} approach found within a synodic period of JD ${jdFrom}`);
}

function refineExtremum(
  positionsAt: PositionsAt,
  low: number,
  high: number,
  kind: Extremum,
): number {
  let a = low;
  let b = high;
  const better = (x: number, y: number) => (kind === 'nearest' ? x < y : x > y);

  // A minute is far finer than the extremum can be read off a plot, and the
  // distance is flat there anyway — that flatness is why bisection on a
  // derivative would be the fragile way to do this.
  while (b - a > 1 / 1440) {
    const third = (b - a) / 3;
    const left = a + third;
    const right = b - third;
    if (better(earthJupiterAu(positionsAt, left), earthJupiterAu(positionsAt, right))) b = right;
    else a = left;
  }

  return (a + b) / 2;
}

export interface DelaySample {
  jd: number;
  distanceAu: number;
  /** Light travel time, minutes — what the curve plots. */
  minutes: number;
}

/**
 * The delay across a span of dates: the curve the whole app is about.
 *
 * Sampled rather than solved, because it is drawn rather than measured. Five
 * days is finer than a plot a few hundred pixels wide can show, and keeps the
 * cost to a few hundred engine calls against a cached provider.
 */
export function delayCurve(
  positionsAt: PositionsAt,
  jdFrom: number,
  jdTo: number,
  stepDays = 5,
  perAuDays?: number,
): DelaySample[] {
  const samples: DelaySample[] = [];
  for (let jd = jdFrom; jd <= jdTo; jd += stepDays) {
    const distanceAu = earthJupiterAu(positionsAt, jd);
    samples.push({
      jd,
      distanceAu,
      minutes: (lightTimeDays(distanceAu, perAuDays) * SECONDS_PER_DAY) / 60,
    });
  }
  return samples;
}

/** Every nearest and furthest approach in a span, for marking on the curve. */
export function extremaBetween(
  positionsAt: PositionsAt,
  jdFrom: number,
  jdTo: number,
): { jd: number; kind: Extremum }[] {
  const marks: { jd: number; kind: Extremum }[] = [];

  for (const kind of ['nearest', 'furthest'] as const) {
    let jd = jdFrom;
    while (jd < jdTo) {
      let found: number;
      try {
        found = nextExtremum(positionsAt, jd, kind);
      } catch {
        break;
      }
      if (found > jdTo) break;
      marks.push({ jd: found, kind });
      jd = found + SYNODIC_PERIOD_DAYS * 0.5;
    }
  }

  return marks.sort((a, b) => a.jd - b.jd);
}

export const OBSERVER: BodyId = 'earth';
