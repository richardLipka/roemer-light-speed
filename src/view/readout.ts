/**
 * The two numbers that are the app: how old the light is, and how far Jupiter is.
 *
 * They belong on screen at all times (CLAUDE.md §9). The first is phrased as
 * *"light from Jupiter is 42 minutes old"*, which is the whole idea in five
 * words and needs no diagram to follow.
 */

import { AU_IN_KM } from '@orrery/core';

import { translate } from '../i18n/i18n.js';
import type { Store } from '../state/store.js';
import { el } from './dom.js';
import { date, millionKm, number } from './format.js';
import type { Scene } from './scene.js';

export interface ReadoutView {
  root: HTMLElement;
  render(scene: Scene): void;
}

export function createReadout(store: Store): ReadoutView {
  const lightAge = el('p', 'readout__headline');
  const distance = el('p', 'readout__line');
  const when = el('p', 'readout__line readout__line--muted');

  const root = el('div', 'readout');
  root.append(lightAge, distance, when);

  return {
    root,
    render(scene) {
      const { locale } = store.current;
      lightAge.textContent = translate(locale, 'readout.lightAge', {
        minutes: number(locale, scene.lightTimeMinutes, 1),
      });
      distance.textContent = `${translate(locale, 'readout.distance', {
        millionKm: millionKm(locale, scene.earthJupiterAu * AU_IN_KM),
      })} ${translate(locale, 'readout.distanceAu', {
        au: number(locale, scene.earthJupiterAu, 2),
      })}`;
      when.textContent = `${translate(locale, 'readout.date')}: ${date(locale, scene.jd)}`;
    },
  };
}
