/**
 * When a Galilean moon enters and leaves Jupiter's shadow — and, separately,
 * when Earth finds out.
 *
 * **Two clocks, and keeping them apart is the whole app.** The eclipse happens
 * at `jdTrue`; it is seen at `jdSeen = jdTrue + τ`. Every field here says which
 * one it is, and no variable in this repository is called a bare `jd`.
 *
 * The solver is arranged around one cost. `satelliteOffsetAt` is analytic and
 * essentially free, while `positionsAt` on the n-body engine integrates. So the
 * moon is what gets varied inside the bisection, and the Sun and Jupiter are
 * sampled **twice per eclipse**: once at the bracket midpoint, and once more at
 * the root to refine it. Over the half-hour a bracket spans, the shadow axis
 * turns by under two thousandths of a degree, which at Io's orbital radius is
 * about 13 km — under a second of timing, and the refinement pass removes even
 * that. Do not put an engine call inside the bisection loop.
 */

import type { BodyId } from '@orrery/core';
import { BODIES, GM_SUN } from '@orrery/core';
import { satelliteOffsetAt } from '@orrery/core/satellites';

import { type PositionsAt, seenAt } from './lightTime.js';
import { type ShadowAxis, shadowAxis, shadowFunctionKm } from './shadow.js';

/**
 * Named for what an observer sees, not for the geometry.
 *
 * The literature says *immersion* and *emersion*; a sixteen-year-old does not,
 * and CLAUDE.md §2.1 rules both out of the interface. Using the plain words in
 * the code as well means nobody has to translate at the boundary, which is where
 * the mistake would be made.
 */
export type EclipsePhase = 'disappearance' | 'reappearance';

export interface Eclipse {
  moon: BodyId;
  phase: EclipsePhase;
  /** When it actually happened, JD. */
  jdTrue: number;
  /** When the light of it reaches Earth, JD. */
  jdSeen: number;
  /** Jupiter-to-Earth light travel time for this event, days. */
  lightTimeDays: number;
  /** The distance that light crossed, AU — the log's second column. */
  distanceAu: number;
  /**
   * How long the moon takes to cross the shadow edge, days.
   *
   * Io is 3 643 km across and moves at 17.3 km/s, so this is about three and a
   * half minutes — a fifth of the entire signal being measured, and the reason
   * Rømer needed a great many eclipses rather than two well-chosen ones.
   */
  ingressDurationDays: number;
}

/**
 * How often eclipses actually recur — **not** the moon's sidereal period.
 *
 * The shadow points away from the Sun, and that direction turns as Jupiter goes
 * round. A moon therefore has to travel slightly more than one revolution to
 * meet the shadow again, so the eclipses tick at the *synodic* period:
 *
 *     1/P_eclipse = 1/P_moon − 1/P_jupiter
 *
 * For Io that is 1.769861 days against a sidereal 1.769138 — **62 seconds
 * longer, every time**. On the scale this app works at that is not a detail:
 * over a year of eclipses the two differ by three and a half hours, which is
 * twelve times the whole light-time signal. Numbering a log with the sidereal
 * period would put a false drift straight into the fitted speed.
 *
 * Jupiter's own period comes from Kepler's third law rather than a table, which
 * is good to about 0.05% — ample, since this figure only has to number the
 * eclipses, never to date them.
 */
export function eclipsePeriodDays(moon: BodyId): number {
  const orbit = BODIES[moon].satellite;
  const parent = BODIES[moon].parent;
  if (!orbit || !parent) throw new Error(`'${moon}' is not a satellite`);

  const primary = BODIES[parent].orbit;
  if (!primary) return orbit.periodDays;

  const primaryPeriodDays = 2 * Math.PI * Math.sqrt(primary.epoch.a ** 3 / GM_SUN);
  return 1 / (1 / orbit.periodDays - 1 / primaryPeriodDays);
}

const TOLERANCE_DAYS = 1e-7; // ≈ 9 ms, far finer than anything observed here

/** Samples per orbit when hunting for sign changes. Io: one every 53 minutes. */
const SAMPLES_PER_ORBIT = 48;

/**
 * How stale the shadow axis is allowed to get during the *bracketing* pass.
 *
 * Bracketing only has to notice that a sign changed, and the shadow function
 * moves at about 1.5 million km a day while a quarter-day of Jupiter's motion
 * shifts it by some 75 km — five seconds' worth, against samples 53 minutes
 * apart. No crossing can hide in that. The root itself is then cut with a fresh
 * axis (`refine`), so the staleness never reaches the answer.
 *
 * Without this the search asks the engine 48 times an orbit, which the n-body
 * integrator would feel: a year of Io is 9 900 calls rather than 1 500.
 */
const AXIS_REFRESH_DAYS = 0.25;

/**
 * Every eclipse of one moon in a date range, in true-time order.
 *
 * `jdFrom` and `jdTo` are **true** times, not seen times. A caller working from
 * what an observer would have logged should widen the range by an hour at each
 * end and filter on `jdSeen`.
 */
export function findEclipses(
  positionsAt: PositionsAt,
  moon: BodyId,
  jdFrom: number,
  jdTo: number,
  perAuDays?: number,
): Eclipse[] {
  const orbit = BODIES[moon].satellite;
  if (!orbit) throw new Error(`'${moon}' is not a satellite`);

  const step = orbit.periodDays / SAMPLES_PER_ORBIT;
  const found: Eclipse[] = [];

  let axis = axisAt(positionsAt, moon, jdFrom);
  let axisJd = jdFrom;
  let previousJd = jdFrom;
  let previous = shadowFunctionKm(axis, offsetAt(previousJd, moon));

  for (let jd = jdFrom + step; jd <= jdTo; jd += step) {
    if (jd - axisJd >= AXIS_REFRESH_DAYS) {
      axis = axisAt(positionsAt, moon, jd);
      axisJd = jd;
    }
    const current = shadowFunctionKm(axis, offsetAt(jd, moon));

    if (previous > 0 !== current > 0) {
      const phase: EclipsePhase = previous > 0 ? 'disappearance' : 'reappearance';
      const jdTrue = refine(positionsAt, moon, previousJd, jd, axis);
      found.push(describe(positionsAt, moon, phase, jdTrue, perAuDays));
    }

    previousJd = jd;
    previous = current;
  }

  return found;
}

/**
 * The next eclipse at or after a date — what the "skip to the next one" control
 * needs, without computing a year of them.
 *
 * Searches an orbit at a time so that a moon with a 16-day period does not pay
 * Io's sampling density.
 *
 * **Not every revolution produces an eclipse**, and the outer moons are the
 * reason the search window is as wide as it is. A moon is eclipsed every orbit
 * only while its excursion out of Jupiter's orbital plane stays inside the
 * umbra, and that fails further out: measured over a year, Io and Europa are
 * eclipsed on every revolution, Ganymede on 48 of 51, and **Callisto on only 8
 * of 21** — its 72 601 km out-of-plane swing exceeds the 69 981 km umbra at its
 * distance, so it slips above or below the shadow for long stretches. That is
 * not a defect in the model; real Callisto has eclipse seasons for the same
 * reason. Callisto's widest measured gap is five orbits, so twenty is a genuine
 * margin rather than the "cannot happen" the first version assumed.
 */
export function nextEclipse(
  positionsAt: PositionsAt,
  moon: BodyId,
  jdFrom: number,
  phase?: EclipsePhase,
  perAuDays?: number,
): Eclipse {
  const orbit = BODIES[moon].satellite;
  if (!orbit) throw new Error(`'${moon}' is not a satellite`);

  for (let start = jdFrom; start < jdFrom + 20 * orbit.periodDays; start += orbit.periodDays) {
    for (const eclipse of findEclipses(
      positionsAt,
      moon,
      start,
      start + orbit.periodDays,
      perAuDays,
    )) {
      if (eclipse.jdTrue >= jdFrom && (!phase || eclipse.phase === phase)) return eclipse;
    }
  }

  throw new Error(`no eclipse of '${moon}' within twenty orbits of JD ${jdFrom}`);
}

/**
 * The eclipse an observer was watching when they pressed the key.
 *
 * Matched by default on **seen** time, because that is the only clock a real
 * observer has — they are timing the arrival of the news, not the event.
 * Returns null when nothing happened near enough to be what they meant, which
 * is what stops a stray key press from entering the log as an eclipse three
 * hours late.
 *
 * `matchOn: 'true'` matches the event itself instead. No observer can do that,
 * which is exactly the point: it is the app's control experiment, the run in
 * which light is infinitely fast. See `TimingMode` in `solve.ts`.
 *
 * The first version of the recorder asked `nextEclipse` for the next event at
 * or after *two periods ago*, which is an eclipse three and a half days in the
 * past. Every logged observation came out about 2 800 minutes late and the
 * whole measurement was nonsense.
 */
export interface NearestEclipseOptions {
  toleranceDays?: number;
  phase?: EclipsePhase;
  matchOn?: 'seen' | 'true';
  /** Light time per AU, days — the game's universe runs slower. */
  perAuDays?: number;
}

export function nearestEclipse(
  positionsAt: PositionsAt,
  moon: BodyId,
  jdPressed: number,
  options: NearestEclipseOptions = {},
): Eclipse | null {
  const { toleranceDays = 30 / 1440, phase, matchOn = 'seen', perAuDays } = options;

  const orbit = BODIES[moon].satellite;
  if (!orbit) throw new Error(`'${moon}' is not a satellite`);

  // Two periods either side, and the margin is for the game rather than for
  // history. Matching on seen times has to reach back past the light time to the
  // event behind it: 52 minutes at the real speed, but up to seventeen hours
  // when light runs twenty times slower, which is a serious fraction of Io's
  // 1.77-day period.
  const window = orbit.periodDays * 2;
  const candidates = findEclipses(
    positionsAt,
    moon,
    jdPressed - window,
    jdPressed + window,
    perAuDays,
  ).filter((eclipse) => !phase || eclipse.phase === phase);

  let best: Eclipse | null = null;
  let bestGap = Infinity;
  for (const eclipse of candidates) {
    const gap = Math.abs((matchOn === 'seen' ? eclipse.jdSeen : eclipse.jdTrue) - jdPressed);
    if (gap < bestGap) {
      bestGap = gap;
      best = eclipse;
    }
  }

  return best && bestGap <= toleranceDays ? best : null;
}

/**
 * Bisect to the crossing, then re-cut once with the axis taken at the answer.
 *
 * The first pass holds the shadow axis fixed, which is what keeps the engine out
 * of the loop. The second pass costs one more engine call and removes the ~13 km
 * of axis rotation the first pass ignored.
 */
function refine(
  positionsAt: PositionsAt,
  moon: BodyId,
  low: number,
  high: number,
  axis: ShadowAxis,
): number {
  const first = bisect(moon, low, high, axis);
  const refinedAxis = axisAt(positionsAt, moon, first);
  const window = (high - low) / 64;
  return bisect(moon, first - window, first + window, refinedAxis);
}

function bisect(moon: BodyId, low: number, high: number, axis: ShadowAxis): number {
  let a = low;
  let b = high;
  const fa = shadowFunctionKm(axis, offsetAt(a, moon));

  // The refinement window is opened around a root, so it is bracketed by
  // construction unless the axis moved further than the window — which would be
  // a bug in the reasoning above rather than a case to recover from.
  const fb = shadowFunctionKm(axis, offsetAt(b, moon));
  if (fa > 0 === fb > 0) return (a + b) / 2;

  const negativeAtLow = fa < 0;
  while (b - a > TOLERANCE_DAYS) {
    const mid = (a + b) / 2;
    const f = shadowFunctionKm(axis, offsetAt(mid, moon));
    if (f < 0 === negativeAtLow) a = mid;
    else b = mid;
  }
  return (a + b) / 2;
}

function describe(
  positionsAt: PositionsAt,
  moon: BodyId,
  phase: EclipsePhase,
  jdTrue: number,
  perAuDays?: number,
): Eclipse {
  const light = seenAt(positionsAt, 'jupiter', 'earth', jdTrue, perAuDays);
  return {
    moon,
    phase,
    jdTrue,
    jdSeen: light.jdSeen,
    lightTimeDays: light.lightTimeDays,
    distanceAu: light.distanceAu,
    ingressDurationDays: ingressDurationDays(positionsAt, moon, jdTrue),
  };
}

/**
 * How long the moon's own disc takes to cross the shadow edge.
 *
 * The shadow function measures the *centre*, so the edge sweeps the moon's full
 * diameter in the time the function changes by that diameter. A central
 * difference over a minute gives the rate; the edge itself is far softer than
 * this in principle, but the penumbra is ten times narrower than the moon and is
 * deliberately not modelled (`constants.ts`).
 */
function ingressDurationDays(
  positionsAt: PositionsAt,
  moon: BodyId,
  jdTrue: number,
): number {
  const axis = axisAt(positionsAt, moon, jdTrue);
  const h = 1 / 1440; // one minute
  const before = shadowFunctionKm(axis, offsetAt(jdTrue - h, moon));
  const after = shadowFunctionKm(axis, offsetAt(jdTrue + h, moon));
  const ratePerDay = Math.abs(after - before) / (2 * h);
  return (2 * BODIES[moon].radius) / ratePerDay;
}

function axisAt(positionsAt: PositionsAt, moon: BodyId, jd: number): ShadowAxis {
  const parent = BODIES[moon].parent;
  if (!parent) throw new Error(`'${moon}' has no primary`);

  const positions = positionsAt(jd);
  const sun = positions.get('sun');
  const primary = positions.get(parent);
  if (!sun || !primary) throw new Error(`engine supplied no position for the shadow axis`);

  return shadowAxis(sun, primary);
}

function offsetAt(jd: number, moon: BodyId) {
  const offset = satelliteOffsetAt(jd, moon);
  if (!offset) throw new Error(`'${moon}' has no satellite orbit`);
  return offset;
}
