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
import { AU_IN_KM, BODIES, GM_SUN } from '@orrery/core';
import { satelliteOffsetAt } from '@orrery/core/satellites';

import { JUPITER_SHADOW_RADIUS_KM, umbraLengthKm } from './constants.js';
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

/**
 * How finely the shadow function is sampled when hunting for sign changes —
 * **scaled to the eclipse, not to the orbit.**
 *
 * This was `orbit.periodDays / 48`, and for the outer two moons that is a step
 * longer than the eclipse it is looking for. Measured against a brute-force
 * scan, it stepped clean over **14 of Callisto's 22 eclipses in 1676** and 3 of
 * Ganymede's 51 — and the misses were then written up, here and in
 * `eclipseSeasons.test.ts` and CLAUDE.md §2.1a, as though they were the moons
 * clearing the shadow. They were not. Both moons are eclipsed on *every*
 * revolution in those years; the sampler simply never looked.
 *
 * What sets the scale is how long the moon spends inside the umbra, which has
 * nothing to do with its period: the umbra is a fixed ~140 000 km wide and the
 * outer moons crawl across it. Io takes 137 minutes to cross and is sampled
 * every 53; Callisto takes 284 and was sampled every 501.
 *
 * So the step is one sixteenth of a central crossing. That leaves margin for
 * the grazing passes at the edges of a real eclipse season, which are far
 * shorter than a central one — Callisto's shortest in sixteen years is 40
 * minutes against an 18-minute step. Nothing catches a grazing eclipse of
 * arbitrarily short duration, and nothing can; the point is that the step is
 * now set by the thing being looked for.
 *
 * The cost is paid in `satelliteOffsetAt`, which is analytic and cheap. The
 * engine is untouched: `AXIS_REFRESH_DAYS` below bounds those calls by elapsed
 * time, not by sample count.
 */
const SAMPLES_PER_CROSSING = 16;

/**
 * Sampling step for one moon, days — a sixteenth of the time it takes to cross
 * the umbra, and never coarser than the old period-based rule.
 *
 * The umbra is sized at a representative 5.2 AU. Its width varies by about 1%
 * over Jupiter's orbit, which is nothing against a sixteenfold margin.
 */
function scanStepDays(moon: BodyId): number {
  const orbit = BODIES[moon].satellite;
  if (!orbit) throw new Error(`'${moon}' is not a satellite`);

  const radiusKm = orbit.a * AU_IN_KM;
  const speedKmPerDay = (2 * Math.PI * radiusKm) / orbit.periodDays;
  const umbraKm = JUPITER_SHADOW_RADIUS_KM * (1 - radiusKm / umbraLengthKm(5.2));
  const crossingDays = (2 * umbraKm) / speedKmPerDay;

  return Math.min(orbit.periodDays / 48, crossingDays / SAMPLES_PER_CROSSING);
}

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

  const step = scanStepDays(moon);
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
      // Null when the bracket does not survive a fresh axis — see `refine`. The
      // sign change was then an artefact of the axis being refreshed mid-step,
      // not a crossing, and inventing an eclipse for it would put a fabricated
      // row in a student's log.
      const jdTrue = refine(positionsAt, moon, previousJd, jd, axis);
      if (jdTrue !== null) found.push(describe(positionsAt, moon, phase, jdTrue, perAuDays));
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
 * **Not every revolution produces an eclipse, and Callisto can go years.** A
 * moon is eclipsed on a given revolution only while its excursion out of
 * Jupiter's orbital plane keeps it inside the umbra at the moment it passes
 * behind the planet. Io, Europa and Ganymede never fail that test. Callisto,
 * whose 72 601 km swing exceeds the 69 981 km umbra at its distance, fails it
 * for years at a time: measured against a brute-force scan, it is eclipsed on
 * **every** one of its 22 revolutions in 1676 and 1682, and on **none at all**
 * in 1679 or 1685. Real Callisto has eclipse seasons for exactly this reason.
 *
 * Those seasons are what sets the search window. The widest true gap over
 * sixteen years is 1 240 days — **74 revolutions** — so the old cap of twenty
 * did not merely run short, it threw on most dates a student could pick:
 * choosing Callisto and pressing "skip to the next eclipse" in 1678, 1679,
 * 1680 or 1685 took the click handler down. The cap is now 90 revolutions,
 * which clears the measured worst case with room, and the throw is a genuine
 * "there is no eclipse coming" rather than "we stopped looking too early".
 */
const MAX_REVOLUTIONS_SEARCHED = 90;

export function nextEclipse(
  positionsAt: PositionsAt,
  moon: BodyId,
  jdFrom: number,
  phase?: EclipsePhase,
  perAuDays?: number,
): Eclipse {
  const orbit = BODIES[moon].satellite;
  if (!orbit) throw new Error(`'${moon}' is not a satellite`);

  const limit = jdFrom + MAX_REVOLUTIONS_SEARCHED * orbit.periodDays;
  for (let start = jdFrom; start < limit; start += orbit.periodDays) {
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

  throw new Error(
    `no eclipse of '${moon}' within ${MAX_REVOLUTIONS_SEARCHED} orbits of JD ${jdFrom}`,
  );
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
 *
 * Null when the first pass finds no crossing at all. That happens when the sign
 * change came from the axis being refreshed between two samples rather than
 * from the moon moving, which can only occur within a few kilometres of a
 * grazing pass — but "a few kilometres" is exactly where a real grazing eclipse
 * lives, so the answer has to be *no eclipse* rather than a midpoint dressed up
 * as one.
 */
function refine(
  positionsAt: PositionsAt,
  moon: BodyId,
  low: number,
  high: number,
  axis: ShadowAxis,
): number | null {
  const first = bisect(moon, low, high, axis);
  if (first === null) return null;

  const refinedAxis = axisAt(positionsAt, moon, first);
  const window = (high - low) / 64;
  // If the fresh axis moves the root outside the re-cut window, the first pass
  // is still a good answer — it is only the ~13 km of axis rotation that goes
  // uncorrected — so fall back to it rather than discarding a real eclipse.
  return bisect(moon, first - window, first + window, refinedAxis) ?? first;
}

function bisect(moon: BodyId, low: number, high: number, axis: ShadowAxis): number | null {
  let a = low;
  let b = high;
  const fa = shadowFunctionKm(axis, offsetAt(a, moon));
  const fb = shadowFunctionKm(axis, offsetAt(b, moon));
  if (fa > 0 === fb > 0) return null;

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
