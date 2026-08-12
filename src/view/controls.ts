/**
 * The left dock: everything that changes what the instrument is doing.
 *
 * Time, magnification, which moon, and the three jumps that matter. Nothing
 * here reports a measurement — that is the right dock's job — so a student
 * looking for a control never has to read past a number and a student reading a
 * number never has to scroll past a control.
 *
 * The two jump buttons are the answer to "the difference is bigger at some
 * times of year than others": rather than asking anyone to scrub a timeline for
 * six months, they land on the nearest and furthest approach directly.
 */

import { translate } from '../i18n/i18n.js';
import { GALILEAN_IDS } from '../physics/constants.js';
import { MAX_MAP_ZOOM, MAX_MOON_ZOOM, MIN_ZOOM, RATE_LADDER, type Store } from '../state/store.js';
import { button, el } from './dom.js';
import { number } from './format.js';

export interface ControlsView {
  root: HTMLElement;
  render(): void;
}

export interface ControlActions {
  toggleClock(): void;
  nextEclipse(): void;
  jumpNearest(): void;
  jumpFurthest(): void;
}

export function createControls(store: Store, actions: ControlActions): ControlsView {
  const root = el('section', 'panel controls');

  const render = (): void => {
    const { locale, rateIndex, mapZoom, moonZoom, moon } = store.current;
    const running = store.clock.isRunning;

    const group = (labelKey: string, ...children: (Node | string)[]) => {
      const node = el('div', 'controls__group');
      node.append(el('h3', 'controls__label', translate(locale, labelKey)), ...children);
      return node;
    };

    // --- time ---
    const transport = el('div', 'controls__row');
    transport.append(
      button('button', translate(locale, running ? 'clock.pause' : 'clock.play'), () => {
        actions.toggleClock();
        render();
      }),
      button('button button--quiet', '−', () =>
        store.patch({ rateIndex: Math.max(0, rateIndex - 1) }),
      ),
      el('span', 'controls__readout', `${number(locale, RATE_LADDER[rateIndex] ?? 1, 3)} d/s`),
      button('button button--quiet', '+', () =>
        store.patch({ rateIndex: Math.min(RATE_LADDER.length - 1, rateIndex + 1) }),
      ),
    );

    // --- jumps ---
    const jumps = el('div', 'controls__column');
    jumps.append(
      button('button', translate(locale, 'clock.nextEclipse'), actions.nextEclipse),
      button('button', translate(locale, 'clock.jumpNearest'), actions.jumpNearest),
      button('button', translate(locale, 'clock.jumpFurthest'), actions.jumpFurthest),
    );

    // --- zoom ---
    const mapZoomRow = slider(
      translate(locale, 'zoom.map'),
      mapZoom,
      MIN_ZOOM,
      MAX_MAP_ZOOM,
      (value) => store.patch({ mapZoom: value }),
    );
    const moonZoomRow = slider(
      translate(locale, 'zoom.moons'),
      moonZoom,
      MIN_ZOOM,
      MAX_MOON_ZOOM,
      (value) => store.patch({ moonZoom: value }),
    );

    // --- which moon ---
    const moons = el('div', 'controls__row');
    for (const id of GALILEAN_IDS) {
      const chip = button(
        `chip${id === moon ? ' chip--active' : ''}`,
        translate(locale, `moon.${id}`),
        () => store.patch({ moon: id }),
      );
      moons.append(chip);
    }

    root.replaceChildren(
      group('controls.time', transport, jumps),
      group('controls.zoom', mapZoomRow, moonZoomRow),
      group('controls.moon', moons),
      button('button button--quiet', translate(locale, 'walkthrough.title'), () =>
        store.patch({ panel: 'walkthrough' }),
      ),
    );
  };

  return { root, render };
}

function slider(
  label: string,
  value: number,
  min: number,
  max: number,
  onChange: (value: number) => void,
): HTMLElement {
  const input = el('input', 'controls__slider');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = '0.5';
  input.value = String(value);
  input.addEventListener('input', () => onChange(Number(input.value)));

  const row = el('label', 'controls__sliderRow');
  row.append(el('span', 'controls__sliderLabel', label), input, el('span', 'controls__readout', `${value}×`));
  return row;
}
