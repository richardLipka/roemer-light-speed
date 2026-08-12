/**
 * The Jovian system, enlarged — and the one place the light-time offset is
 * actually legible.
 *
 * Io covers 5 to 7 degrees of its orbit in the time its light takes to reach
 * Earth, so the "where we see it / where it really is" pair separates visibly
 * here. Nothing about that separation is exaggerated: the orbital *radii* are
 * stretched, the way the orrery stretches them, because at true scale Io sits a
 * fraction of a pixel from Jupiter — but the angle between the two markers, the
 * quantity being taught, is untouched by that stretch.
 *
 * The shadow is drawn from the same Sun-and-Jupiter geometry the plan view
 * uses, so the two drawings agree about which way the shadow points. Both come
 * from one `Scene`; see `scene.ts`.
 *
 * Positioned with `left`/`top` rather than `translate`, for the reason set out
 * at the head of `map.ts`.
 */

import { AU_IN_KM } from '@orrery/core';

import { translate } from '../i18n/i18n.js';
import { GALILEAN_IDS } from '../physics/constants.js';
import type { Store } from '../state/store.js';
import { el } from './dom.js';
import { number } from './format.js';
import type { Scene } from './scene.js';

/** Callisto's orbit — the widest the inset has to hold, at zoom 1. */
const OUTERMOST_AU = 1_882_700 / AU_IN_KM;

export interface JovianView {
  root: HTMLElement;
  render(scene: Scene): void;
}

export function createJovian(store: Store): JovianView {
  const shadow = el('div', 'jovian__shadow');
  const planet = el('div', 'jovian__planet');
  const field = el('div', 'jovian__field');
  field.append(shadow, planet);

  const markers = GALILEAN_IDS.map((id) => {
    const orbit = el('div', `jovian__orbit jovian__orbit--${id}`);
    const link = el('div', 'moon__link');
    const actual = el('div', `moon moon--${id} moon--actual`);
    const seen = el('div', `moon moon--${id}`);
    field.append(orbit, link, actual, seen);
    return { id, seen, actual, link, orbit };
  });

  const title = el('h2', 'panel__title');
  const caption = el('p', 'jovian__caption');
  // Why these four bodies are a clock at all. Without it the inset is a pretty
  // diagram; with it, it is the premise the whole measurement rests on.
  const clock = el('p', 'note');

  const root = el('div', 'jovian');
  root.append(title, field, caption, clock);

  return {
    root,
    render(scene) {
      const { locale, moonZoom, moon: watched } = store.current;
      const unit = 45 / (OUTERMOST_AU / moonZoom);

      const place = (node: HTMLElement, x: number, y: number) => {
        node.style.setProperty('--x', `${50 + x * unit}%`);
        node.style.setProperty('--y', `${50 - y * unit}%`);
      };

      for (const marker of markers) {
        const moon = scene.moons.find((m) => m.id === marker.id);
        if (!moon) continue;

        place(marker.seen, moon.seen.x, moon.seen.y);
        place(marker.actual, moon.actual.x, moon.actual.y);
        marker.seen.classList.toggle('moon--eclipsed', moon.eclipsed);
        marker.seen.classList.toggle('moon--watched', marker.id === watched);

        const radiusAu = Math.hypot(moon.seen.x, moon.seen.y);
        marker.orbit.style.setProperty('--diameter', `${radiusAu * unit * 2}%`);

        const dx = moon.actual.x - moon.seen.x;
        const dy = moon.actual.y - moon.seen.y;
        place(marker.link, moon.seen.x, moon.seen.y);
        marker.link.style.setProperty('--angle', `${Math.atan2(-dy, dx)}rad`);
        marker.link.style.setProperty('--length', `${Math.hypot(dx, dy) * unit}%`);
      }

      // The shadow runs directly away from the Sun.
      const angle = Math.atan2(-(scene.jupiter.y - scene.sun.y), scene.jupiter.x - scene.sun.x);
      shadow.style.setProperty('--angle', `${angle}rad`);
      shadow.style.setProperty('--length', `${OUTERMOST_AU * unit * 1.4}%`);

      title.textContent = translate(locale, 'jovian.title');
      clock.textContent = translate(locale, 'jovian.clock');

      const target = scene.moons.find((m) => m.id === watched);
      caption.textContent = target
        ? translate(locale, 'jovian.caption', {
            moon: translate(locale, `moon.${watched}`),
            degrees: number(locale, target.ghostSeparationDegrees, 1),
            minutes: number(locale, scene.lightTimeMinutes, 1),
          })
        : '';
      void planet;
    },
  };
}
