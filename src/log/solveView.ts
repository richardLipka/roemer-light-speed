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
  type FullSolution,
  solveFromAll,
  solveFromTwo,
  widestPair,
} from '../physics/solve.js';
import type { ObservationLog } from '../state/log.js';
import type { Store } from '../state/store.js';
import { el, fill } from '../view/dom.js';
import { number, percent, speed } from '../view/format.js';

export interface SolveView {
  root: HTMLElement;
  render(): void;
}

export function createSolveView(store: Store, log: ObservationLog): SolveView {
  const title = el('h2', 'panel__title');
  const body = el('div', 'solve__body');

  const root = el('section', 'panel solve');
  root.append(title, body);

  const render = (): void => {
    const { locale } = store.current;
    title.textContent = translate(locale, 'solve.title');

    if (log.count < 3) {
      fill(body, el('p', 'note note--live', translate(locale, 'solve.needMore')));
      return;
    }

    const pair = widestPair(log.entries);
    const full = solveFromAll(log.entries);
    const sections: HTMLElement[] = [];

    if (pair) {
      const [near, far] = pair;
      const simple = solveFromTwo(near, far);
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
      el(
        'p',
        'solve__step',
        translate(locale, 'solve.comparison', {
          percent: percent(locale, Math.abs(full.percentError)),
        }),
      ),
      el('p', 'note', translate(locale, 'solve.roemer')),
    );
    sections.push(careful);

    fill(body, ...sections);
  };

  log.subscribe(render);
  return { root, render };
}

/**
 * Lateness against distance. The points lie on a line; its steepness is how long
 * light takes to cross one AU, and therefore the speed.
 */
function plot(store: Store, solution: FullSolution): HTMLElement {
  const { locale } = store.current;

  const distances = solution.points.map((p) => p.distanceAu);
  const minutes = solution.points.map((p) => p.latenessSeconds / 60);
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
    dot.style.setProperty('--y', `${toY(point.latenessSeconds / 60)}%`);
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
