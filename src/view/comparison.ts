/**
 * What you saw against what was there — the panel that explains the difference
 * once the speed has been measured.
 *
 * A student who has just fitted a number to their own timings has the answer but
 * not yet the picture. This says, for the moment now on screen: the light left
 * Jupiter this many minutes ago, so the eyepiece is showing a configuration that
 * many minutes stale, and in that time the moon has moved this far round. The
 * eclipse was over before anyone on Earth could know it had begun.
 *
 * It is deliberately phrased as *the same three numbers, three ways* — a time, an
 * angle, and a distance — because they are one fact and a student who sees them
 * as three has not got it yet.
 */

import { AU_IN_KM } from '@orrery/core';

import { translate } from '../i18n/i18n.js';
import { solveFromAll } from '../physics/solve.js';
import type { ObservationLog } from '../state/log.js';
import type { Store } from '../state/store.js';
import { el, fill } from './dom.js';
import { millionKm, number, speed } from './format.js';
import type { Scene } from './scene.js';

export interface ComparisonView {
  root: HTMLElement;
  render(scene: Scene): void;
}

export function createComparison(store: Store, log: ObservationLog): ComparisonView {
  const title = el('h2', 'panel__title');
  const body = el('div', 'comparison__body');

  const root = el('section', 'panel comparison');
  root.append(title, body);

  // Kept so a change to the log can redraw without waiting for a frame. This
  // panel is the one place the student's own number meets the model's, and it
  // showed "record three observations" for a beat after sixty had been loaded —
  // harmless at 60fps, wrong on a throttled tab, which the app must survive.
  let latest: Scene | null = null;
  log.subscribe(() => {
    if (latest) view.render(latest);
  });

  const view: ComparisonView = {
    root,
    render(scene) {
      latest = scene;
      const { locale, moon: watched } = store.current;
      title.textContent = translate(locale, 'comparison.title');

      const target = scene.moons.find((m) => m.id === watched);
      if (!target) return;

      const moonName = translate(locale, `moon.${watched}`);
      const rows: HTMLElement[] = [
        el('p', 'note', translate(locale, 'comparison.intro')),
        pair(
          locale,
          'comparison.seenLabel',
          translate(locale, 'comparison.seenValue', {
            moon: moonName,
            minutes: number(locale, scene.lightTimeMinutes, 1),
          }),
        ),
        pair(
          locale,
          'comparison.actualLabel',
          translate(locale, 'comparison.actualValue', {
            moon: moonName,
            degrees: number(locale, target.ghostSeparationDegrees, 1),
          }),
        ),
        pair(
          locale,
          'comparison.gapLabel',
          translate(locale, 'comparison.gapValue', {
            millionKm: millionKm(locale, scene.earthJupiterAu * AU_IN_KM),
          }),
        ),
      ];

      // Once they have a number of their own, close the loop with it: this is
      // what your measurement says the delay should be, and here is the delay
      // the model is actually showing.
      if (log.count >= 3) {
        const solution = solveFromAll(log.entries);
        const theirMinutes = (scene.earthJupiterAu * (AU_IN_KM / solution.speedKmPerS)) / 60;
        rows.push(
          el('hr', 'comparison__rule'),
          pair(
            locale,
            'comparison.yoursLabel',
            translate(locale, 'comparison.yoursValue', {
              speed: speed(locale, solution.speedKmPerS),
              minutes: number(locale, theirMinutes, 1),
            }),
          ),
          el(
            'p',
            'note note--live',
            translate(locale, 'comparison.yoursNote', {
              minutes: number(locale, Math.abs(theirMinutes - scene.lightTimeMinutes), 1),
            }),
          ),
        );
      } else {
        rows.push(el('p', 'note note--live', translate(locale, 'comparison.needMeasurement')));
      }

      fill(body, ...rows);
    },
  };

  return view;
}

function pair(locale: 'cs' | 'en', labelKey: string, value: string): HTMLElement {
  const row = el('div', 'comparison__row');
  row.append(
    el('span', 'comparison__label', translate(locale, labelKey)),
    el('span', 'comparison__value', value),
  );
  return row;
}
