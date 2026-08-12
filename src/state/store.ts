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
 * Geometric, because the useful range spans a factor of two hundred: slow enough
 * to watch Io slide into the shadow over its real three and a half minutes, fast
 * enough to cross the months between one end of Earth's orbit and the other.
 */
export const RATE_LADDER = [0.002, 0.02, 0.2, 1, 5, 20] as const;

export const DEFAULT_RATE_INDEX = 2;

export type Panel = 'log' | 'solve' | 'walkthrough' | null;

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
