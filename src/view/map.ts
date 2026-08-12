/**
 * The plan view: Sun, Earth, Jupiter, and the line between the last two.
 *
 * Drawn with CSS custom properties on DOM nodes — no canvas, no SVG, per
 * CLAUDE.md §3. Each tick writes `--x`, `--y` and `--angle`.
 *
 * **Position with `left`/`top`, never with `translate`.** A percentage in
 * `translate` resolves against the element's *own* box, so writing `--x: 45%`
 * onto a 14-pixel marker moves it seven pixels and the whole solar system piles
 * up in the middle of the map. A percentage in `left`/`top` resolves against the
 * containing block, which is what these numbers mean. The first version of this
 * file got that wrong and every body sat within ten pixels of the Sun.
 *
 * This view carries **no ghost markers**. Jupiter's light-time offset is 0.009
 * of a pixel at this scale (§9), and inflating it to make a point would be the
 * one lie the app cannot afford. What it shows instead is the quantity that
 * *causes* the delay — how far apart Earth and Jupiter are — with the delay
 * itself written on the line in minutes.
 */

import { translate } from '../i18n/i18n.js';
import type { Store } from '../state/store.js';
import { el } from './dom.js';
import { number } from './format.js';
import type { Scene } from './scene.js';

/** Map radius in AU at zoom 1. Jupiter's aphelion is 5.46, so it stays on. */
const MAP_RADIUS_AU = 5.9;

export interface MapView {
  root: HTMLElement;
  render(scene: Scene): void;
}

export function createMap(store: Store): MapView {
  const sun = el('div', 'body body--sun');
  const earth = el('div', 'body body--earth');
  const jupiter = el('div', 'body body--jupiter');
  const sightline = el('div', 'sightline');
  const label = el('div', 'sightline__label');
  const earthOrbit = el('div', 'orbit orbit--earth');
  const jupiterOrbit = el('div', 'orbit orbit--jupiter');

  const field = el('div', 'map__field');
  field.append(earthOrbit, jupiterOrbit, sightline, label, sun, earth, jupiter);

  const root = el('div', 'map');
  root.append(field);

  return {
    root,
    render(scene) {
      const { locale, mapZoom } = store.current;
      const unit = 50 / (MAP_RADIUS_AU / mapZoom);

      const place = (node: HTMLElement, x: number, y: number) => {
        node.style.setProperty('--x', `${50 + x * unit}%`);
        // Screen y runs downwards; the ecliptic plane does not.
        node.style.setProperty('--y', `${50 - y * unit}%`);
      };

      place(sun, scene.sun.x, scene.sun.y);
      place(earth, scene.earth.x, scene.earth.y);
      place(jupiter, scene.jupiter.x, scene.jupiter.y);

      // Orbit rings are sized from the bodies' actual distances rather than
      // from constants, so they follow the zoom without a second source of
      // truth about how big an orbit is.
      const ring = (node: HTMLElement, radiusAu: number) => {
        node.style.setProperty('--diameter', `${radiusAu * unit * 2}%`);
      };
      ring(earthOrbit, Math.hypot(scene.earth.x - scene.sun.x, scene.earth.y - scene.sun.y));
      ring(jupiterOrbit, Math.hypot(scene.jupiter.x - scene.sun.x, scene.jupiter.y - scene.sun.y));

      const dx = scene.jupiter.x - scene.earth.x;
      const dy = scene.jupiter.y - scene.earth.y;
      place(sightline, scene.earth.x, scene.earth.y);
      sightline.style.setProperty('--angle', `${Math.atan2(-dy, dx)}rad`);
      sightline.style.setProperty('--length', `${Math.hypot(dx, dy) * unit}%`);

      // The delay, written where the light actually crosses. This is the only
      // honest way to show it on this view: as a number on the path, not as a
      // gap between markers that would be a hundredth of a pixel wide.
      place(label, (scene.earth.x + scene.jupiter.x) / 2, (scene.earth.y + scene.jupiter.y) / 2);
      label.textContent = translate(locale, 'map.lightTakes', {
        minutes: number(locale, scene.lightTimeMinutes, 1),
      });
    },
  };
}
