/**
 * The table of what the student saw.
 *
 * Six columns, and the two that matter sit next to each other: **how late** and
 * **how far Jupiter was**. Rømer found the pattern by reading down a table much
 * like this one, and putting those columns side by side is what makes that
 * possible here too — the lateness climbs as the distance climbs, and a student
 * can see it before any graph is drawn.
 */

import { translate } from '../i18n/i18n.js';
import { latenessSeconds, type Observation } from '../physics/solve.js';
import type { ObservationLog } from '../state/log.js';
import type { Store } from '../state/store.js';
import { button, el, fill } from '../view/dom.js';
import { date, duration, number, timeOfDay } from '../view/format.js';

export interface LogPanelView {
  root: HTMLElement;
  render(): void;
  /** Feedback on the last attempt to record — accepted, or nothing was there. */
  report(message: string): void;
}

export function createLogPanel(
  store: Store,
  log: ObservationLog,
  onLoadSample: () => void,
  onRecord: () => void,
): LogPanelView {
  const title = el('h2', 'panel__title');
  const howTo = el('ol', 'log__howto');
  const record = el('div', 'log__record');
  const feedback = el('p', 'note note--live log__feedback');
  const count = el('p', 'log__count');
  const body = el('div', 'log__body');
  const actions = el('div', 'panel__actions');

  const root = el('section', 'panel log');
  root.append(title, howTo, record, feedback, count, body, actions);

  const render = (): void => {
    const { locale } = store.current;
    title.textContent = translate(locale, 'log.title');
    count.textContent = translate(locale, 'log.count', { count: log.count });

    // Spelled out, because "press the space bar" buried in a hint was the only
    // way in and nobody found it. Three steps, in the order they are done.
    fill(
      howTo,
      el('li', undefined, translate(locale, 'log.step1')),
      el('li', undefined, translate(locale, 'log.step2')),
      el('li', undefined, translate(locale, 'log.step3')),
    );

    // A real button as well as the space bar. The key is faster once you know
    // it exists; the button is how you find out it does.
    fill(
      record,
      button('button button--record', translate(locale, 'log.record'), onRecord),
      el('span', 'log__shortcut', translate(locale, 'log.recordKey')),
    );

    fill(
      actions,
      button('button', translate(locale, 'log.loadSample'), onLoadSample),
      button('button button--quiet', translate(locale, 'log.clear'), () => log.clear()),
    );

    if (log.count === 0) {
      fill(body, el('p', 'note note--live', translate(locale, 'log.empty')));
      return;
    }

    const table = el('table', 'log__table');
    const head = el('tr');
    for (const key of [
      'log.columnDate',
      'log.columnKind',
      'log.columnRecorded',
      'log.columnPredicted',
      'log.columnLateness',
      'log.columnDistance',
    ]) {
      head.append(el('th', undefined, translate(locale, key)));
    }
    const header = el('thead');
    header.append(head);
    table.append(header);

    const rows = el('tbody');
    for (const observation of log.entries) rows.append(row(locale, observation));
    table.append(rows);

    fill(body, table);
  };

  log.subscribe(render);

  return {
    root,
    render,
    /** Say what happened to the key press, since nothing else can. */
    report(message: string) {
      feedback.textContent = message;
    },
  };
}

function row(locale: 'cs' | 'en', observation: Observation): HTMLTableRowElement {
  const node = el('tr');
  node.append(
    el('td', undefined, date(locale, observation.jdRecorded)),
    el(
      'td',
      undefined,
      translate(
        locale,
        observation.phase === 'disappearance' ? 'log.kindDisappearance' : 'log.kindReappearance',
      ),
    ),
    el('td', 'log__cell--number', timeOfDay(locale, observation.jdRecorded)),
    el('td', 'log__cell--number', timeOfDay(locale, observation.jdPredicted)),
    el('td', 'log__cell--number', duration(locale, latenessSeconds(observation))),
    el('td', 'log__cell--number', number(locale, observation.distanceAu, 2)),
  );
  return node;
}
