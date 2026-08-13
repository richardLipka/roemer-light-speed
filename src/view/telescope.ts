/**
 * The eyepiece: Jupiter and four points of light strung out beside it — twice.
 *
 * A separate panel rather than a zoom state of the map, because it answers a
 * different question — what an observer actually sees — and because this is
 * where eclipses get timed. The moons are projected onto the line of sight, so
 * they slide along one axis exactly as they do through a small telescope, and
 * the watched moon fades out over its real three and a half minutes.
 *
 * **Two lanes, and the second one is the argument.** The upper lane is the view
 * down the tube: light delay and all, the only thing anybody has ever seen. The
 * lower lane is the same system at this instant, drawn as if light were
 * infinitely fast — the picture nature refuses to send. Run an eclipse at ten
 * times real time and the point makes itself: the lower moon went dark half an
 * hour ago and the upper one is still shining, because the news is still in
 * flight. One lane, and that has to be asserted in prose; two, and it is simply
 * visible.
 *
 * Keeping them in separate lanes rather than overlaying a ghost is deliberate.
 * The upper lane has to stay *purely* what an observer sees, or the panel stops
 * being evidence and becomes an illustration.
 *
 * The first version drew nothing visible, twice over: percentages written into
 * `translate` resolve against the element's own six-pixel box rather than the
 * strip (see `map.ts`), and even corrected, Callisto at 45% of the half-width
 * left Io eleven pixels from Jupiter's limb. Hence `left`/`top` positioning and
 * a zoom that starts well above 1.
 */

import { AU_IN_KM, BODIES } from '@orrery/core';

import { translate } from '../i18n/i18n.js';
import { GALILEAN_IDS, type GalileanId, JUPITER_SHADOW_RADIUS_KM } from '../physics/constants.js';
import type { TimingMode } from '../physics/solve.js';
import { MAX_MOON_ZOOM, MIN_ZOOM, type Store } from '../state/store.js';
import { el } from './dom.js';
import { number } from './format.js';
import type { Scene } from './scene.js';
import { wheelZoom } from './wheelZoom.js';

const OUTERMOST_AU = 1_882_700 / AU_IN_KM;
const JUPITER_RADIUS_AU = JUPITER_SHADOW_RADIUS_KM / AU_IN_KM;

/**
 * The magnification that puts one moon's orbit at a comfortable size.
 *
 * A fixed close-up zoom cannot work, because the four orbits differ by a factor
 * of four and a half. Set high enough to be worth it for Io, and Callisto is
 * thrown clean off the field — the close-up of a Callisto eclipse would show an
 * empty strip. So the zoom is worked out from the moon being watched, aiming its
 * orbit at about seven tenths of the half-width: far enough from Jupiter to
 * watch the fade, near enough to stay on screen.
 *
 * Callisto defines the strip at zoom 1 and so asks for less than that; the floor
 * is where it lands, which is correct — it is already as large as it goes.
 */
export function closeUpZoom(moon: GalileanId): number {
  const radiusAu = BODIES[moon].satellite?.a;
  if (!radiusAu) return MIN_ZOOM;
  return Math.min(MAX_MOON_ZOOM, Math.max(MIN_ZOOM, (0.7 * OUTERMOST_AU) / radiusAu));
}

export interface TelescopeView {
  root: HTMLElement;
  render(scene: Scene): void;
}

interface Lane {
  mode: TimingMode;
  root: HTMLElement;
  planet: HTMLElement;
  caption: HTMLElement;
  markers: { id: GalileanId; node: HTMLElement; name: HTMLElement }[];
}

function createLane(mode: TimingMode): Lane {
  const root = el('div', `telescope__lane telescope__lane--${mode}`);
  const planet = el('div', 'telescope__planet');
  const caption = el('span', 'telescope__laneLabel');
  root.append(caption, planet);

  const markers = GALILEAN_IDS.map((id) => {
    const node = el('div', `telescope__moon telescope__moon--${id}`);
    const name = el('span', 'telescope__name');
    node.append(name);
    root.append(node);
    return { id, node, name };
  });

  return { mode, root, planet, caption, markers };
}

export function createTelescope(store: Store): TelescopeView {
  const lanes = [createLane('seen'), createLane('true')];

  const field = el('div', 'telescope__field');
  field.append(lanes[0]!.root, lanes[1]!.root);

  wheelZoom(field, {
    read: () => store.current.moonZoom,
    write: (moonZoom) => store.patch({ moonZoom }),
    min: MIN_ZOOM,
    max: MAX_MOON_ZOOM,
  });

  const title = el('h2', 'panel__title');
  const status = el('p', 'telescope__status');
  const delay = el('p', 'note note--live telescope__delay');
  const hint = el('p', 'note');

  const root = el('section', 'panel telescope');
  root.append(title, field, status, delay, hint);

  return {
    root,
    render(scene) {
      const { locale, moon: watched, moonZoom, timingMode } = store.current;
      title.textContent = translate(locale, 'telescope.title');
      hint.textContent = translate(locale, 'telescope.hint');

      // Half the strip covers Callisto's orbit at zoom 1; the zoom then pushes
      // the inner moons out to where they can be told apart.
      const unit = 45 / (OUTERMOST_AU / moonZoom);

      for (const lane of lanes) {
        const seen = lane.mode === 'seen';

        // Jupiter's disc is drawn to the same scale as the separations, so the
        // moons' distances read against the planet's size the way they do in an
        // eyepiece. At zoom 1 that disc is genuinely tiny, which is honest.
        lane.planet.style.setProperty('--diameter', `${JUPITER_RADIUS_AU * unit * 2}%`);
        lane.caption.textContent = translate(locale, `telescope.lane.${lane.mode}`);
        // The lane you are timing against carries the mark, so a press always
        // has a visible target rather than an option buried in the left dock.
        lane.root.classList.toggle('telescope__lane--armed', lane.mode === timingMode);

        for (const marker of lane.markers) {
          const moon = scene.moons.find((m) => m.id === marker.id);
          if (!moon) continue;

          // A telescope shows the offset *across* the line of sight, not the
          // moon's place in its orbit — so only one coordinate survives, and it
          // is measured square to the Earth–Jupiter line rather than along the
          // ecliptic x axis. See `scene.ts`.
          const across = seen ? moon.acrossAu : moon.acrossActualAu;
          const eclipsed = seen ? moon.eclipsed : moon.eclipsedActual;
          const behind = seen ? moon.behindPlanet : moon.behindPlanetActual;

          marker.node.style.setProperty('--x', `${50 + across * unit}%`);
          marker.node.classList.toggle('telescope__moon--eclipsed', eclipsed);
          marker.node.classList.toggle('telescope__moon--watched', marker.id === watched);
          // Occulted: further away than Jupiter and within its disc. Hidden the
          // same way an eclipse hides it, because an observer at the eyepiece
          // cannot tell the two apart either.
          marker.node.classList.toggle(
            'telescope__moon--behind',
            behind && Math.abs(across) < JUPITER_RADIUS_AU,
          );
          marker.name.textContent = translate(locale, `moon.${marker.id}`);
        }
      }

      const target = scene.moons.find((m) => m.id === watched);
      const inShadow = timingMode === 'seen' ? target?.eclipsed : target?.eclipsedActual;
      status.textContent = translate(locale, inShadow ? 'telescope.inShadow' : 'telescope.visible', {
        moon: translate(locale, `moon.${watched}`),
      });

      // The lower lane *is* the answer, drawn: it shows where the moons really
      // are, and the note beside it says by how many minutes. Both wait for the
      // reveal in the game, leaving the eyepiece alone — which is all Rømer
      // ever had. See `Store.truthVisible`.
      const truth = store.truthVisible;
      lanes[1]!.root.hidden = !truth;
      field.classList.toggle('telescope__field--single', !truth);
      delay.textContent = truth
        ? translate(locale, 'telescope.ageNote', {
            minutes: number(locale, scene.lightTimeMinutes, 1),
          })
        : translate(locale, 'telescope.ageHidden');
    },
  };
}
