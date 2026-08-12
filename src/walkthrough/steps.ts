/**
 * Rømer's reasoning, as six steps of data.
 *
 * Each step carries a translation key and the state the model should be in while
 * it is read, so the claim is always made with the geometry that supports it on
 * screen. A step is not a slide: `apply` drives the app.
 *
 * Step 5 is the one that matters most and the one with the trap in it. The model
 * cannot put a real eclipse on 9 November 1676 — CLAUDE.md §6 — so the prose
 * quotes what Rømer predicted and what was seen as *history*, while the model
 * shows only the *geometry* of that moment, which it does get right: Earth far
 * from Jupiter, the delay near its greatest.
 */

import { jdFromCalendar } from '@orrery/core';

export interface WalkthroughStep {
  /** 1-based, and used to build the translation keys. */
  index: number;
  /** Where to put the clock, if this step wants a particular configuration. */
  jd?: number;
  /** Whether the "where it really is" markers should be showing. */
  showTruePositions?: boolean;
}

/**
 * Two dates chosen for their *geometry*, not for their history.
 *
 * Near opposition, Earth and Jupiter are closest and the light is youngest; near
 * conjunction, furthest and oldest. In 1676 Jupiter came to opposition in
 * mid-August, so these sit either side of it.
 */
const NEAR = jdFromCalendar(1676, 8, 15);
const FAR = jdFromCalendar(1677, 2, 15);

export const WALKTHROUGH_STEPS: readonly WalkthroughStep[] = [
  { index: 1, jd: NEAR, showTruePositions: false },
  { index: 2, jd: NEAR, showTruePositions: false },
  { index: 3, jd: FAR, showTruePositions: false },
  { index: 4, jd: FAR, showTruePositions: true },
  { index: 5, jd: FAR, showTruePositions: true },
  { index: 6, jd: FAR, showTruePositions: true },
];

export const STEP_COUNT = WALKTHROUGH_STEPS.length;

export const titleKey = (step: number): string => `walkthrough.${step}.title`;
export const bodyKey = (step: number): string => `walkthrough.${step}.body`;
