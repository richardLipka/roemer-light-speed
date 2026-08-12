/**
 * The walkthrough panel: six steps, each driving the model as it is read.
 *
 * Roughly one spoken minute per step, because this is the part a teacher
 * projects and talks over.
 */

import { translate } from '../i18n/i18n.js';
import type { Store } from '../state/store.js';
import { button, el } from '../view/dom.js';
import { bodyKey, STEP_COUNT, titleKey, WALKTHROUGH_STEPS } from './steps.js';

export interface WalkthroughView {
  root: HTMLElement;
  render(): void;
}

export function createWalkthrough(store: Store): WalkthroughView {
  const counter = el('p', 'walkthrough__counter');
  const title = el('h2', 'panel__title');
  const body = el('p', 'walkthrough__body');
  const actions = el('div', 'panel__actions');

  const root = el('section', 'panel walkthrough');
  root.append(counter, title, body, actions);

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
    body.textContent = translate(locale, bodyKey(walkthroughStep));

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
