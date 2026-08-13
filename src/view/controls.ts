/**
 * The left dock: everything that changes what the instrument is doing.
 *
 * Time, magnification, which moon, and the jumps that matter. Nothing here
 * reports a measurement — that is the right dock's job — so a student looking
 * for a control never has to read past a number and a student reading a number
 * never has to scroll past a control.
 *
 * The jump buttons are the answer to "the difference is bigger at some times of
 * year than others": rather than asking anyone to scrub a timeline for six
 * months, they land on the nearest and furthest approach directly.
 *
 * The clock speed is a **logarithmic** slider. It was seven fixed rungs, and the
 * gaps between them were unusable — see `store.ts`. Log space is the only
 * geometry that makes a range from real time to a year in four seconds fit on
 * one track without the slow end collapsing into the first pixel.
 */

import { translate } from '../i18n/i18n.js';
import { GALILEAN_IDS } from '../physics/constants.js';
import type { TimingMode } from '../physics/solve.js';
import {
  CAMPAIGN_YEARS,
  MAX_MAP_ZOOM,
  MAX_MOON_ZOOM,
  MAX_RATE,
  MIN_RATE,
  RATE_PRESETS,
  type Store,
} from '../state/store.js';
import { button, el } from './dom.js';
import { number, rate as rateLabel } from './format.js';

/**
 * Positions along the speed track — a thousand, which at seven decades is about
 * a 1.6% change per step. Finer than anyone can drag, and far finer than the
 * seven rungs it replaces.
 */
const RATE_TRACK_STEPS = 1000;

const LOG_MIN = Math.log10(MIN_RATE);
const LOG_SPAN = Math.log10(MAX_RATE) - LOG_MIN;

const rateToTrack = (rate: number): number =>
  ((Math.log10(rate) - LOG_MIN) / LOG_SPAN) * RATE_TRACK_STEPS;

const trackToRate = (track: number): number =>
  10 ** (LOG_MIN + (track / RATE_TRACK_STEPS) * LOG_SPAN);

/**
 * Three significant figures for the typed field.
 *
 * The rate arrives from a slider carrying fifteen digits of float, and a number
 * input showing 8.639999999999999 invites a student to delete it and type
 * something round — which is fine, but the field should not have provoked it.
 */
const round = (value: number): number =>
  value === 0 ? 0 : Number(value.toPrecision(3));

/** Positions along a zoom track. Both zooms start at 1, so the track is log10. */
const ZOOM_TRACK_STEPS = 400;

const zoomToTrack = (zoom: number, max: number): number =>
  (Math.log10(zoom) / Math.log10(max)) * ZOOM_TRACK_STEPS;

const trackToZoom = (track: number, max: number): number =>
  10 ** ((track / ZOOM_TRACK_STEPS) * Math.log10(max));

export interface ControlsView {
  root: HTMLElement;
  render(): void;
}

export interface ControlActions {
  toggleClock(): void;
  nextEclipse(): void;
  watchCloseUp(): void;
  jumpNearest(): void;
  jumpFurthest(): void;
}

export function createControls(store: Store, actions: ControlActions): ControlsView {
  const root = el('section', 'panel controls');

  const render = (): void => {
    const { locale, rateDaysPerSecond, mapZoom, moonZoom, moon, timingMode, campaignYears } =
      store.current;
    const running = store.clock.isRunning;

    const group = (labelKey: string, ...children: (Node | string)[]) => {
      const node = el('div', 'controls__group');
      node.append(el('h3', 'controls__label', translate(locale, labelKey)), ...children);
      return node;
    };

    // --- time ---
    const transport = el('div', 'controls__row');

    // Type the rate outright. The slider is for finding roughly the right pace;
    // this is for pinning it — "run at exactly four seconds of sky per second"
    // is a reasonable thing to want when setting up an observation, and dragging
    // a slider to it is not a reasonable way to ask.
    const exact = el('input', 'controls__exact');
    exact.type = 'number';
    exact.min = String(MIN_RATE * 86_400);
    exact.max = String(MAX_RATE * 86_400);
    exact.step = 'any';
    // Sky seconds per real second: the one unit that spans the whole range as a
    // number a person can read and type. At the slow end it is also the multiple
    // of real time, so "10" means ten times.
    exact.value = String(round(rateDaysPerSecond * 86_400));
    const commit = () => {
      const seconds = Number(exact.value);
      if (Number.isFinite(seconds) && seconds > 0) {
        store.patch({ rateDaysPerSecond: seconds / 86_400 });
      }
    };
    exact.addEventListener('change', commit);
    exact.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Enter') commit();
    });

    // Halve and double. A stepper wants a step you can predict without looking,
    // and on a logarithmic quantity that is a *ratio* — "twice as fast" is a
    // thing a person can hold, where "0.5 d/s more" is not. Twenty-three presses
    // cross the whole seven decades, which is the right coarseness for a control
    // that sits beside a slider covering the range.
    const nudgeRate = (factor: number) =>
      store.patch({ rateDaysPerSecond: rateDaysPerSecond * factor });

    transport.append(
      button('button', translate(locale, running ? 'clock.pause' : 'clock.play'), () => {
        actions.toggleClock();
        render();
      }),
      button('button button--quiet', '−', () => nudgeRate(0.5)),
      el('span', 'controls__readout', rateLabel(locale, rateDaysPerSecond)),
      button('button button--quiet', '+', () => nudgeRate(2)),
      exact,
      el('span', 'controls__unit', translate(locale, 'clock.skySeconds')),
    );

    // Log space: equal distances along the track are equal ratios, so a nudge
    // near real time changes the pace as much as a nudge near a year a second.
    //
    // The track counts 0 to 1000 rather than carrying the logarithm directly,
    // because a range input steps from its *minimum* — with a step of 0.01 on a
    // track running from −4.9365 the grid never lands on the maximum, and
    // dragging fully right gave 99 d/s instead of 100. Whole steps from zero
    // reach both ends exactly.
    const rateSlider = slider({
      label: translate(locale, 'clock.rate'),
      value: rateToTrack(rateDaysPerSecond),
      min: 0,
      max: RATE_TRACK_STEPS,
      step: 1,
      readout: '',
      onChange: (value) => store.patch({ rateDaysPerSecond: trackToRate(value) }),
    });

    const presets = el('div', 'controls__row');
    for (const preset of RATE_PRESETS) {
      // Within a hair of the preset, not exactly on it: the slider quantises to
      // a hundredth of a decade, so landing on one by dragging should still
      // light it up rather than leaving every chip stubbornly dark.
      const active = Math.abs(Math.log10(rateDaysPerSecond / preset)) < 0.02;
      presets.append(
        button(`chip${active ? ' chip--active' : ''}`, rateLabel(locale, preset), () =>
          store.patch({ rateDaysPerSecond: preset }),
        ),
      );
    }

    // --- jumps ---
    const jumps = el('div', 'controls__column');
    jumps.append(
      button('button', translate(locale, 'clock.nextEclipse'), actions.nextEclipse),
      button('button', translate(locale, 'clock.closeUp'), actions.watchCloseUp),
      button('button', translate(locale, 'clock.jumpNearest'), actions.jumpNearest),
      button('button', translate(locale, 'clock.jumpFurthest'), actions.jumpFurthest),
    );

    const nudge = el('p', 'note', translate(locale, 'clock.nudgeHint'));

    // --- which eclipse is being timed ---
    const modes = el('div', 'controls__row');
    for (const mode of ['seen', 'true'] as const satisfies readonly TimingMode[]) {
      modes.append(
        button(`chip${mode === timingMode ? ' chip--active' : ''}`, translate(locale, `timing.${mode}`), () =>
          store.patch({ timingMode: mode }),
        ),
      );
    }
    const modeNote = el('p', 'note note--live', translate(locale, `timing.${timingMode}Note`));

    // --- how long a run of observations covers ---
    const campaign = el('div', 'controls__row');
    for (const years of CAMPAIGN_YEARS) {
      campaign.append(
        button(
          `chip${years === campaignYears ? ' chip--active' : ''}`,
          translate(locale, 'campaign.years', { years: number(locale, years, 0) }),
          () => store.patch({ campaignYears: years }),
        ),
      );
    }
    const campaignNote = el('p', 'note', translate(locale, 'campaign.note'));

    // --- zoom ---
    //
    // Logarithmic, like the wheel and for the same reason: a step of half a
    // magnification is a doubling at the bottom of the range and nothing at the
    // top. Equal distances along the track are equal ratios, so the slider and
    // the wheel over the drawing agree about what a nudge means.
    const zoomRow = (
      labelKey: string,
      value: number,
      max: number,
      onChange: (zoom: number) => void,
    ) =>
      slider({
        label: translate(locale, labelKey),
        value: zoomToTrack(value, max),
        min: 0,
        max: ZOOM_TRACK_STEPS,
        step: 1,
        readout: `${number(locale, value, value < 10 ? 1 : 0)}×`,
        onChange: (track) => onChange(trackToZoom(track, max)),
      });

    const mapZoomRow = zoomRow('zoom.map', mapZoom, MAX_MAP_ZOOM, (mapZoom) =>
      store.patch({ mapZoom }),
    );
    const moonZoomRow = zoomRow('zoom.moons', moonZoom, MAX_MOON_ZOOM, (moonZoom) =>
      store.patch({ moonZoom }),
    );

    // --- which moon ---
    const moons = el('div', 'controls__row');
    for (const id of GALILEAN_IDS) {
      moons.append(
        button(`chip${id === moon ? ' chip--active' : ''}`, translate(locale, `moon.${id}`), () =>
          store.patch({ moon: id }),
        ),
      );
    }

    root.replaceChildren(
      group('controls.time', transport, rateSlider, presets, jumps, nudge),
      group('controls.timing', modes, modeNote),
      group('controls.campaign', campaign, campaignNote),
      group('controls.zoom', mapZoomRow, moonZoomRow),
      group('controls.moon', moons),
      button('button button--quiet', translate(locale, 'walkthrough.title'), () =>
        store.patch({ panel: 'walkthrough' }),
      ),
    );
  };

  return { root, render };
}

interface SliderOptions {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Already formatted, or empty when the value is shown elsewhere. */
  readout: string;
  onChange: (value: number) => void;
}

function slider(options: SliderOptions): HTMLElement {
  const input = el('input', 'controls__slider');
  input.type = 'range';
  input.min = String(options.min);
  input.max = String(options.max);
  input.step = String(options.step);
  input.value = String(options.value);
  input.addEventListener('input', () => options.onChange(Number(input.value)));

  const row = el('label', 'controls__sliderRow');
  row.append(
    el('span', 'controls__sliderLabel', options.label),
    input,
    // Fractions here are written with a comma in Czech, so the caller formats.
    el('span', 'controls__readout', options.readout),
  );
  return row;
}
