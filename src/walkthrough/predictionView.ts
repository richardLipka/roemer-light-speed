/**
 * The working half of walkthrough step 5 — *make the announcement yourself*.
 *
 * Everything else in this app is hindsight. You gather eclipses, fit a line,
 * and the line fits because it was drawn through the points. Rømer's claim on
 * anyone's attention is the other thing: in September 1676 he named a date
 * months ahead, said the eclipse would be late, and let the sky decide in
 * public. CLAUDE.md §8 calls that "the step that makes it science rather than a
 * curve drawn after the fact" and gives it the most weight of the six — and
 * until now the app only described it.
 *
 * So this panel puts two clock times on screen for one eclipse nobody in the log
 * has watched. One comes from a steady table; the other adds the delay the
 * student's own measurement says the light will pick up. They differ by a
 * quarter of an hour. Then there is a button that goes there, and the eyepiece
 * settles it.
 *
 * **The verdict is not scored against the truth.** It is scored against the two
 * predictions, which is the comparison Rømer's contemporaries actually made —
 * and it is the student's *own* reading that does the scoring, so the panel
 * cannot hand back an answer the student did not obtain.
 */

import { translate } from '../i18n/i18n.js';
import {
  type Prediction,
  type PredictionOutcome,
  predictNextEclipse,
  scorePrediction,
} from '../physics/predict.js';
import type { Logbook } from '../state/log.js';
import type { Store } from '../state/store.js';
import { button, el, fill } from '../view/dom.js';
import { dateAndTime, duration, number } from '../view/format.js';
import { scenePositions } from '../view/scene.js';

export interface PredictionView {
  root: HTMLElement;
  render(): void;
}

export interface PredictionActions {
  /**
   * Put the clock a little before the predicted eclipse and run it, so the two
   * predicted moments arrive in front of the student rather than being skipped
   * past. `gapSeconds` lets the caller pick a pace that suits the wait.
   */
  goTo(jd: number, gapSeconds: number): void;
}

/**
 * How near a reading has to be to count as having watched the predicted
 * eclipse. Generous, because a student who lands on the right eclipse but times
 * it badly has still settled the bet — badly is what the two predictions are
 * being judged against.
 */
const CLAIMED_WITHIN_DAYS = 1 / 24;

export function createPredictionView(
  store: Store,
  log: Logbook,
  actions: PredictionActions,
): PredictionView {
  const root = el('div', 'predict');

  // The prediction is pinned once made. Recomputing it every render would let it
  // slide onto a different eclipse the moment the student logs the reading that
  // settles it, and the bet would quietly rewrite itself.
  let pinned: Prediction | null = null;
  let pinnedFor = '';

  log.subscribe(() => {
    // A cleared log invalidates the bet; a new reading does not.
    if (!log.countIn(store.current.timingMode)) pinned = null;
  });

  const render = (): void => {
    const { locale, timingMode, moon } = store.current;
    const key = `${moon}/${timingMode}/${store.current.tab}`;
    if (key !== pinnedFor) {
      pinned = null;
      pinnedFor = key;
    }

    if (!pinned) {
      pinned = predictNextEclipse({
        positionsAt: scenePositions,
        observations: log.in(timingMode),
        moon,
        perAuDays: store.lightTimePerAuDays,
      });
    }

    if (!pinned) {
      fill(root, el('p', 'note note--live', translate(locale, 'predict.needMore')));
      return;
    }

    const prediction = pinned;
    const outcome = settle(prediction);

    const rows: HTMLElement[] = [
      el('h3', 'predict__title', translate(locale, 'predict.title')),
      el('p', 'note', translate(locale, 'predict.intro')),
      line(
        locale,
        'predict.steadyLabel',
        dateAndTime(locale, prediction.steadyJd),
        'predict__time--steady',
      ),
      line(
        locale,
        'predict.correctedLabel',
        dateAndTime(locale, prediction.correctedJd),
        'predict__time--corrected',
      ),
      el(
        'p',
        'note note--live',
        translate(locale, 'predict.gap', {
          gap: duration(locale, prediction.gapSeconds),
          au: number(locale, Math.abs(prediction.distanceAu - prediction.tableDistanceAu), 2),
          perAu: number(locale, prediction.lightTimePerAuSeconds, 0),
        }),
      ),
    ];

    if (!outcome) {
      rows.push(
        button('button', translate(locale, 'predict.go'), () => {
          // Land before the earlier of the two, so both moments are still ahead.
          actions.goTo(
            Math.min(prediction.steadyJd, prediction.correctedJd),
            prediction.gapSeconds,
          );
        }),
        el('p', 'note', translate(locale, 'predict.howTo')),
      );
    } else {
      rows.push(
        el(
          'p',
          'predict__verdict',
          translate(locale, outcome.lightWon ? 'predict.wonLight' : 'predict.wonSteady', {
            steady: duration(locale, Math.abs(outcome.fromSteadySeconds)),
            corrected: duration(locale, Math.abs(outcome.fromCorrectedSeconds)),
          }),
        ),
        el(
          'p',
          'note',
          translate(locale, outcome.lightWon ? 'predict.wonLightNote' : 'predict.wonSteadyNote'),
        ),
      );
    }

    fill(root, ...rows);
  };

  /** The student's own reading of the predicted eclipse, if they have made one. */
  const settle = (prediction: Prediction): PredictionOutcome | null => {
    const middle = (prediction.steadyJd + prediction.correctedJd) / 2;
    let nearest: number | null = null;
    for (const observation of log.in(store.current.timingMode)) {
      if (observation.moon !== prediction.moon) continue;
      if (observation.phase !== prediction.phase) continue;
      if (Math.abs(observation.jdRecorded - middle) > CLAIMED_WITHIN_DAYS) continue;
      if (nearest === null || Math.abs(observation.jdRecorded - middle) < Math.abs(nearest - middle))
        nearest = observation.jdRecorded;
    }
    return nearest === null ? null : scorePrediction(prediction, nearest);
  };

  log.subscribe(render);
  return { root, render };
}

function line(
  locale: 'cs' | 'en',
  labelKey: string,
  value: string,
  modifier: string,
): HTMLElement {
  const row = el('p', `predict__time ${modifier}`);
  row.append(
    el('span', 'predict__label', translate(locale, labelKey)),
    el('span', 'predict__value', value),
  );
  return row;
}
