/**
 * Turning a log of eclipse timings into a speed of light — **out of the timings
 * and nothing else.**
 *
 * The first version of this module compared each observation against the model's
 * own light-free eclipse time and called the difference "how late". That is
 * arithmetically convenient and historically false, and the falsehood is not a
 * detail: it hands the student a quantity nobody in 1676 could possibly have
 * had. Nobody knew when an eclipse "really" happened. There was no independent
 * access to the event — the light *is* the event, as far as any observer is
 * concerned. A column headed *when it was due* quietly asserts a second channel
 * to Jupiter that does not exist, and with it the whole difficulty of the
 * discovery disappears.
 *
 * What Rømer actually had was **a table built from earlier observations**.
 * Cassini's tables were an empirical fit: watch the eclipses, find the interval,
 * extrapolate. So the comparison that produced the discovery was never
 * observation against reality. It was **observation against other observations**
 * — timings from one part of the year against a rhythm established in another.
 *
 * So that is what this module does. The student's own log is fitted with a
 * constant period, giving *their* timetable, and every event is then compared
 * with *their* extrapolation. No true time is ever consulted.
 *
 * Three things follow, and all three are the physics rather than concessions:
 *
 * **The run must outlast Jupiter's synodic cycle.** Over less than 399 days the
 * Earth–Jupiter distance moves in one direction, so the light time drifts
 * steadily, so a fitted period simply swallows it and the residuals come out
 * flat. Rømer needed years of accumulated observation for exactly this reason,
 * and an app that hid the requirement would be teaching that he was merely slow.
 *
 * **The mean delay is not recoverable.** Fitting an epoch absorbs whatever
 * constant offset the light time has; only its *variation* survives. This is
 * precisely why Rømer's result was "twenty-two minutes to cross the Earth's
 * orbit" and not a delay to Jupiter in minutes — the constant part is invisible
 * to the method, then and here.
 *
 * **The distance comes from Kepler, not from light.** Relative distances in AU
 * were known from the orbital model. What that could not give was the size of
 * the AU itself, which is why Rømer could only ever report a *time*. Turning it
 * into km/s needed Cassini's 1672 parallax of Mars, and Huygens did that two
 * years later.
 */

import { AU_IN_KM } from '@orrery/core';

import { C_KM_PER_S, type GalileanId, LIGHT_TIME_PER_AU_S, SECONDS_PER_DAY } from './constants.js';
import { SYNODIC_PERIOD_DAYS } from './configuration.js';
import { eclipsePeriodDays, type EclipsePhase } from './eclipses.js';

/**
 * Which eclipse the observer was timing — and this is the app's control
 * experiment, not a display option.
 *
 * `'seen'` is the real one: you time the arrival of the news, so the reading
 * carries the light travel time and it varies with distance.
 *
 * `'true'` is the impossible one: you time the event itself, as if light were
 * infinitely fast. Every reading then falls on your own timetable whatever Earth
 * is doing, the residuals go flat, and there is no speed to extract.
 *
 * Being able to run both and compare is what turns "the eclipses are late" from
 * an assertion into an argument: the effect appears only when the news has to
 * travel. A log therefore records which experiment each row belongs to, and the
 * analysis never mixes them.
 */
export type TimingMode = 'seen' | 'true';

export interface Observation {
  /** The moment the student recorded, JD. Their reading, and the only datum. */
  jdRecorded: number;
  moon: GalileanId;
  phase: EclipsePhase;
  /**
   * Earth–Jupiter distance for this event, AU, recorded alongside it.
   *
   * From the orbital model, which is where Rømer's came from too — and stored
   * with the row rather than recomputed later, so editing or clearing the log
   * cannot silently change an answer.
   */
  distanceAu: number;
  mode: TimingMode;
}

// --- the student's own timetable ------------------------------------------

/**
 * An ephemeris fitted to the student's own timings. Cassini's tables, made the
 * way Cassini's tables were made.
 *
 * One period per moon, and a separate epoch for each kind of event, because a
 * disappearance and a reappearance are the same clock read at two points of the
 * same crossing — about two and a quarter hours apart for Io. Sharing the period
 * across both uses every observation to pin down the one quantity that matters.
 *
 * **The interval is allowed to drift slowly**, and this is not a fudge — it was
 * forced by measurement. A strictly constant period fitted over three years
 * leaves a fifteen-minute systematic in the residuals, which is very nearly the
 * whole light-time signal, and it appears just as strongly in the control run
 * where there is no light travel at all. The cause is Jupiter: the shadow points
 * away from the Sun, so the eclipses tick at the *synodic* period, and Jupiter's
 * angular speed varies by some ten per cent around its eccentric orbit. The
 * interval between eclipses therefore really does change over years.
 *
 * That is history, not an artefact. It is exactly why Cassini's tables drifted,
 * why they had to be re-derived, and why the light-time signal was so hard to
 * pick out of them. The fit answers it the way an eighteenth-century table did:
 * a few slow terms in the eclipse number, `slowTermCount` of them.
 *
 * **The degree is chosen so the slow terms cannot imitate the signal.** Jupiter's
 * variation has a period of nearly twelve years; the light time repeats every
 * 399 days. A polynomial with far fewer bends than the run has synodic cycles
 * can follow the first and not the second. One term per one and a half cycles,
 * capped, keeps that separation at every campaign length — and `solve.test.ts`
 * holds it to account by running the control experiment at each of them, where
 * any term that had started eating the signal would show up as a detection of
 * something that is not there.
 */
export interface Timetable {
  moon: GalileanId;
  /** Mean days between eclipses, **fitted** — never the model's own figure. */
  periodDays: number;
  /** Fitted moment of eclipse zero, JD, for each kind of event present. */
  epochJd: Partial<Record<EclipsePhase, number>>;
  /** How many slow terms the interval was allowed — 1 is a constant period. */
  slowTermCount: number;
  observationCount: number;
  /** Free parameters spent: the slow terms plus one epoch per kind of event. */
  parameterCount: number;
}

export interface TimedObservation {
  observation: Observation;
  /** Which eclipse of the run — see `buildTimetables` on why counting is free. */
  sequence: number;
  /** What the student's own timetable predicts for it, JD. */
  jdFromTimetable: number;
  /** Observed minus timetable, seconds. The quantity everything is made of. */
  residualSeconds: number;
}

export interface Timings {
  timetables: Timetable[];
  rows: TimedObservation[];
  /** First observation to last, days. */
  spanDays: number;
  /** Total free parameters spent on the timetables. */
  parameterCount: number;
  /**
   * True when the run is too short for the method to separate the light time
   * from the drift in the eclipse interval.
   *
   * The threshold is one and a half of Jupiter's 399-day cycles, not one. Over a
   * single cycle the Earth–Jupiter distance traces one curve, the slow drift
   * traces part of another, and no fit can tell them apart: measured on a
   * 1.1-year run, the *control* experiment — where there is no light travel at
   * all — reported a detection at six and a half standard errors. A method that
   * finds light-time in a universe without any is worse than one that finds
   * nothing, so runs below this simply do not get an answer.
   */
  tooShort: boolean;
}

/**
 * Fit a timetable per moon, and measure every observation against it.
 *
 * **Counting the eclipses is not the measurement.** The sequence number comes
 * from rounding each gap to the nearest whole number of periods, using the
 * moon's known recurrence only as a counting aid. That is bookkeeping an
 * observatory does trivially — you know the eclipse you watched last night was
 * the one after the night before — and it is nowhere near delicate enough to
 * carry the answer: gaps of a fortnight round against a period of 1.77 days with
 * a margin of half a period, some forty times the light-time variation being
 * rounded through. The *period itself* is then thrown away and refitted from the
 * student's timings, which is where the measurement lives.
 *
 * Groups of fewer than two observations are dropped. With one event of a kind,
 * the fitted epoch lands exactly on it, its residual is zero by construction,
 * and a false point at zero would drag the slope toward nothing.
 */
export function buildTimetables(
  observations: readonly Observation[],
  /**
   * Deliberately perturb the counting aid, so a test can prove it carries no
   * information. See `solve.test.ts`: a hint 3% wrong must move the answer by
   * nothing at all, because all it ever does is round a gap to a whole number of
   * periods — and if it ever stopped being harmless, that would mean the model's
   * own period had found a way into the measurement.
   */
  hintScale = 1,
): Timings {
  const byMoon = new Map<GalileanId, Observation[]>();
  for (const observation of observations) {
    const bucket = byMoon.get(observation.moon);
    if (bucket) bucket.push(observation);
    else byMoon.set(observation.moon, [observation]);
  }

  const timetables: Timetable[] = [];
  const rows: TimedObservation[] = [];

  for (const [moon, group] of byMoon) {
    const sorted = [...group].sort((a, b) => a.jdRecorded - b.jdRecorded);
    const hintDays = eclipsePeriodDays(moon) * hintScale;

    const sequence: number[] = [0];
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i]!.jdRecorded - sorted[i - 1]!.jdRecorded;
      sequence.push(sequence[i - 1]! + Math.round(gap / hintDays));
    }

    const byPhase = new Map<EclipsePhase, number[]>();
    for (let i = 0; i < sorted.length; i++) {
      const phase = sorted[i]!.phase;
      const bucket = byPhase.get(phase);
      if (bucket) bucket.push(i);
      else byPhase.set(phase, [i]);
    }

    const usable = [...byPhase.entries()].filter(([, indices]) => indices.length >= 2);
    if (usable.length === 0) continue;

    const used = usable.flatMap(([, indices]) => indices);
    const sequences = used.map((i) => sequence[i]!);
    const lowest = Math.min(...sequences);
    const highest = Math.max(...sequences);

    // Every observation of this moon fell on the same eclipse number. Nothing to
    // fit a period to, and nothing the run can say.
    if (highest === lowest) continue;

    // Centre and scale the eclipse number before raising it to powers. A run of
    // twelve years reaches n ≈ 2 500, and 2 500⁶ is 2×10²¹ — the normal
    // equations would be solving for coefficients spread over twenty orders of
    // magnitude. On [−1, 1] the same fit is unremarkable.
    const middle = (highest + lowest) / 2;
    const halfSpan = (highest - lowest) / 2;
    const scaled = (n: number) => (n - middle) / halfSpan;

    const spanCycles = (sorted.at(-1)!.jdRecorded - sorted[0]!.jdRecorded) / SYNODIC_PERIOD_DAYS;
    const slowTermCount = slowTerms(spanCycles, used.length, usable.length);

    // Columns: one indicator per kind of event, carrying its epoch, then the
    // powers of the scaled eclipse number. The first power is the period; any
    // beyond it are the slow drift.
    const design = used.map((i) => {
      const row: number[] = usable.map(([phase]) => (sorted[i]!.phase === phase ? 1 : 0));
      const x = scaled(sequence[i]!);
      for (let power = 1; power <= slowTermCount; power++) row.push(x ** power);
      return row;
    });

    // Fit against time *since the first reading*, never against the Julian Date
    // itself. Two reasons, and they are the same reason twice over.
    //
    // Physically, the method rests on differences between observations, so an
    // absolute epoch has no business in the arithmetic — shifting every reading
    // by a week must not move the answer by anything at all.
    //
    // Numerically, a JD near 2 430 000 resolves about 40 microseconds in a
    // double, and the residuals being fitted are a few hundred *milli*seconds.
    // Fitting the raw dates threw away most of the significant digits of the one
    // quantity that matters: measured, a seven-day shift of the whole log moved
    // the fitted speed by 0.02 km/s out of nothing but cancellation. Referred to
    // the first reading the targets are small and the noise disappears.
    const origin = sorted[0]!.jdRecorded;

    const coefficients = leastSquares(
      design,
      used.map((i) => sorted[i]!.jdRecorded - origin),
    );
    if (!coefficients) continue;

    /** Days after the first reading, which is the frame the fit lives in. */
    const predictOffset = (phaseIndex: number, n: number): number => {
      let value = coefficients[phaseIndex]!;
      const x = scaled(n);
      for (let power = 1; power <= slowTermCount; power++) {
        value += coefficients[usable.length + power - 1]! * x ** power;
      }
      return value;
    };

    // The interval at the middle of the run, where every higher power vanishes:
    // d(t)/d(n) = c₁ / halfSpan. The one number a student would call "the
    // period", even though the fit lets it drift either side.
    const periodDays = coefficients[usable.length]! / halfSpan;

    const epochJd: Partial<Record<EclipsePhase, number>> = {};
    usable.forEach(([phase], phaseIndex) => {
      epochJd[phase] = origin + predictOffset(phaseIndex, 0);
    });

    usable.forEach(([, indices], phaseIndex) => {
      for (const i of indices) {
        const offset = predictOffset(phaseIndex, sequence[i]!);
        // Differenced inside the centred frame. Taking `jdRecorded` minus a
        // reconstructed Julian Date would subtract two numbers near 2 430 000 to
        // get a few hundred milliseconds, and hand back mostly rounding error.
        const residualDays = sorted[i]!.jdRecorded - origin - offset;
        rows.push({
          observation: sorted[i]!,
          sequence: sequence[i]!,
          jdFromTimetable: origin + offset,
          residualSeconds: residualDays * SECONDS_PER_DAY,
        });
      }
    });

    timetables.push({
      moon,
      periodDays,
      epochJd,
      slowTermCount,
      observationCount: used.length,
      parameterCount: usable.length + slowTermCount,
    });
  }

  rows.sort((a, b) => a.observation.jdRecorded - b.observation.jdRecorded);

  const times = observations.map((o) => o.jdRecorded);
  const spanDays = times.length ? Math.max(...times) - Math.min(...times) : 0;

  return {
    timetables,
    rows,
    spanDays,
    parameterCount: timetables.reduce((sum, t) => sum + t.parameterCount, 0),
    tooShort: spanDays < MINIMUM_CYCLES * SYNODIC_PERIOD_DAYS,
  };
}

/** Synodic cycles a run must cover before it is allowed to produce an answer. */
export const MINIMUM_CYCLES = 1.5;

/** The same as a number of days, for the interface to quote. */
export const MINIMUM_RUN_DAYS = MINIMUM_CYCLES * SYNODIC_PERIOD_DAYS;

/**
 * How far an observation fell from the student's own timetable, seconds.
 *
 * Deliberately **not** a property of a single row. It cannot be: it is a
 * comparison with the rest of the log, which is the whole point.
 */
export const residualSeconds = (row: TimedObservation): number => row.residualSeconds;

// --- route 1: Rømer's own arithmetic --------------------------------------

export interface TwoEclipseSolution {
  near: TimedObservation;
  far: TimedObservation;
  nearResidualSeconds: number;
  farResidualSeconds: number;
  /** The difference — how much longer the light took, seconds. */
  extraDelaySeconds: number;
  /** How much further it had to go, km. */
  extraDistanceKm: number;
  speedKmPerS: number;
  /** Signed, against whatever the universe's true value happens to be. */
  percentError: number;
}

/**
 * Two eclipses, one near and one far, and one division.
 *
 * Against the same timetable, the far one falls later than the near one. The
 * difference is how much longer the light took; the extra ground it covered is
 * the change in the Earth–Jupiter distance. Divide.
 *
 *     speed = extra distance ÷ extra time
 *
 * Both epochs cancel in the subtraction, so this is a comparison of two
 * observations with each other and nothing else — the cleanest statement of what
 * the whole method is.
 */
export function solveFromTwo(
  near: TimedObservation,
  far: TimedObservation,
  referenceKmPerS = C_KM_PER_S,
): TwoEclipseSolution {
  const extraDelaySeconds = far.residualSeconds - near.residualSeconds;
  const extraDistanceKm =
    (far.observation.distanceAu - near.observation.distanceAu) * AU_IN_KM;

  const speedKmPerS = extraDistanceKm / extraDelaySeconds;
  return {
    near,
    far,
    nearResidualSeconds: near.residualSeconds,
    farResidualSeconds: far.residualSeconds,
    extraDelaySeconds,
    extraDistanceKm,
    speedKmPerS,
    percentError: (100 * (speedKmPerS - referenceKmPerS)) / referenceKmPerS,
  };
}

/**
 * The pair that makes the argument clearest: the largest change in distance.
 *
 * Which is, without having to explain it as such, one eclipse near opposition
 * and one near conjunction. Returned nearest first, so the story runs in the
 * direction the sentence does.
 */
export function widestPair(
  rows: readonly TimedObservation[],
): [TimedObservation, TimedObservation] | null {
  if (rows.length < 2) return null;

  let near = rows[0]!;
  let far = rows[0]!;
  for (const row of rows) {
    if (row.observation.distanceAu < near.observation.distanceAu) near = row;
    if (row.observation.distanceAu > far.observation.distanceAu) far = row;
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
  /**
   * The fitted slope in units of its own standard error — how sure we are that
   * there is any dependence on distance at all.
   *
   * This is the number that decides whether an answer may be quoted. Timing the
   * eclipses you *see* gives tens; timing the events themselves gives under two,
   * because the true slope is zero and only the student's own scatter is left.
   * Dividing a distance by a slope indistinguishable from zero produces a
   * confident-looking speed of light out of pure noise, and reporting one would
   * teach precisely the wrong lesson. Below about three, say there is nothing
   * there instead — see `solveView.ts`.
   */
  slopeSigma: number;
  /** The run's own diagnostics, so the interface can explain a null. */
  timings: Timings;
  /** The plot: how far each event fell from the timetable, against distance. */
  points: readonly { distanceAu: number; residualSeconds: number }[];
  /**
   * The line through them. Its steepness is the light travel time per AU.
   *
   * The intercept is **not** a result. Fitting an epoch per kind of event has
   * already absorbed the mean delay, so this comes out near zero by
   * construction. That is not a check on anything; it is the statement that the
   * constant part of the light time is invisible to the method.
   */
  line: { interceptSeconds: number; slopeSecondsPerAu: number };
}

/**
 * The same idea applied to every eclipse in the log rather than two of them.
 *
 * Plot each event's distance from the student's own timetable against how far
 * Jupiter was; the points lie on a line; its steepness is how long light takes
 * to cross one AU. An ordinary least-squares fit, and the gain over route 1 is
 * simply that a hundred readings average their errors away where two carry
 * theirs straight into the answer.
 *
 * `referenceKmPerS` is what the answer is scored against, and it is a parameter
 * rather than a constant because the game runs in a universe with a different
 * one (`store.ts`).
 */
export function solveFromAll(
  observations: readonly Observation[],
  referenceKmPerS = C_KM_PER_S,
  hintScale = 1,
): FullSolution {
  const solution = analyse(observations, referenceKmPerS, hintScale);
  if (!solution) throw new Error('need at least three usable eclipses');
  return solution;
}

/**
 * The analysis, or `null` when the log cannot support one.
 *
 * **Every view must come through here rather than through `solveFromAll`.**
 * "Three observations" is not the same condition as "three usable rows", and
 * the difference was a crash reachable in about a minute: record two
 * disappearances and one reappearance, and the timetable drops the lone
 * reappearance — a single event of a kind has its epoch fitted straight onto
 * it, contributing a fabricated point at zero — leaving two rows for a fit that
 * needs three. Each panel had guarded on the count of *observations*, so all
 * three sailed past the check and the exception took the whole render down on
 * page load.
 *
 * `solveFromAll` still throws, because the tests want a loud failure and a
 * caller that has already checked wants the non-null type.
 */
export function analyse(
  observations: readonly Observation[],
  referenceKmPerS = C_KM_PER_S,
  hintScale = 1,
): FullSolution | null {
  const timings = buildTimetables(observations, hintScale);
  const rows = timings.rows;
  if (rows.length < 3) return null;

  const points = rows.map((row) => ({
    distanceAu: row.observation.distanceAu,
    residualSeconds: row.residualSeconds,
  }));

  const meanDistance = mean(points.map((p) => p.distanceAu));
  const meanResidual = mean(points.map((p) => p.residualSeconds));

  let covariance = 0;
  let variance = 0;
  for (const point of points) {
    const dx = point.distanceAu - meanDistance;
    covariance += dx * (point.residualSeconds - meanResidual);
    variance += dx * dx;
  }

  // Every eclipse at the same distance: nothing to compare, and dividing by it
  // would hand back an infinity dressed as a speed of light.
  if (variance === 0) return null;

  const slopeSecondsPerAu = covariance / variance;
  const interceptSeconds = meanResidual - slopeSecondsPerAu * meanDistance;

  let residualSumSquares = 0;
  for (const point of points) {
    const predicted = interceptSeconds + slopeSecondsPerAu * point.distanceAu;
    residualSumSquares += (point.residualSeconds - predicted) ** 2;
  }

  // Both fits cost parameters: the timetables spent theirs before this one
  // started, and charging only for the slope and intercept would understate the
  // scatter and quote an uncertainty that is too small.
  const degreesOfFreedom = points.length - timings.parameterCount - 2;
  const residualVariance = degreesOfFreedom > 0 ? residualSumSquares / degreesOfFreedom : 0;
  const slopeStandardError = Math.sqrt(residualVariance / variance);

  const speedKmPerS = AU_IN_KM / slopeSecondsPerAu;

  return {
    lightTimePerAuSeconds: slopeSecondsPerAu,
    speedKmPerS,
    // c = AU / slope, so a relative error in the slope is one in the speed.
    uncertaintyKmPerS: Math.abs(speedKmPerS * (slopeStandardError / slopeSecondsPerAu)),
    percentError: (100 * (speedKmPerS - referenceKmPerS)) / referenceKmPerS,
    observationCount: points.length,
    rmsResidualSeconds: Math.sqrt(residualVariance),
    slopeSigma: slopeStandardError > 0 ? Math.abs(slopeSecondsPerAu) / slopeStandardError : Infinity,
    timings,
    points,
    line: { interceptSeconds, slopeSecondsPerAu },
  };
}

/** What the app knows the answer to be, for the "how did you do?" line. */
export const TRUE_SPEED_KM_PER_S = C_KM_PER_S;
export const TRUE_LIGHT_TIME_PER_AU_S = LIGHT_TIME_PER_AU_S;

const mean = (values: readonly number[]): number =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

/**
 * How many powers of the eclipse number the timetable may use — **one or two,
 * and the boundary was measured rather than reasoned.**
 *
 * One term is a constant interval. Two lets it drift steadily, which is what
 * Jupiter's varying angular speed actually does to it. There is no third, and
 * the sweep that settled this (kept in git history) is worth summarising because
 * both ways of getting it wrong are dramatic:
 *
 * - **Too many terms erase the answer.** Over a single synodic cycle a quadratic
 *   can follow the light-time curve itself. Measured: a 1.1-year run fitted with
 *   two terms returned a speed of light 818% out, because the timetable had
 *   quietly absorbed the very thing being measured. A polynomial flexible enough
 *   to fit the drift is flexible enough to fit the signal, and nothing in the
 *   arithmetic complains.
 * - **Too few leave a systematic that swamps it.** A nine-year run fitted with
 *   one term came out 86% out, because a constant interval cannot follow the
 *   drift at all and the leftover is smooth, large, and partly in step with the
 *   Earth–Jupiter distance.
 *
 * Between those, two terms over anything longer than about 1.75 cycles holds the
 * error inside ±8% at every campaign length offered, which is comfortably better
 * than Rømer's own 32%. `solve.test.ts` runs the control experiment at each
 * length; a term that had begun eating the signal shows up there as a detection
 * of something that is not there.
 *
 * Also held below what the data can pay for: enough observations must be left
 * over to say anything about the scatter.
 */
const TWO_TERM_CYCLES = 1.75;
function slowTerms(spanCycles: number, observationCount: number, phaseCount: number): number {
  const affordable = Math.max(1, Math.floor((observationCount - phaseCount - 4) / 2));
  if (override !== null) return Math.min(override, affordable);
  return Math.min(spanCycles < TWO_TERM_CYCLES ? 1 : 2, affordable);
}

/** Diagnostics only: pin the term count so a sweep can find the right rule. */
let override: number | null = null;
export function setSlowTermOverride(value: number | null): void {
  override = value;
}

/**
 * Ordinary least squares by normal equations, with partial pivoting.
 *
 * Small and dense — at most eight columns — so the textbook method is the right
 * one here, and squaring the condition number costs nothing that a double cannot
 * absorb once the powers are taken on [−1, 1]. Returns null for a singular
 * system rather than propagating an infinity into a fitted speed of light.
 */
function leastSquares(design: readonly (readonly number[])[], targets: readonly number[]): number[] | null {
  const columns = design[0]?.length ?? 0;
  if (!columns || design.length < columns) return null;

  // The augmented normal matrix [DᵀD | Dᵀt], built in one pass.
  const system: number[][] = Array.from({ length: columns }, () => new Array<number>(columns + 1).fill(0));
  for (let r = 0; r < design.length; r++) {
    const row = design[r]!;
    for (let i = 0; i < columns; i++) {
      for (let j = 0; j < columns; j++) system[i]![j]! += row[i]! * row[j]!;
      system[i]![columns]! += row[i]! * targets[r]!;
    }
  }

  for (let pivot = 0; pivot < columns; pivot++) {
    let best = pivot;
    for (let r = pivot + 1; r < columns; r++) {
      if (Math.abs(system[r]![pivot]!) > Math.abs(system[best]![pivot]!)) best = r;
    }
    if (Math.abs(system[best]![pivot]!) < 1e-12) return null;
    [system[pivot], system[best]] = [system[best]!, system[pivot]!];

    const pivotRow = system[pivot]!;
    for (let r = 0; r < columns; r++) {
      if (r === pivot) continue;
      const row = system[r]!;
      const factor = row[pivot]! / pivotRow[pivot]!;
      if (factor === 0) continue;
      for (let c = pivot; c <= columns; c++) row[c]! -= factor * pivotRow[c]!;
    }
  }

  return system.map((row, i) => row[columns]! / row[i]!);
}
