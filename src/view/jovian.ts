/**
 * The Jovian system, enlarged — and the one place the light-time offset is
 * actually legible.
 *
 * Io covers 5 to 7 degrees of its orbit in the time its light takes to reach
 * Earth, so here the "where we see it / where it really is" pair separates
 * visibly, drawn honestly and to scale within this inset. Nothing is
 * exaggerated: the *radii* are stretched, the same way the orrery stretches
 * them, because at true scale Io sits a fraction of a pixel from Jupiter — but
 * the angular offset between the two markers, which is the quantity being
 * taught, is untouched.
 */

import { el } from './dom.js';
import { GALILEAN_IDS } from '../physics/constants.js';
import type { Scene } from './scene.js';

/**
 * Radii, as fractions of the inset. Linear in the true distance, so the 4.5:1
 * spread from Io to Callisto — and therefore the 1:2:4 spacing that makes the
 * system worth looking at — survives the stretch.
 */
const OUTERMOST_AU = 1_882_700 / 149_597_870.7; // Callisto
const EDGE = 0.44;

export interface JovianView {
  root: HTMLElement;
  render(scene: Scene): void;
}

export function createJovian(): JovianView {
  const root = el('div', 'jovian');
  const shadow = el('div', 'jovian__shadow');
  const planet = el('div', 'jovian__planet');
  root.append(shadow, planet);

  const markers = GALILEAN_IDS.map((id) => {
    const orbit = el('div', `jovian__orbit jovian__orbit--${id}`);
    const seen = el('div', `moon moon--${id}`);
    const actual = el('div', `moon moon--${id} moon--actual`);
    const link = el('div', 'moon__link');
    root.append(orbit, link, actual, seen);
    return { id, seen, actual, link, orbit };
  });

  const place = (node: HTMLElement, x: number, y: number) => {
    node.style.setProperty('--x', `${(x / OUTERMOST_AU) * EDGE * 100}%`);
    node.style.setProperty('--y', `${(-y / OUTERMOST_AU) * EDGE * 100}%`);
  };

  return {
    root,
    render(scene) {
      for (const marker of markers) {
        const moon = scene.moons.find((m) => m.id === marker.id);
        if (!moon) continue;

        place(marker.seen, moon.seen.x, moon.seen.y);
        place(marker.actual, moon.actual.x, moon.actual.y);
        marker.seen.classList.toggle('moon--eclipsed', moon.eclipsed);

        // The link line, from what we see to where it really is. Short, and it
        // is meant to be — this is a real quantity, not a dramatised one.
        const dx = moon.actual.x - moon.seen.x;
        const dy = moon.actual.y - moon.seen.y;
        place(marker.link, moon.seen.x, moon.seen.y);
        marker.link.style.setProperty('--angle', `${Math.atan2(-dy, dx)}rad`);
        marker.link.style.setProperty(
          '--length',
          `${(Math.hypot(dx, dy) / OUTERMOST_AU) * EDGE * 100}%`,
        );
      }

      // The shadow points away from the Sun; on this inset that is the bearing
      // from Jupiter directly opposite the Sun's.
      const angle = Math.atan2(
        -(scene.jupiter.y - scene.sun.y),
        scene.jupiter.x - scene.sun.x,
      );
      shadow.style.setProperty('--angle', `${angle}rad`);
    },
  };
}
