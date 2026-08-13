/**
 * The game: the same instrument, in a universe whose speed of light nobody has
 * told you.
 *
 * The demonstration has one weakness it cannot fix by itself. A student who
 * follows it has watched a measurement being explained, and explanation is not
 * the same as doing. The answer is on the wall of every physics classroom, so
 * "you got 297 000" is checked against something already known, and the part
 * that actually made this hard in 1676 — not knowing whether the number you have
 * is right — is exactly the part that has been removed.
 *
 * So: light is slowed by a factor between five and twenty, drawn at random and
 * not shown. The same eclipses, the same telescope, the same timetable fitted
 * from the same kind of log. The student measures, commits to an answer, and
 * only then finds out. Rømer's position, minus three hundred years of hindsight.
 *
 * Slowing it rather than speeding it up is deliberate. Faster light shrinks the
 * effect toward nothing and the exercise becomes an exercise in patience; slower
 * light makes it *larger*, so the method is easier to carry out while the thing
 * being measured is genuinely unknown. What is being tested is whether they can
 * run the argument, not whether they can time a fade to the second.
 *
 * The reveal is one-way and deliberately so. Once a student has seen the answer
 * they cannot un-see it, and a game that let them peek, adjust and re-measure
 * would teach the one habit this whole app exists to argue against.
 */

import { translate } from '../i18n/i18n.js';
import { C_KM_PER_S } from '../physics/constants.js';
import { solveFromAll } from '../physics/solve.js';
import type { Logbook } from '../state/log.js';
import { MAX_SLOWDOWN, MIN_SLOWDOWN, type Store } from '../state/store.js';
import { button, el, fill } from '../view/dom.js';
import { number, speed } from '../view/format.js';

export interface GamePanelView {
  root: HTMLElement;
  render(): void;
}

export function createGamePanel(store: Store, log: Logbook): GamePanelView {
  const title = el('h2', 'panel__title');
  const body = el('div', 'game__body');

  const root = el('section', 'panel game');
  root.append(title, body);

  const render = (): void => {
    const { locale, slowdown, slowdownRevealed, timingMode } = store.current;
    title.textContent = translate(locale, 'game.title');

    const parts: HTMLElement[] = [el('p', 'note note--live', translate(locale, 'game.intro'))];

    // What they have got so far, if anything. Shown before the reveal, because
    // committing to a number is the point — and because a student who can see
    // their own answer moving as they add observations is watching a measurement
    // converge, which is worth more than the final digit.
    const entries = log.in(timingMode);
    let measuredSlowdown: number | null = null;
    let errorPercent = 0;

    if (entries.length >= 3) {
      const solution = solveFromAll(entries, store.referenceSpeedKmPerS);
      if (!solution.timings.tooShort && solution.slopeSigma >= 3) {
        // Their speed against the real one: how many times slower this universe
        // looks from their data.
        measuredSlowdown = C_KM_PER_S / solution.speedKmPerS;
        // The same error the solve panel quotes, and deliberately not a fresh
        // one computed from the slowdown factors. Those two differ by the ratio
        // of the factors — 7.5% against 8.1% on one run — and two answers to
        // "how far off am I" on one screen is a bug however defensible each is.
        errorPercent = Math.abs(solution.percentError);
        parts.push(
          el(
            'p',
            'game__answer',
            translate(locale, 'game.yours', {
              slowdown: number(locale, measuredSlowdown, 1),
              speed: speed(locale, solution.speedKmPerS),
            }),
          ),
        );
      } else {
        parts.push(el('p', 'note note--live', translate(locale, 'game.notYet')));
      }
    } else {
      parts.push(el('p', 'note note--live', translate(locale, 'game.notYet')));
    }

    if (slowdownRevealed) {
      parts.push(
        el('hr', 'comparison__rule'),
        el(
          'p',
          'game__answer',
          translate(locale, 'game.actual', { slowdown: number(locale, slowdown, 1) }),
        ),
      );

      if (measuredSlowdown !== null) {
        parts.push(
          el(
            'p',
            'game__verdict',
            translate(locale, `game.verdict.${band(errorPercent)}`, {
              percent: number(locale, errorPercent, 1),
            }),
          ),
        );
      }
    }

    const controls = el('div', 'panel__actions');
    controls.append(
      button('button', translate(locale, 'game.reroll'), () => {
        // A new universe makes every reading in the old one meaningless, so the
        // log goes with it. Silently keeping it would be the worst outcome: a
        // fit across two different speeds of light, converging on neither.
        log.game.clear();
        store.reroll();
      }),
    );

    if (!slowdownRevealed) {
      controls.append(
        button('button button--quiet', translate(locale, 'game.reveal'), () =>
          store.patch({ slowdownRevealed: true }),
        ),
      );
    }

    parts.push(controls);

    // The teacher's way in: set the factor outright rather than drawing one.
    // Shown only once the answer is out, so it cannot be used to peek.
    if (slowdownRevealed) {
      const setter = el('label', 'controls__sliderRow');
      const input = el('input', 'controls__slider');
      input.type = 'range';
      input.min = String(MIN_SLOWDOWN);
      input.max = String(MAX_SLOWDOWN);
      input.step = '0.1';
      input.value = String(slowdown);
      input.addEventListener('input', () => {
        log.game.clear();
        store.patch({ slowdown: Number(input.value) });
      });
      setter.append(
        el('span', 'controls__sliderLabel', translate(locale, 'game.setLabel')),
        input,
        el('span', 'controls__readout', `${number(locale, slowdown, 1)}×`),
      );
      parts.push(setter);
    }

    fill(body, ...parts);
  };

  log.subscribe(render);
  return { root, render };
}

/**
 * How well they did, in words rather than a score.
 *
 * The bands are set against the history rather than against an exam mark. Rømer
 * was 32% out and was right about everything that mattered, so anything inside
 * that deserves to be told it beat him; and the app's own method carries a few
 * percent of systematic (`solve.ts`), so nothing below about five percent is
 * skill rather than luck.
 */
function band(errorPercent: number): 'excellent' | 'good' | 'roemer' | 'far' {
  if (errorPercent < 5) return 'excellent';
  if (errorPercent < 15) return 'good';
  if (errorPercent < 35) return 'roemer';
  return 'far';
}
