/**
 * The walkthrough panel: six steps, each driving the model as it is read.
 *
 * Roughly one spoken minute per step, because this is the part a teacher
 * projects and talks over.
 *
 * **Step 5 carries a control, and only step 5.** It is the step CLAUDE.md §8
 * gives the most weight to, and prose was all it had: the app said Rømer's
 * announcement was what made this science, then offered the student nothing but
 * hindsight. `predictionView` puts the announcement in their hands. It appears
 * on that step alone — an instrument for making a prediction is meaningless
 * beside step 1, and having it standing on every step would make it furniture.
 */

import { translate } from '../i18n/i18n.js';
import type { Store } from '../state/store.js';
import { button, el } from '../view/dom.js';
import type { PredictionView } from './predictionView.js';
import { bodyKey, PREDICTION_STEP, STEP_COUNT, titleKey, WALKTHROUGH_STEPS } from './steps.js';

export interface WalkthroughView {
  root: HTMLElement;
  render(): void;
}

export function createWalkthrough(store: Store, prediction: PredictionView): WalkthroughView {
  const counter = el('p', 'walkthrough__counter');
  const title = el('h2', 'panel__title');
  const body = el('p', 'walkthrough__body');
  const actions = el('div', 'panel__actions');

  const root = el('section', 'panel walkthrough');
  root.append(counter, title, body, prediction.root, actions);

  const goTo = (step: number): void => {
    const clamped = Math.min(Math.max(step, 1), STEP_COUNT);
    const definition = WALKTHROUGH_STEPS[clamped - 1];
    if (definition?.jd !== undefined) store.clock.setJd(definition.jd);
    store.patch({
      walkthroughStep: clamped,
      ...(definition?.showTruePositions === undefined
        ? {}
        : { showTruePositions: definition.showTruePositions }),
    });
  };

  const render = (): void => {
    const { locale, walkthroughStep } = store.current;
    counter.textContent = translate(locale, 'walkthrough.step', {
      current: walkthroughStep,
      total: STEP_COUNT,
    });
    title.textContent = translate(locale, titleKey(walkthroughStep));
    // innerHTML, not textContent: some steps carry a Wikipedia link baked
    // into the dictionary string — see `dom.ts`'s `elHtml`.
    body.innerHTML = translate(locale, bodyKey(walkthroughStep));

    const predicting = walkthroughStep === PREDICTION_STEP;
    prediction.root.hidden = !predicting;
    if (predicting) prediction.render();

    const previous = button('button button--quiet', translate(locale, 'walkthrough.previous'), () =>
      goTo(walkthroughStep - 1),
    );
    previous.disabled = walkthroughStep === 1;

    const next = button('button', translate(locale, 'walkthrough.next'), () =>
      goTo(walkthroughStep + 1),
    );
    next.disabled = walkthroughStep === STEP_COUNT;

    actions.replaceChildren(
      previous,
      next,
      button('button button--quiet', translate(locale, 'walkthrough.close'), () =>
        store.patch({ panel: null }),
      ),
    );
  };

  return { root, render };
}
