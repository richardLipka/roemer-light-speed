/**
 * How the delay changes as Earth and Jupiter move — the whole effect in one
 * picture, and the place the student's own readings are laid over it.
 *
 * This is *not* the measurement plot in `solveView.ts`. That one plots lateness
 * against distance and answers "what did you get". This one plots against the
 * calendar and answers "why is there anything to measure at all": the light
 * takes about 33 minutes when Jupiter is nearest and 52 when it is furthest.
 *
 * **The curve is drawn as a variation about its own mean, not as an absolute.**
 * That is not presentation, it is what the method can see. The student's
 * timetable is fitted to their own timings, and fitting it absorbs whatever
 * constant delay there is; only the changes survive. Plotting an absolute delay
 * here and their variations over it would put the two on axes that do not meet.
 * This is also exactly why Rømer reported "twenty-two minutes to cross the
 * Earth's orbit" rather than a delay to Jupiter: the constant part was invisible
 * to him too.
 *
 * **The overlay is the reason this panel earns its place twice over.** A
 * reading's distance from the timetable *is* the variation in the light travel
 * time — the same quantity the curve is drawn from. The student's dots therefore
 * land on the model's curve without anything being fitted, scaled or lined up.
 * And when the run is long enough to cover more than one of Jupiter's 399-day
 * cycles, they come back: late, early, late again. A clock running slow drifts
 * and never returns; a worn instrument drifts and never returns; an observer's
 * habit drifts and never returns. Only something tied to where Earth happens to
 * be does this.
 *
 * Switch the timing mode to the events themselves and the same dots collapse
 * onto zero while the curve goes on swinging above them. That contrast is the
 * control experiment, and it is worth more than any amount of prose.
 *
 * CLAUDE.md §3 previously ruled out any standing plot of the app's own numbers,
 * on the grounds that it answers the question before the student asks it. That
 * was about the *residual* plot, which hands over the result. This curve hands
 * over the setup, which a student cannot easily discover by scrubbing a
 * timeline, and asking them to is not teaching.
 *
 * **Drawn as dots, not as rotated segments.** A percentage width resolves
 * against the parent's *width* while a percentage top resolves against its
 * *height*, so the length of a sloped line cannot be written as one percentage
 * unless the box happens to be square. Dots read as a curve and are simply
 * correct.
 */

import { calendarFromJd, jdFromCalendar } from '@orrery/core';

import { translate } from '../i18n/i18n.js';
import { delayCurve, extremaBetween } from '../physics/configuration.js';
import { buildTimetables } from '../physics/solve.js';
import type { Logbook } from '../state/log.js';
import { OPENING_JD, type Store } from '../state/store.js';
import { el } from './dom.js';
import { date, number } from './format.js';
import { scenePositions } from './scene.js';

const DAYS_PER_YEAR = 365.25;

/**
 * The window opens where the app opens, and the ready-made log is generated from
 * the same instant. One date, so a student's dots cannot land off the axes for
 * the sole reason that two files disagreed about when 1676 began.
 */
const START = OPENING_JD;

/** Dots across the field. More is invisible; fewer starts to look like a polyline. */
const CURVE_SAMPLES = 300;

export interface DelayCurveView {
  root: HTMLElement;
  render(jd: number): void;
}

export function createDelayCurve(store: Store, log: Logbook): DelayCurveView {
  const title = el('h2', 'panel__title');
  const intro = el('p', 'note');
  const field = el('div', 'curve__field');
  const axisHigh = el('span', 'curve__tick curve__tick--high');
  const axisLow = el('span', 'curve__tick curve__tick--low');
  const axisX = el('div', 'curve__axisX');
  const caption = el('p', 'curve__caption');
  const overlayNote = el('p', 'note note--live curve__overlayNote');

  const plot = el('div', 'curve__plot');
  plot.append(axisHigh, axisLow, field, axisX);

  const root = el('section', 'panel curve');
  root.append(title, intro, plot, overlayNote, caption);

  const playhead = el('div', 'curve__playhead');

  /**
   * Click the plot to go there.
   *
   * The panel already answers "where in the cycle am I" with the playhead; this
   * makes it answer "take me there", which is the question a student actually
   * has once they can see that the effect is largest at one end. The alternative
   * was scrubbing the clock and watching the playhead, which is the same
   * navigation performed backwards and by feel.
   *
   * Seeks whether or not the clock is running: pausing first would be a second
   * decision imposed on a single intention.
   */
  field.addEventListener('click', (event) => {
    const box = field.getBoundingClientRect();
    if (box.width === 0) return;
    const fraction = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    store.clock.setJd(START + fraction * spanDays);
    store.ticked();
  });

  // The model curve for a given span, kept so that changing the span is the only
  // thing that pays for it. Twelve years is some two thousand engine calls
  // between the samples and the turning points — nothing at startup, and a
  // visible stutter if it happened on every frame.
  let builtSpanDays = 0;
  let builtPerAu = 0;
  let low = 0;
  let high = 0;
  let yMin = 0;
  let yMax = 0;
  let spanDays = 0;
  let dirty = true;

  const toX = (jd: number) => ((jd - START) / spanDays) * 100;
  const toY = (m: number) => (1 - (m - yMin) / (yMax - yMin)) * 100;

  let samples = delayCurve(scenePositions, START, START, 1);
  let marks: { jd: number; kind: 'nearest' | 'furthest' }[] = [];

  log.subscribe(() => {
    dirty = true;
  });

  const rebuild = (): void => {
    const { campaignYears, timingMode } = store.current;
    spanDays = campaignYears * DAYS_PER_YEAR;
    const perAu = store.lightTimePerAuDays;

    if (spanDays !== builtSpanDays || perAu !== builtPerAu) {
      const step = Math.max(1, spanDays / CURVE_SAMPLES);
      samples = delayCurve(scenePositions, START, START + spanDays, step, perAu);
      marks = extremaBetween(scenePositions, START, START + spanDays);
      builtSpanDays = spanDays;
      builtPerAu = perAu;
    }

    const minutes = samples.map((s) => s.minutes);
    low = Math.min(...minutes);
    high = Math.max(...minutes);

    // Drawn about the window's own mean, because the constant part of the delay
    // is not something the method can see — the fitted timetable absorbs it.
    // See the head of this file.
    const middle = minutes.reduce((sum, m) => sum + m, 0) / minutes.length;
    const variation = samples.map((s) => s.minutes - middle);

    /*
     * In the game the model's curve *is* the answer, drawn to scale.
     *
     * The panel is kept — a student needs somewhere to watch their readings rise
     * and fall — but it is built from their observations alone, with nothing
     * plotted that they did not measure. Handing them the curve to lay their
     * points on would be handing them the answer and asking them to check it,
     * which is not the same exercise at all.
     */
    const showModel = store.truthVisible;

    // The axis has to hold the readings as well as the curve, or the control
    // experiment draws its flat line at zero somewhere off the bottom of the box
    // and the very comparison the panel exists for cannot be seen.
    const readings = buildTimetables(log.in(timingMode)).rows;
    const readingMinutes = readings.map((r) => r.residualSeconds / 60);
    const spread = [...(showModel ? variation : []), ...readingMinutes];
    // An empty game plot has neither curve nor readings and no range at all.
    yMin = spread.length ? Math.floor(Math.min(...spread) - 1) : -2;
    yMax = spread.length ? Math.ceil(Math.max(...spread) + 1) : 2;

    const nodes: HTMLElement[] = showModel
      ? samples.map((sample, i) => {
          const dot = el('div', 'curve__dot');
          dot.style.setProperty('--x', `${toX(sample.jd)}%`);
          dot.style.setProperty('--y', `${toY(variation[i]!)}%`);
          return dot;
        })
      : [];

    const markNodes = marks.map((mark) => {
      const node = el('div', `curve__mark curve__mark--${mark.kind}`);
      node.style.setProperty('--x', `${toX(mark.jd)}%`);
      node.title = `${translate(store.current.locale, `curve.${mark.kind}`)} — ${date(
        store.current.locale,
        mark.jd,
      )}`;
      return node;
    });

    // Only the readings that fall inside the window. A student can record an
    // eclipse anywhere on the timeline, and a dot pinned to the edge of the axes
    // would claim a date it does not have.
    const readingNodes: HTMLElement[] = [];
    for (const row of readings) {
      const jd = row.observation.jdRecorded;
      if (jd < START || jd > START + spanDays) continue;
      const dot = el('div', 'curve__reading');
      dot.style.setProperty('--x', `${toX(jd)}%`);
      dot.style.setProperty('--y', `${toY(row.residualSeconds / 60)}%`);
      readingNodes.push(dot);
    }

    field.replaceChildren(...nodes, ...markNodes, ...readingNodes, playhead);
    buildYearAxis();
    dirty = false;
  };

  /**
   * The bottom axis, in Earth years.
   *
   * The caption used to carry the only statement of when the window ran — "from
   * 1 January 1676 to 31 December 1678" — which tells you the ends and nothing
   * about the middle. A student looking at a point two thirds along had no way
   * to say when it was, and the whole argument of the panel is about *when*
   * things happen relative to Jupiter's 399-day cycle. Years are the unit that
   * makes the mismatch legible: the delay peaks drift steadily later against
   * them, because 399 days is not a year.
   *
   * Labelled every year up to six of them and every other year beyond, because
   * twelve labels across a plot this wide overlap into a grey smear.
   */
  function buildYearAxis(): void {
    const firstYear = calendarFromJd(START).year;
    const years = Math.ceil(spanDays / DAYS_PER_YEAR);
    const every = years > 6 ? 2 : 1;

    const ticks: HTMLElement[] = [];
    for (let k = 0; k <= years; k += every) {
      const jd = jdFromCalendar(firstYear + k, 1, 1);
      if (jd > START + spanDays) break;
      const x = toX(jd);
      // Centred labels hang half their width past the ends of the axis, where
      // the first one lands on top of the y-axis tick beneath it. The two
      // outermost are aligned to their own edge instead; the stalk stays put.
      const edge = x < 1 ? ' curve__year--first' : x > 99 ? ' curve__year--last' : '';
      const tick = el('span', `curve__year${edge}`, String(firstYear + k));
      tick.style.setProperty('--x', `${x}%`);
      ticks.push(tick);
    }
    axisX.replaceChildren(...ticks);
  }

  let builtYears = -1;
  let builtMode = '';
  let builtTruth = true;

  return {
    root,
    render(jd) {
      const { locale, campaignYears, timingMode } = store.current;
      const truth = store.truthVisible;

      if (
        dirty ||
        campaignYears !== builtYears ||
        timingMode !== builtMode ||
        truth !== builtTruth
      ) {
        builtYears = campaignYears;
        builtMode = timingMode;
        builtTruth = truth;
        rebuild();
      }

      title.textContent = translate(locale, truth ? 'curve.title' : 'curve.titleGame');
      // The swing, not the two absolutes. Quoting "33 minutes at the nearest, 52
      // at the furthest" over an axis drawn as a variation about zero would put
      // a number on screen that no tick mark agrees with. And in the game it
      // would put the answer on screen: the swing scales with the slowdown.
      intro.textContent = truth
        ? translate(locale, 'curve.intro', { swing: number(locale, high - low, 0) })
        : translate(locale, 'curve.introGame');
      axisHigh.textContent = `${yMax} min`;
      axisLow.textContent = `${yMin} min`;

      const shown = log.countIn(timingMode);
      overlayNote.textContent = !shown
        ? translate(locale, truth ? 'curve.overlayEmpty' : 'curve.overlayEmptyGame')
        : translate(locale, truth ? `curve.overlay.${timingMode}` : 'curve.overlayGame', {
            count: number(locale, shown, 0),
          });

      // The clock can be anywhere; the curve covers a fixed window. Beyond the
      // ends the playhead parks at the edge rather than drawing outside the axes.
      const clamped = Math.min(Math.max(jd, START), START + spanDays);
      playhead.style.setProperty('--x', `${toX(clamped)}%`);
      playhead.classList.toggle('curve__playhead--offscale', clamped !== jd);

      caption.textContent = translate(locale, 'curve.caption', {
        from: date(locale, START),
        to: date(locale, START + spanDays),
      });
    },
  };
}
