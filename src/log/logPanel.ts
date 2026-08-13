/**
 * The table of what the student saw.
 *
 * Six columns, and the two that matter sit next to each other: **the difference
 * from their own timetable** and **how far Jupiter was**. Rømer found the
 * pattern by reading down a table much like this one, and putting those columns
 * side by side is what makes that possible here too — the difference climbs as
 * the distance climbs, and a student can see it before any graph is drawn.
 *
 * The column headed *when it was due* used to hold the model's own eclipse time,
 * and that was the interface's worst sentence: it asserted a second, instant
 * channel to Jupiter that nobody has ever had, and with it the entire difficulty
 * of the discovery. It now holds what the student's own timetable — fitted to
 * the rest of their log — extrapolates for that eclipse. So every number in the
 * table is a comparison of observations with each other.
 */

import { translate } from '../i18n/i18n.js';
import { buildTimetables, type TimedObservation } from '../physics/solve.js';
import type { Logbook } from '../state/log.js';
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
  log: Logbook,
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
    const { locale, timingMode } = store.current;
    const entries = log.in(timingMode);
    const other = log.countIn(timingMode === 'seen' ? 'true' : 'seen');

    title.textContent = translate(locale, 'log.title');

    // Which experiment these rows belong to, and how many are being held back.
    // Without the second half a student who has run both sees their log halve
    // when they flip the toggle and reasonably concludes it was thrown away.
    count.textContent =
      translate(locale, `log.countIn.${timingMode}`, { count: entries.length }) +
      (other ? ` ${translate(locale, 'log.otherMode', { count: other })}` : '');

    // Spelled out, because "press the space bar" buried in a hint was the only
    // way in and nobody found it. Three steps, in the order they are done.
    fill(
      howTo,
      el('li', undefined, translate(locale, 'log.step1')),
      el('li', undefined, translate(locale, `log.step2.${timingMode}`)),
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
      // Clears this experiment only. Clearing both would throw away the run a
      // student is halfway through comparing against.
      button('button button--quiet', translate(locale, 'log.clear'), () => log.clearMode(timingMode)),
    );

    if (entries.length === 0) {
      fill(body, el('p', 'note note--live', translate(locale, `log.empty.${timingMode}`)));
      return;
    }

    // The timetable is a property of the whole run, so it is worked out here and
    // not stored on any row. Fewer than two events of a kind cannot support one,
    // which is why a young log shows times and distances but no difference yet.
    const timings = buildTimetables(entries);

    const table = el('table', 'log__table');
    const head = el('tr');
    for (const key of [
      'log.columnDate',
      'log.columnKind',
      'log.columnRecorded',
      'log.columnTimetable',
      'log.columnDifference',
      'log.columnDistance',
    ]) {
      head.append(el('th', undefined, translate(locale, key)));
    }
    const header = el('thead');
    header.append(head);
    table.append(header);

    const rows = el('tbody');
    for (const timed of timings.rows) rows.append(row(locale, timed));
    table.append(rows);

    const missing = entries.length - timings.rows.length;
    fill(
      body,
      el('p', 'note', translate(locale, 'log.timetableNote')),
      table,
      ...(missing > 0
        ? [el('p', 'note note--live', translate(locale, 'log.notYetPlaced', { count: missing }))]
        : []),
    );
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

function row(locale: 'cs' | 'en', timed: TimedObservation): HTMLTableRowElement {
  const { observation } = timed;
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
    el('td', 'log__cell--number', timeOfDay(locale, timed.jdFromTimetable)),
    el('td', 'log__cell--number', duration(locale, timed.residualSeconds)),
    el('td', 'log__cell--number', number(locale, observation.distanceAu, 2)),
  );
  return node;
}
