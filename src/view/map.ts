/**
 * The plan view: Sun, Earth, Jupiter, and the line between the last two.
 *
 * Drawn with CSS custom properties on DOM nodes — no canvas, no SVG, per
 * CLAUDE.md §3. Each tick writes `--x`, `--y` and `--angle`; the stylesheet does
 * the rest, so a frame costs the compositor a transform and nothing else.
 *
 * This view carries **no ghost markers**. Jupiter's light-time offset is 0.009
 * of a pixel at this scale (§9), and inflating it to make a point would be the
 * one lie the app cannot afford. What this view shows is the quantity that
 * *causes* the delay — how far apart Earth and Jupiter are — and the Jovian
 * inset shows the delay itself, where it runs to whole degrees.
 */

import { el } from './dom.js';
import type { Scene } from './scene.js';

/** Map radius in AU. Jupiter's aphelion is 5.46, so this keeps it on the map. */
const MAP_RADIUS_AU = 5.8;

export interface MapView {
  root: HTMLElement;
  render(scene: Scene): void;
}

export function createMap(): MapView {
  const sun = el('div', 'body body--sun');
  const earth = el('div', 'body body--earth');
  const jupiter = el('div', 'body body--jupiter');
  const sightline = el('div', 'sightline');

  const root = el('div', 'map');
  root.append(
    el('div', 'orbit orbit--earth'),
    el('div', 'orbit orbit--jupiter'),
    sightline,
    sun,
    earth,
    jupiter,
  );

  const place = (node: HTMLElement, x: number, y: number) => {
    node.style.setProperty('--x', `${(x / MAP_RADIUS_AU) * 50}%`);
    // Screen y runs downwards; the ecliptic plane does not.
    node.style.setProperty('--y', `${(-y / MAP_RADIUS_AU) * 50}%`);
  };

  return {
    root,
    render(scene) {
      place(sun, scene.sun.x, scene.sun.y);
      place(earth, scene.earth.x, scene.earth.y);
      place(jupiter, scene.jupiter.x, scene.jupiter.y);

      // The Earth–Jupiter line: the distance the light has to cross, and the
      // only thing on this view that changes the answer.
      const dx = scene.jupiter.x - scene.earth.x;
      const dy = scene.jupiter.y - scene.earth.y;
      place(sightline, scene.earth.x, scene.earth.y);
      sightline.style.setProperty('--angle', `${Math.atan2(-dy, dx)}rad`);
      sightline.style.setProperty(
        '--length',
        `${(Math.hypot(dx, dy) / MAP_RADIUS_AU) * 50}%`,
      );
    },
  };
}
