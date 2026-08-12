/**
 * One source of truth for everything the interface can change.
 *
 * Small on purpose. The orrery's store carries a model, an engine, a frame
 * origin and an observation point; this app has none of those choices to make —
 * the engine is Newton and the observer is Earth, both settled in CLAUDE.md §3
 * and §5.2 rather than offered as controls. What is left is the clock, which
 * moon is being watched, and which panel is open.
 */

import { SimulationClock, jdFromCalendar } from '@orrery/core';

import { DEFAULT_MOON, type GalileanId } from '../physics/constants.js';
import { type Locale, storeLocale, storedLocale } from '../i18n/i18n.js';

/** The app opens on the year of the measurement. */
export const OPENING_JD = jdFromCalendar(1676, 1, 1);

/**
 * Simulated days per real second.
 *
 * Geometric, because the useful range spans a factor of fifty thousand. The
 * bottom rung is slow enough to watch Io slide into the shadow over its real
 * three and a half minutes; the top crosses a year in under four seconds, which
 * is what it takes to get from Jupiter at its nearest to Jupiter at its
 * furthest and see the delay swing with it.
 */
export const RATE_LADDER = [0.002, 0.02, 0.2, 1, 5, 20, 100] as const;

export const DEFAULT_RATE_INDEX = 3;

export type Panel = 'log' | 'solve' | 'walkthrough' | null;

/**
 * Zoom is a multiplier on the drawing, not a change of projection.
 *
 * Two independent ones, because the two things worth magnifying are wildly
 * different sizes: the plan view is about AU and the Jovian system about a
 * hundredth of one. Sharing a control between them would make one of the two
 * useless at every setting.
 */
export const MIN_ZOOM = 1;
export const MAX_MAP_ZOOM = 12;
export const MAX_MOON_ZOOM = 8;

export interface State {
  locale: Locale;
  moon: GalileanId;
  /** The faint markers showing where things really are. On by default: it is
   *  the app's central device, not an extra. */
  showTruePositions: boolean;
  /** Explanatory prose, collapsed behind a toggle as the orrery does it. */
  showNotes: boolean;
  panel: Panel;
  /** Which of the six steps, when the walkthrough is open. */
  walkthroughStep: number;
  rateIndex: number;
  /** Magnification of the plan view. */
  mapZoom: number;
  /** Magnification of the Jovian inset and the telescope strip. */
  moonZoom: number;
}

export class Store {
  readonly clock = new SimulationClock(OPENING_JD, RATE_LADDER[DEFAULT_RATE_INDEX]);

  private state: State = {
    locale: storedLocale(),
    moon: DEFAULT_MOON,
    showTruePositions: true,
    // Off by default, like the orrery: the prose is good, but anyone past their
    // first few minutes wants the instrument rather than the essay.
    showNotes: false,
    panel: null,
    walkthroughStep: 1,
    rateIndex: DEFAULT_RATE_INDEX,
    mapZoom: 1,
    // One, so the inset opens showing all four orbits including Callisto's.
    // It was two, which put Callisto's ring 862 pixels across a 480-pixel box
    // and quietly cropped half the system out of the panel meant to show it.
    moonZoom: 1,
  };

  private readonly listeners = new Set<(state: State) => void>();

  get current(): Readonly<State> {
    return this.state;
  }

  subscribe(listener: (state: State) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * One patch, not a run of setters.
   *
   * A sequence of individual writes would publish an intermediate state nobody
   * asked for — the orrery learned this when hydrating a shared link.
   */
  patch(changes: Partial<State>): void {
    const next = { ...this.state, ...changes };
    if (next.locale !== this.state.locale) storeLocale(next.locale);
    if (next.rateIndex !== this.state.rateIndex) {
      this.clock.setRate(RATE_LADDER[next.rateIndex] ?? RATE_LADDER[DEFAULT_RATE_INDEX]);
    }
    this.state = next;
    this.emit();
  }

  /** The clock advances outside the state object, so a tick is announced here. */
  ticked(): void {
    this.emit();
  }

  toggleLocale(): void {
    this.patch({ locale: this.state.locale === 'cs' ? 'en' : 'cs' });
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state);
  }
}
