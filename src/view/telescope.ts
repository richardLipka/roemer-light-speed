/**
 * The eyepiece: Jupiter and four points of light strung out beside it.
 *
 * A separate panel rather than a zoom state of the map, because it answers a
 * different question — what an observer actually sees — and because this is
 * where eclipses get timed. The moons are projected onto the line of sight, so
 * they slide along one axis exactly as they do through a small telescope, and
 * the watched moon fades out over its real three and a half minutes.
 *
 * Everything here is drawn from the **seen** positions. That is the point of the
 * panel: it is the view down the tube, light delay and all.
 *
 * The first version drew nothing visible, twice over: percentages written into
 * `translate` resolve against the element's own six-pixel box rather than the
 * strip (see `map.ts`), and even corrected, Callisto at 45% of the half-width
 * left Io eleven pixels from Jupiter's limb. Hence `left`/`top` positioning and
 * a zoom that starts well above 1.
 */

import { AU_IN_KM } from '@orrery/core';

import { translate } from '../i18n/i18n.js';
import { GALILEAN_IDS, JUPITER_SHADOW_RADIUS_KM } from '../physics/constants.js';
import type { Store } from '../state/store.js';
import { el } from './dom.js';
import type { Scene } from './scene.js';

const OUTERMOST_AU = 1_882_700 / AU_IN_KM;
const JUPITER_RADIUS_AU = JUPITER_SHADOW_RADIUS_KM / AU_IN_KM;

export interface TelescopeView {
  root: HTMLElement;
  render(scene: Scene): void;
}

export function createTelescope(store: Store): TelescopeView {
  const planet = el('div', 'telescope__planet');
  const field = el('div', 'telescope__field');
  field.append(planet);

  const markers = GALILEAN_IDS.map((id) => {
    const node = el('div', `telescope__moon telescope__moon--${id}`);
    const name = el('span', 'telescope__name');
    node.append(name);
    field.append(node);
    return { id, node, name };
  });

  const title = el('h2', 'panel__title');
  const status = el('p', 'telescope__status');
  const hint = el('p', 'note');

  const root = el('section', 'panel telescope');
  root.append(title, field, status, hint);

  return {
    root,
    render(scene) {
      const { locale, moon: watched, moonZoom } = store.current;
      title.textContent = translate(locale, 'telescope.title');
      hint.textContent = translate(locale, 'telescope.hint');

      // Half the strip covers Callisto's orbit at zoom 1; the zoom then pushes
      // the inner moons out to where they can be told apart.
      const unit = 45 / (OUTERMOST_AU / moonZoom);

      // Jupiter's disc is drawn to the same scale as the separations, so the
      // moons' distances read against the planet's size the way they do in an
      // eyepiece. At zoom 1 that disc is genuinely tiny, which is honest.
      planet.style.setProperty('--diameter', `${JUPITER_RADIUS_AU * unit * 2}%`);

      for (const marker of markers) {
        const moon = scene.moons.find((m) => m.id === marker.id);
        if (!moon) continue;

        // A telescope shows the offset *across* the line of sight, not the
        // moon's place in its orbit — so only one coordinate survives, and it
        // is measured square to the Earth–Jupiter line rather than along the
        // ecliptic x axis. See `scene.ts`.
        marker.node.style.setProperty('--x', `${50 + moon.acrossAu * unit}%`);
        marker.node.classList.toggle('telescope__moon--eclipsed', moon.eclipsed);
        marker.node.classList.toggle('telescope__moon--watched', marker.id === watched);
        // Occulted: further away than Jupiter and within its disc. Hidden the
        // same way an eclipse hides it, because an observer at the eyepiece
        // cannot tell the two apart either.
        marker.node.classList.toggle(
          'telescope__moon--behind',
          moon.behindPlanet && Math.abs(moon.acrossAu) < JUPITER_RADIUS_AU,
        );
        marker.name.textContent = translate(locale, `moon.${marker.id}`);
      }

      const target = scene.moons.find((m) => m.id === watched);
      status.textContent = translate(
        locale,
        target?.eclipsed ? 'telescope.inShadow' : 'telescope.visible',
        { moon: translate(locale, `moon.${watched}`) },
      );
    },
  };
}
