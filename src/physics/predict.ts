/**
 * Rømer's September announcement, done with the student's own numbers.
 *
 * **This is the step that turns the whole exercise into science, and until now
 * the app only talked about it.** Everything else here is hindsight: collect a
 * few years of eclipses, fit a line through them, admire the line. Any
 * explanation that fits data already in hand is cheap, and a student who has
 * only ever done that has not seen what Rømer did. In September 1676 he named a
 * date months ahead and said the eclipse would come ten minutes after the tables
 * said. Then everyone waited. That is a claim that could have been wrong in
 * public, which is the only kind worth making.
 *
 * So this module builds the same fork, out of one log:
 *
 * - **The steady table.** The student's own fitted timetable, extrapolated past
 *   the end of their run to an eclipse they have not seen. It knows nothing
 *   about light; it is Cassini's table, made the way Cassini made his.
 * - **The corrected time.** The same eclipse, plus the delay their *own*
 *   measurement says the light will pick up on the way — the change in
 *   Earth–Jupiter distance times the seconds-per-AU they fitted.
 *
 * The two differ by eight to twenty minutes. The student jumps to the date and
 * watches. One of them is right, and nothing in the app told them which — the
 * steady table misses by ten to twenty-one minutes and the corrected time lands
 * within about three, which is a result a class can see from across the room.
 *
 * **Nothing absolute reaches the prediction** (CLAUDE.md §7.2b). The period, the
 * epoch and the seconds-per-AU all come from the log. The model is asked one
 * thing only — *when is there an eclipse around here* — which is a question
 * about the sky rather than about the answer, and an observer with an almanac
 * could ask it too.
 *
 * **The table here is a straight line, and that is not laziness.** The analysis
 * panel lets the interval drift, because over years it really does (`solve.ts`);
 * but a drifting fit is a polynomial, and a polynomial carried past the end of
 * its data does what polynomials do. Measured: the app's own two-term fit on a
 * six-year run, extrapolated two hundred days, missed by more than the whole
 * light-time signal and lost the bet outright. So the prediction fits its own
 * constant period to a trailing window — which is exactly what Cassini's tables
 * were, and exactly the table Rømer was correcting.
 */

import { AU_IN_KM } from '@orrery/core';

import { earthJupiterAu, SYNODIC_PERIOD_DAYS } from './configuration.js';
import { type GalileanId, SECONDS_PER_DAY } from './constants.js';
import { type Eclipse, type EclipsePhase, nextEclipse } from './eclipses.js';
import type { PositionsAt } from './lightTime.js';
import { analyse, type Observation, type TimedObservation } from './solve.js';

export interface Prediction {
  moon: GalileanId;
  phase: EclipsePhase;
  /** Which eclipse of the run's numbering, counting on past the end of it. */
  sequence: number;
  /** What a steady table says, JD — the prediction with no light in it. */
  steadyJd: number;
  /** The same eclipse once the student's own measured delay is added, JD. */
  correctedJd: number;
  /** How far apart the two predictions are, seconds. The thing being tested. */
  gapSeconds: number;
  /** Earth–Jupiter distance at the predicted eclipse, AU. */
  distanceAu: number;
  /**
   * The distance the steady table already allows for at that eclipse, AU.
   *
   * Not the run's average. A straight line through the readings absorbs the
   * trend in the light delay as well as its mean, so the part left to correct
   * is measured against the line, not against the middle of the run.
   */
  tableDistanceAu: number;
  /** The student's own figure, seconds per AU — where the correction comes from. */
  lightTimePerAuSeconds: number;
  /** How far past the last observation the prediction reaches, days. */
  reachDays: number;
  /** Observations the table was built from. */
  baselineCount: number;
}

/**
 * How far past the end of the log a prediction may reach.
 *
 * Long enough for the distance to have moved well away from what the table
 * extrapolates, which is what separates the two predictions — Rømer's own
 * announcement reached about two months. Short enough that the drift in the
 * eclipse interval, which a constant period cannot follow, stays small against
 * the light time being predicted.
 */
export const MAX_REACH_DAYS = 140;

/** Below this the two predictions are closer than a student can time them apart. */
const MINIMUM_GAP_SECONDS = 120;

/**
 * How much of the log the steady table is fitted to, counting back from the end
 * — **exactly one synodic cycle, and the exactness is the whole trick.**
 *
 * Measured across a sweep of window lengths and reaches, and the difference is
 * not subtle. Over one cycle the light-time oscillation completes exactly one
 * period inside the window, so the least-squares line through it comes out
 * flat: the fitted period is the uniform clock's, uncontaminated, and the table
 * is the light-free table the correction needs. Over 1.5 or 2 or 3 cycles the
 * leftover part of a cycle leaves a trend in the readings, the fitted period
 * swallows some of it, and what is left to correct stops matching what was
 * absorbed.
 *
 * The numbers, predicting from the ready-made log at each campaign length: one
 * cycle leaves the corrected prediction within 1.3 to 3.3 minutes of the sky at
 * every length, against a steady table out by 10 to 21. Three cycles leaves it
 * out by as much as 9.5 — as wrong as the thing it is correcting.
 *
 * One cycle is also short enough that Jupiter's own drift is nearly linear
 * across it, which is the other thing a constant period needs to be true.
 */
const TABLE_WINDOW_DAYS = SYNODIC_PERIOD_DAYS;

/** Below this the fitted line has too few points to be a table. */
const MINIMUM_TABLE_ROWS = 6;

/** How far ahead to start looking. Nearer than this and the gap is not worth betting on. */
const MINIMUM_REACH_DAYS = 20;

export interface PredictionInput {
  positionsAt: PositionsAt;
  observations: readonly Observation[];
  moon: GalileanId;
  /** Light time per AU in this universe, days — the game runs slower. */
  perAuDays?: number;
}

/**
 * The next eclipse worth betting on, or null when the log cannot support a bet.
 *
 * Null is the common case early on and is not a failure: with a short run the
 * fitted seconds-per-AU is nonsense, so a "prediction" from it would be a
 * coin toss dressed up as physics. `analyse` already refuses those, and this
 * refuses everything it refuses.
 */
export function predictNextEclipse(input: PredictionInput): Prediction | null {
  const { positionsAt, observations, moon, perAuDays } = input;

  const mine = observations.filter((o) => o.moon === moon);
  if (mine.length < 3) return null;

  // The measurement the bet is placed with. Its own guards do the work: too
  // short a run, or a slope indistinguishable from zero, and there is nothing
  // here to predict with.
  const solution = analyse(mine);
  if (!solution || solution.timings.tooShort || solution.slopeSigma < 3) return null;

  // Predict the kind of event they have most of — in practice disappearances,
  // which is what the log button records.
  const phase = commonestPhase(mine);

  // The eclipse numbering is the analysis's own, so the table and the log agree
  // about which eclipse is which without counting anything twice.
  const lastSeen = Math.max(...mine.map((o) => o.jdRecorded));
  const window = solution.timings.rows.filter(
    (row) =>
      row.observation.phase === phase &&
      row.observation.jdRecorded >= lastSeen - TABLE_WINDOW_DAYS,
  );
  if (window.length < MINIMUM_TABLE_ROWS) return null;

  const table = fitSteadyTable(window);
  if (!table) return null;

  // What distance the table's own rhythm already allows for — see `tableDistance`.
  const tableDistance = fitLine(
    window.map((row) => row.sequence),
    window.map((row) => row.observation.distanceAu),
  );
  if (!tableDistance) return null;

  // Which eclipse of the run any given one is, counted on from the last one
  // watched. Rounding a gap to a whole number of periods is the same bookkeeping
  // `buildTimetables` does, and just as safe: a few months round against a
  // 1.77-day period with a half-period margin, some forty times the light-time
  // variation being rounded through.
  const anchor = window[window.length - 1]!;
  const numberOf = (jdSeen: number): number =>
    anchor.sequence +
    Math.round((jdSeen - anchor.observation.jdRecorded) / table.periodDays);

  const target = chooseTarget({
    positionsAt,
    moon,
    phase,
    perAuDays,
    lastSeen,
    numberOf,
    expectedDistanceAu: (n) => tableDistance.at(n),
  });
  if (!target) return null;

  const { eclipse, sequence } = target;
  const steadyJd = table.at(sequence);
  if (!Number.isFinite(steadyJd)) return null;

  /*
   * The correction, and getting this right took a measurement.
   *
   * The obvious version — the student's seconds-per-AU times the distance
   * *change since the run's average* — is wrong, and wrong in a way that hides
   * for a while: it lost the bet outright on a twelve-year run. Fitting a
   * straight line to seen times does not merely absorb the *average* light
   * delay, it absorbs every part of it a straight line can follow, trend
   * included. Counting the whole change again double-counts whatever the table
   * already allows for.
   *
   * So the correction is the part no straight line could have caught: the
   * distance at the predicted eclipse, against the distance the table's own
   * rhythm extrapolates to. The arbitrary constant in the light time cancels
   * between the two, which is the same reason the mean delay never comes out of
   * the analysis either.
   */
  const lightTimePerAuSeconds = solution.lightTimePerAuSeconds;
  const distanceAu = earthJupiterAu(positionsAt, eclipse.jdSeen);
  const tableDistanceAu = tableDistance.at(sequence);
  const correctionSeconds = lightTimePerAuSeconds * (distanceAu - tableDistanceAu);
  const correctedJd = steadyJd + correctionSeconds / SECONDS_PER_DAY;

  const gapSeconds = Math.abs(correctionSeconds);
  if (gapSeconds < MINIMUM_GAP_SECONDS) return null;

  return {
    moon,
    phase,
    sequence,
    steadyJd,
    correctedJd,
    gapSeconds,
    distanceAu,
    tableDistanceAu,
    lightTimePerAuSeconds,
    reachDays: eclipse.jdSeen - lastSeen,
    baselineCount: mine.length,
  };
}

/**
 * How the student did, once they have actually watched it.
 *
 * Deliberately not a verdict on their timing — it is a verdict on the two
 * *predictions*, which is the comparison Rømer's contemporaries made.
 */
export interface PredictionOutcome {
  /** Their reading minus the steady table's time, seconds. */
  fromSteadySeconds: number;
  /** Their reading minus the corrected time, seconds. */
  fromCorrectedSeconds: number;
  /** True when the light-corrected prediction was the nearer of the two. */
  lightWon: boolean;
}

export function scorePrediction(
  prediction: Prediction,
  jdRecorded: number,
): PredictionOutcome {
  const fromSteadySeconds = (jdRecorded - prediction.steadyJd) * SECONDS_PER_DAY;
  const fromCorrectedSeconds = (jdRecorded - prediction.correctedJd) * SECONDS_PER_DAY;
  return {
    fromSteadySeconds,
    fromCorrectedSeconds,
    lightWon: Math.abs(fromCorrectedSeconds) < Math.abs(fromSteadySeconds),
  };
}

/** Light's crossing time for one AU, as a speed — for quoting alongside. */
export const speedFromPerAu = (secondsPerAu: number): number => AU_IN_KM / secondsPerAu;

/**
 * One epoch and one period through the recent readings — Cassini's table.
 *
 * Ordinary least squares on `jd = epoch + period · n`, referred to the first
 * reading in the window rather than to the Julian Date itself. A JD near
 * 2 430 000 resolves about 40 microseconds in a double while the quantity being
 * predicted is a matter of minutes, and `solve.ts` records what that
 * cancellation cost when the analysis made the same mistake.
 */
function fitSteadyTable(
  rows: readonly TimedObservation[],
): { at(sequence: number): number; periodDays: number } | null {
  // Referred to the first reading in the window rather than to the Julian Date
  // itself. A JD near 2 430 000 resolves about 40 microseconds in a double while
  // the quantity being predicted is a matter of minutes.
  const origin = rows[0]!.observation.jdRecorded;
  const line = fitLine(
    rows.map((row) => row.sequence),
    rows.map((row) => row.observation.jdRecorded - origin),
  );
  if (!line || !Number.isFinite(line.slope) || line.slope <= 0) return null;

  return { periodDays: line.slope, at: (sequence) => origin + line.at(sequence) };
}

/** Ordinary least squares, `y = a + b·x`. Null when every x is the same. */
function fitLine(
  xs: readonly number[],
  ys: readonly number[],
): { at(x: number): number; slope: number } | null {
  const meanX = mean(xs);
  const meanY = mean(ys);

  let covariance = 0;
  let variance = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i]! - meanX;
    covariance += dx * (ys[i]! - meanY);
    variance += dx * dx;
  }
  if (variance === 0) return null;

  const slope = covariance / variance;
  const intercept = meanY - slope * meanX;
  return { slope, at: (x) => intercept + slope * x };
}

/**
 * The eclipse worth betting on: the one, inside the reach, where the sky departs
 * furthest from what the steady table already allows for.
 *
 * That departure *is* the gap between the two predictions, so maximising it
 * maximises the thing the student is being asked to judge. Stepping through
 * candidate eclipses beats aiming at the nearest or furthest approach: the
 * extremum of the distance is not the extremum of the distance-against-the-table,
 * which is what actually matters here.
 */
function chooseTarget(input: {
  positionsAt: PositionsAt;
  moon: GalileanId;
  phase: EclipsePhase;
  perAuDays?: number;
  lastSeen: number;
  numberOf(jdSeen: number): number;
  expectedDistanceAu(sequence: number): number;
}) {
  const { positionsAt, moon, phase, perAuDays, lastSeen, numberOf, expectedDistanceAu } = input;

  let best: { eclipse: Eclipse; sequence: number; departureAu: number } | null = null;

  for (let day = MINIMUM_REACH_DAYS; day <= MAX_REACH_DAYS; day += 10) {
    let eclipse: Eclipse;
    try {
      eclipse = nextEclipse(positionsAt, moon, lastSeen + day, phase, perAuDays);
    } catch {
      // Callisto out of season, and nothing to predict. See `eclipses.ts`.
      break;
    }
    if (eclipse.jdSeen - lastSeen > MAX_REACH_DAYS) break;

    const sequence = numberOf(eclipse.jdSeen);
    const departureAu = Math.abs(
      earthJupiterAu(positionsAt, eclipse.jdSeen) - expectedDistanceAu(sequence),
    );
    if (!best || departureAu > best.departureAu) best = { eclipse, sequence, departureAu };
  }

  return best;
}

function commonestPhase(observations: readonly Observation[]): EclipsePhase {
  let disappearances = 0;
  for (const o of observations) if (o.phase === 'disappearance') disappearances++;
  return disappearances >= observations.length - disappearances
    ? 'disappearance'
    : 'reappearance';
}

const mean = (values: readonly number[]): number =>
  values.reduce((sum, v) => sum + v, 0) / values.length;
