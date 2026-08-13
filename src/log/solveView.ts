/**
 * The answer, twice — the simple way first.
 *
 * CLAUDE.md §7.3. Route 1 is two eclipses and one division, and it is what is on
 * screen when the words *you have just measured the speed of light* appear.
 * Route 2 follows as *"now let's use all your measurements instead of two"*,
 * with the plot doing the explaining.
 *
 * The plot is drawn as positioned DOM nodes rather than SVG or canvas, like
 * everything else here — a dot per observation, and one rotated hairline for
 * the fitted line.
 */

import { AU_IN_KM } from '@orrery/core';

import { translate } from '../i18n/i18n.js';
import {
  analyse,
  type FullSolution,
  intervalEvidence,
  MINIMUM_RUN_DAYS,
  solveFromTwo,
  widestPair,
} from '../physics/solve.js';
import type { Logbook } from '../state/log.js';
import type { Store } from '../state/store.js';
import { el, fill } from '../view/dom.js';
import { number, percent, speed } from '../view/format.js';

export interface SolveView {
  root: HTMLElement;
  render(): void;
}

export function createSolveView(store: Store, log: Logbook): SolveView {
  const title = el('h2', 'panel__title');
  const body = el('div', 'solve__body');

  const root = el('section', 'panel solve');
  root.append(title, body);

  const render = (): void => {
    const { locale, timingMode, tab, slowdownRevealed } = store.current;
    title.textContent = translate(locale, 'solve.title');

    // One experiment at a time. Rows from the two timing modes answer different
    // questions and a fit across both would answer neither.
    const entries = log.in(timingMode);

    // Not `entries.length < 3`: the timetable drops any kind of event seen only
    // once, so three observations can leave two usable rows. See `analyse`.
    const full = analyse(entries, store.referenceSpeedKmPerS);
    if (!full) {
      fill(body, el('p', 'note note--live', translate(locale, 'solve.needMore')));
      return;
    }

    // Step one is built first and shown in *every* branch below, because
    // establishing the clock is the one thing a run of any length can do — and a
    // short run does it best. A student who has watched a fortnight of eclipses
    // has genuinely measured the period; what they cannot yet do is see it
    // shift. Telling them only "too short" would hide the half they got right.
    const step1 = buildStepOne(store, full);

    /*
     * Too short a run, and no amount of care rescues it.
     *
     * Over less than about one and a half of Jupiter's cycles the light-time
     * curve and the drift in the eclipse interval cannot be told apart, and the
     * fit will happily report a confident number that is mostly the second one.
     * Measured, the control experiment on such a run "detects" light travel at
     * six standard errors in a universe that has none. So this is refused
     * outright rather than qualified — and it is the reason Rømer needed years
     * of Cassini's accumulated observations, which is worth a student's time.
     */
    if (full.timings.tooShort) {
      fill(
        body,
        ...(step1 ? [step1] : []),
        el('h3', 'solve__routeTitle', translate(locale, 'solve.shortTitle')),
        el('p', 'note note--live', translate(locale, 'solve.shortBody')),
        el(
          'p',
          'solve__step',
          translate(locale, 'solve.shortSpan', {
            days: number(locale, full.timings.spanDays, 0),
            needed: number(locale, MINIMUM_RUN_DAYS, 0),
          }),
        ),
      );
      return;
    }

    /*
     * Nothing to divide by.
     *
     * Timing the events themselves gives a slope of zero plus the student's own
     * scatter, and `AU / slope` on a slope that is pure noise yields a confident
     * six-digit speed of light with a colossal error bar attached. Printing it
     * and letting the error bar carry the warning would be a trap: the eye reads
     * the big number. So below three standard errors this says outright that
     * there is no dependence on distance here, which is the correct reading of
     * the experiment and the whole reason for running it.
     */
    if (full.slopeSigma < 3) {
      fill(
        body,
        // Step one still holds in the control experiment, and holding is the
        // point: the clock is exactly as steady, and there is still nothing to
        // measure. That contrast is the whole of what the control shows.
        ...(step1 ? [step1] : []),
        el('h3', 'solve__routeTitle', translate(locale, 'solve.flatTitle')),
        el('p', 'solve__answer', translate(locale, 'solve.flatResult')),
        el('p', 'note note--live', translate(locale, 'solve.flatBody')),
        plot(store, full),
        el('p', 'note note--live', translate(locale, 'solve.flatCompare')),
      );
      return;
    }

    const pair = widestPair(full.timings.rows);
    const sections: HTMLElement[] = [];

    if (step1) sections.push(step1);

    if (pair) {
      const [near, far] = pair;
      const simple = solveFromTwo(near, far, store.referenceSpeedKmPerS);
      const block = el('div', 'solve__route');
      block.append(
        el('h3', 'solve__routeTitle', translate(locale, 'solve.simpleTitle')),
        el('p', 'note', translate(locale, 'solve.simpleIntro')),
        el(
          'p',
          'solve__step',
          translate(locale, 'solve.simpleExtraTime', {
            seconds: number(locale, simple.extraDelaySeconds, 0),
          }),
        ),
        el(
          'p',
          'solve__step',
          translate(locale, 'solve.simpleExtraDistance', {
            km: number(locale, simple.extraDistanceKm, 0),
          }),
        ),
        el(
          'p',
          'solve__answer',
          translate(locale, 'solve.simpleResult', {
            speed: speed(locale, simple.speedKmPerS),
          }),
        ),
      );
      sections.push(block);
    }

    const careful = el('div', 'solve__route');
    careful.append(
      el('h3', 'solve__routeTitle', translate(locale, 'solve.fullTitle')),
      el('p', 'note', translate(locale, 'solve.fullIntro')),
      plot(store, full),
      el(
        'p',
        'solve__answer',
        translate(locale, 'solve.fullResult', {
          speed: speed(locale, full.speedKmPerS),
          uncertainty: speed(locale, full.uncertaintyKmPerS),
        }),
      ),
      el(
        'p',
        'solve__step',
        translate(locale, 'solve.scatter', {
          seconds: number(locale, full.rmsResidualSeconds, 0),
        }),
      ),
      el('p', 'note', translate(locale, 'solve.meanNote')),
    );

    /*
     * How did you do — but only where the answer is already public.
     *
     * On the game tab this panel was giving the game away. It quoted the error
     * against `referenceSpeedKmPerS`, which on that tab is the *hidden* slowed
     * speed, so a student who had not yet pressed "show me the answer" could
     * read their percentage error and back out the answer in one division. The
     * reveal has to be the only route to it, or it is not a game.
     */
    const hidden = tab === 'game' && !slowdownRevealed;
    if (!hidden) {
      careful.append(
        el(
          'p',
          'solve__step',
          translate(locale, 'solve.comparison', {
            // The universe's own true value, not the constant. On the game tab
            // "the true value is 299 792 km/s" would be a flat contradiction of
            // the percentage printed beside it.
            trueSpeed: speed(locale, store.referenceSpeedKmPerS),
            percent: percent(locale, Math.abs(full.percentError)),
          }),
        ),
        el('p', 'note', translate(locale, 'solve.roemer')),
      );
    }

    sections.push(careful);

    fill(body, ...sections);
  };

  log.subscribe(render);
  return { root, render };
}

/**
 * Step one: the clock, established before anything is built on it.
 *
 * The panel used to open with "the simple way — two eclipses", which quietly
 * assumed the premise the whole method rests on: that the eclipses recur at a
 * fixed interval. The fit had that premise built into it and never showed a
 * student that a constant period *fits*. Rømer and Cassini had to establish it
 * first, from observations, and so should this.
 *
 * Three statements, in the order they have to be made: here is your interval,
 * here is why its scatter is your hand and not the clock, and here — the one a
 * student is really owed — is the same set of intervals sorted by which way
 * Earth was going. That last is Rømer's own first observation, and nothing in it
 * comes from anywhere but their own log, so it is safe on the game tab too.
 */
function buildStepOne(store: Store, full: FullSolution): HTMLElement | null {
  const { locale } = store.current;
  const evidence = intervalEvidence(full.timings.rows);
  const table = full.timings.timetables[0];
  if (!evidence || !table) return null;

  const clock = el('div', 'solve__route');
  clock.append(
    el('h3', 'solve__routeTitle', translate(locale, 'solve.step1Title')),
    el(
      'p',
      'solve__step',
      translate(locale, 'solve.step1Period', {
        moon: translate(locale, `moon.${table.moon}`),
        period: number(locale, evidence.meanIntervalDays, 5),
        count: number(locale, evidence.pairCount, 0),
      }),
    ),
    // Both of these carry measured numbers, so both are `note--live` and survive
    // the notes toggle. They are results of step one, not commentary on it.
    el(
      'p',
      'note note--live',
      translate(locale, 'solve.step1Steady', {
        seconds: number(locale, evidence.scatterSeconds, 0),
      }),
    ),
    el(
      'p',
      'note note--live',
      translate(locale, 'solve.step1Rhythm', {
        receding: number(locale, Math.abs(evidence.recedingExcessSeconds), 1),
        approaching: number(locale, Math.abs(evidence.approachingExcessSeconds), 1),
      }),
    ),
  );

  if (table.slowTermCount > 1) {
    clock.append(el('p', 'note', translate(locale, 'solve.step1Drift')));
  }
  return clock;
}

/**
 * Lateness against distance. The points lie on a line; its steepness is how long
 * light takes to cross one AU, and therefore the speed.
 */
function plot(store: Store, solution: FullSolution): HTMLElement {
  const { locale } = store.current;

  const distances = solution.points.map((p) => p.distanceAu);
  const minutes = solution.points.map((p) => p.residualSeconds / 60);
  const xMin = Math.min(...distances);
  const xMax = Math.max(...distances);
  const yMin = Math.min(...minutes);
  const yMax = Math.max(...minutes);

  const field = el('div', 'plot__field');
  const toX = (d: number) => ((d - xMin) / (xMax - xMin || 1)) * 100;
  const toY = (m: number) => (1 - (m - yMin) / (yMax - yMin || 1)) * 100;

  for (const point of solution.points) {
    const dot = el('div', 'plot__dot');
    dot.style.setProperty('--x', `${toX(point.distanceAu)}%`);
    dot.style.setProperty('--y', `${toY(point.residualSeconds / 60)}%`);
    field.append(dot);
  }

  // The fitted line, as a run of dots. A rotated element cannot carry a sloped
  // length as a single percentage — width resolves against the parent's width
  // and top against its height — so anything but a horizontal line comes out the
  // wrong length. Dots sidestep the whole question.
  const lineAt = (d: number) =>
    (solution.line.interceptSeconds + solution.line.slopeSecondsPerAu * d) / 60;
  for (let i = 0; i <= 80; i++) {
    const d = xMin + ((xMax - xMin) * i) / 80;
    const node = el('div', 'plot__fit');
    node.style.setProperty('--x', `${toX(d)}%`);
    node.style.setProperty('--y', `${toY(lineAt(d))}%`);
    field.append(node);
  }

  const root = el('figure', 'plot');
  root.append(
    field,
    el('figcaption', 'plot__axis', translate(locale, 'solve.plotX')),
    el('span', 'plot__axis plot__axis--y', translate(locale, 'solve.plotY')),
  );
  void AU_IN_KM;
  return root;
}
