/**
 * How the delay changes as Earth and Jupiter move — the whole effect in one
 * picture, before any measurement is taken.
 *
 * This is *not* the measurement plot in `solveView.ts`. That one is drawn from
 * the student's own readings and answers "what did you get". This one is drawn
 * from the model and answers "why is there anything to measure at all": the
 * light takes about 33 minutes when Jupiter is nearest and 52 when it is
 * furthest, and the difference is the width of Earth's orbit.
 *
 * CLAUDE.md §3 previously ruled out any standing plot of the app's own numbers,
 * on the grounds that it answers the question before the student asks it. That
 * was about the *residual* plot, which hands over the result. This curve hands
 * over the setup — where in the cycle to look, and why the effect is larger at
 * some times than others — which a student cannot easily discover by scrubbing a
 * timeline, and asking them to is not teaching.
 *
 * **Drawn as dots, not as rotated segments.** A percentage width resolves
 * against the parent's *width* while a percentage top resolves against its
 * *height*, so the length of a sloped line cannot be written as one percentage
 * unless the box happens to be square. Two hundred dots read as a curve and are
 * simply correct.
 */

import { jdFromCalendar } from '@orrery/core';

import { translate } from '../i18n/i18n.js';
import { delayCurve, extremaBetween } from '../physics/configuration.js';
import type { Store } from '../state/store.js';
import { el } from './dom.js';
import { date, number } from './format.js';
import { scenePositions } from './scene.js';

/** Three years — a little over two and a half of Jupiter's synodic cycles. */
const SPAN_DAYS = 3 * 365;
const START = jdFromCalendar(1676, 1, 1);

export interface DelayCurveView {
  root: HTMLElement;
  render(jd: number): void;
}

export function createDelayCurve(store: Store): DelayCurveView {
  const title = el('h2', 'panel__title');
  const intro = el('p', 'note');
  const field = el('div', 'curve__field');
  const axisHigh = el('span', 'curve__tick curve__tick--high');
  const axisLow = el('span', 'curve__tick curve__tick--low');
  const caption = el('p', 'curve__caption');

  const plot = el('div', 'curve__plot');
  plot.append(axisHigh, axisLow, field);

  const root = el('section', 'panel curve');
  root.append(title, intro, plot, caption);

  // A fixed window, computed once. A curve sliding under a playhead would be
  // unreadable, and the point is to see where in the cycle you are.
  const samples = delayCurve(scenePositions, START, START + SPAN_DAYS, 3);
  const marks = extremaBetween(scenePositions, START, START + SPAN_DAYS);

  const minutes = samples.map((s) => s.minutes);
  const low = Math.min(...minutes);
  const high = Math.max(...minutes);
  const yMin = Math.floor(low - 1);
  const yMax = Math.ceil(high + 1);

  const toX = (jd: number) => ((jd - START) / SPAN_DAYS) * 100;
  const toY = (m: number) => (1 - (m - yMin) / (yMax - yMin)) * 100;

  const playhead = el('div', 'curve__playhead');

  const nodes: HTMLElement[] = samples.map((sample) => {
    const dot = el('div', 'curve__dot');
    dot.style.setProperty('--x', `${toX(sample.jd)}%`);
    dot.style.setProperty('--y', `${toY(sample.minutes)}%`);
    return dot;
  });

  const markNodes = marks.map((mark) => {
    const node = el('div', `curve__mark curve__mark--${mark.kind}`);
    node.style.setProperty('--x', `${toX(mark.jd)}%`);
    return node;
  });

  field.append(...nodes, ...markNodes, playhead);

  return {
    root,
    render(jd) {
      const { locale } = store.current;
      title.textContent = translate(locale, 'curve.title');
      intro.textContent = translate(locale, 'curve.intro', {
        low: number(locale, low, 0),
        high: number(locale, high, 0),
      });
      axisHigh.textContent = `${yMax} min`;
      axisLow.textContent = `${yMin} min`;

      for (let i = 0; i < marks.length; i++) {
        markNodes[i]!.title = `${translate(locale, `curve.${marks[i]!.kind}`)} — ${date(
          locale,
          marks[i]!.jd,
        )}`;
      }

      // The clock can be anywhere; the curve covers a fixed window. Beyond the
      // ends the playhead parks at the edge rather than drawing outside the axes.
      const clamped = Math.min(Math.max(jd, START), START + SPAN_DAYS);
      playhead.style.setProperty('--x', `${toX(clamped)}%`);
      playhead.classList.toggle('curve__playhead--offscale', clamped !== jd);

      caption.textContent = translate(locale, 'curve.caption', {
        from: date(locale, START),
        to: date(locale, START + SPAN_DAYS),
      });
    },
  };
}
