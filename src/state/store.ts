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

import {
  C_KM_PER_S,
  DEFAULT_MOON,
  type GalileanId,
  LIGHT_TIME_PER_AU_DAYS,
  SECONDS_PER_DAY,
} from '../physics/constants.js';
import type { TimingMode } from '../physics/solve.js';
import { type Locale, storeLocale, storedLocale } from '../i18n/i18n.js';

/** The app opens on the year of the measurement. */
export const OPENING_JD = jdFromCalendar(1676, 1, 1);

/**
 * Simulated days per real second — a continuous quantity, not a ladder.
 *
 * It was seven fixed rungs stepped with − and +, and two things were wrong with
 * that. Between rungs there was nothing: 0.2 d/s runs Io's three-and-a-half
 * minute fade past in a blink and 0.02 d/s takes half a minute to cross an hour,
 * with no way to sit between them. And the slowest rung was still 172 times real
 * time, so the app could not do the one thing an eclipse deserves — be watched
 * at something like the pace it actually happens.
 *
 * So the control is a slider in **log space**, which is the only sane geometry
 * for a range spanning seven decades: equal distances along it are equal ratios,
 * and the fine end gets as much of the track as the coarse end.
 */
export const MIN_RATE = 1 / SECONDS_PER_DAY; // one second of sky per second: real time
export const MAX_RATE = 100; // a year in under four seconds
export const DEFAULT_RATE = 1;

/** Ten times real time — slow enough to watch a moon fade, quick enough to sit through. */
export const CLOSE_UP_RATE = 10 / SECONDS_PER_DAY;

/**
 * Named speeds worth one click, since a slider is precise but not memorable.
 * Real time, the close-up, a minute a second, an hour a second, and the three
 * old coarse rungs that cover a year of eclipses.
 */
export const RATE_PRESETS = [
  MIN_RATE,
  CLOSE_UP_RATE,
  1 / 1440,
  1 / 24,
  1,
  10,
  MAX_RATE,
] as const;

/**
 * How long a run of observations covers, years.
 *
 * The lateness rises and falls with Jupiter's synodic cycle of 399 days, so a
 * campaign shorter than that shows a trend and a campaign longer than it shows a
 * *periodicity* — which is the thing that rules out a drifting clock, a wearing
 * instrument or an observer's habit, none of which would politely return to
 * where they started every thirteen months.
 */
export const CAMPAIGN_YEARS = [2, 3, 6, 12] as const;
export const DEFAULT_CAMPAIGN_YEARS = 3;

/**
 * The two tabs.
 *
 * `demonstration` is the historical instrument, with light at its real speed.
 * `game` is the same instrument in a universe where light is slower, by a factor
 * the student is not told, and their job is to find it.
 */
export type Tab = 'demonstration' | 'game';

/**
 * How much slower light runs in the game, and why the range is what it is.
 *
 * Below about five, the game is simply the demonstration again — the delay is
 * the same handful of minutes and the exercise adds nothing. Above about twenty,
 * light takes over half of Io's 1.77-day period to reach Earth, the eclipse a
 * student sees belongs to a configuration nearly half an orbit stale, and the
 * eyepiece stops resembling anything an astronomer would recognise.
 *
 * Between those, the effect is large enough to see in the ghost markers and
 * still small enough that the method is the same method.
 */
export const MIN_SLOWDOWN = 5;
export const MAX_SLOWDOWN = 20;

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
  /** Simulated days per real second, anywhere between MIN_RATE and MAX_RATE. */
  rateDaysPerSecond: number;
  /** Which eclipse a key press is timed against — see `TimingMode`. */
  timingMode: TimingMode;
  /** How long a run of observations covers, years. */
  campaignYears: number;
  /** Magnification of the plan view. */
  mapZoom: number;
  /** Magnification of the Jovian inset and the telescope strip. */
  moonZoom: number;
  /** Which tab is showing. */
  tab: Tab;
  /** How many times slower light runs in the game. */
  slowdown: number;
  /**
   * Whether the student has been told the slowdown.
   *
   * A randomised game hides it until they ask; a teacher setting a value knows
   * it already. The flag rather than a separate "secret" field, so revealing is
   * one patch and cannot leave the two out of step.
   */
  slowdownRevealed: boolean;
}

export class Store {
  readonly clock = new SimulationClock(OPENING_JD, DEFAULT_RATE);

  private state: State = {
    locale: storedLocale(),
    moon: DEFAULT_MOON,
    showTruePositions: true,
    // Off by default, like the orrery: the prose is good, but anyone past their
    // first few minutes wants the instrument rather than the essay.
    showNotes: false,
    panel: null,
    walkthroughStep: 1,
    rateDaysPerSecond: DEFAULT_RATE,
    // The honest experiment first. The other one is the control, and offering it
    // as the opening state would be showing the answer before the question.
    timingMode: 'seen',
    campaignYears: DEFAULT_CAMPAIGN_YEARS,
    tab: 'demonstration',
    slowdown: randomSlowdown(),
    slowdownRevealed: false,
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
    if (next.rateDaysPerSecond !== this.state.rateDaysPerSecond) {
      next.rateDaysPerSecond = clampRate(next.rateDaysPerSecond);
      this.clock.setRate(next.rateDaysPerSecond);
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

  /**
   * Light travel time across one AU in the universe currently on screen, days.
   *
   * The single place the game's slower light enters the physics. Everything that
   * retards a position, solves an eclipse or draws a delay curve takes this
   * value rather than importing the constant, so the game is the same instrument
   * in a different universe and not a second copy of the app.
   */
  get lightTimePerAuDays(): number {
    return LIGHT_TIME_PER_AU_DAYS * (this.state.tab === 'game' ? this.state.slowdown : 1);
  }

  /** What an answer is scored against — the true c, or the game's slowed one. */
  get referenceSpeedKmPerS(): number {
    return C_KM_PER_S / (this.state.tab === 'game' ? this.state.slowdown : 1);
  }

  /** A fresh unknown universe, and the reveal reset with it. */
  reroll(): void {
    this.patch({ slowdown: randomSlowdown(), slowdownRevealed: false });
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state);
  }
}

/**
 * Keep the rate inside the range the slider offers.
 *
 * A rate can arrive from a preset button as well as the slider, and one arriving
 * as zero or a NaN would stop the clock in a way nothing in the interface could
 * undo — the slider would show a position with no meaning and play would appear
 * broken. Bad input falls back to the default rather than propagating.
 */
function clampRate(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_RATE;
  return Math.min(MAX_RATE, Math.max(MIN_RATE, value));
}

/**
 * An unknown slowdown, drawn to one decimal place.
 *
 * Not a whole number, and deliberately so: a student who works out 12.0 has
 * probably guessed, and a student who works out 13.4 has measured. Rounding to
 * tenths also keeps the reveal readable next to their own answer.
 */
function randomSlowdown(): number {
  return Math.round((MIN_SLOWDOWN + Math.random() * (MAX_SLOWDOWN - MIN_SLOWDOWN)) * 10) / 10;
}
