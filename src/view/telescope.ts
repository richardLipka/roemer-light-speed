/**
 * The eyepiece: Jupiter and four points of light strung out beside it.
 *
 * A separate panel rather than a zoom state of the map, because it answers a
 * different question — what an observer actually sees — and because this is
 * where eclipses get timed. The moons are projected onto the line of sight, so
 * they slide back and forth along one axis exactly as they do through a small
 * telescope, and Io fades out over its real three and a half minutes.
 *
 * Everything here is drawn from the **seen** positions. That is the point of the
 * panel: it is the view down the tube, light delay and all.
 */

import { translate } from '../i18n/i18n.js';
import { GALILEAN_IDS } from '../physics/constants.js';
import type { Store } from '../state/store.js';
import { el } from './dom.js';
import type { Scene } from './scene.js';

/** Callisto's orbit, in AU — the widest excursion the strip has to hold. */
const OUTERMOST_AU = 1_882_700 / 149_597_870.7;

export interface TelescopeView {
  root: HTMLElement;
  render(scene: Scene): void;
}

export function createTelescope(store: Store): TelescopeView {
  const field = el('div', 'telescope__field');
  const planet = el('div', 'telescope__planet');
  field.append(planet);

  const markers = GALILEAN_IDS.map((id) => {
    const node = el('div', `telescope__moon telescope__moon--${id}`);
    field.append(node);
    return { id, node };
  });

  const title = el('h2', 'panel__title');
  const status = el('p', 'telescope__status');
  const hint = el('p', 'note');

  const root = el('section', 'panel telescope');
  root.append(title, field, status, hint);

  return {
    root,
    render(scene) {
      const { locale, moon: watched } = store.current;
      title.textContent = translate(locale, 'telescope.title');
      hint.textContent = translate(locale, 'telescope.hint');

      for (const marker of markers) {
        const moon = scene.moons.find((m) => m.id === marker.id);
        if (!moon) continue;

        // Projected onto one axis: what a telescope shows is the offset across
        // the line of sight, not the moon's place in its orbit.
        marker.node.style.setProperty('--x', `${(moon.seen.x / OUTERMOST_AU) * 45}%`);
        marker.node.classList.toggle('telescope__moon--eclipsed', moon.eclipsed);
        marker.node.classList.toggle('telescope__moon--watched', marker.id === watched);
      }

      const target = scene.moons.find((m) => m.id === watched);
      status.textContent = translate(
        locale,
        target?.eclipsed ? 'telescope.inShadow' : 'telescope.visible',
      );
      void planet;
    },
  };
}
