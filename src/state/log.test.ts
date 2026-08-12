import { describe, expect, it } from 'vitest';

import type { Observation } from '../physics/solve.js';
import { ObservationLog, parseLog, serializeLog } from './log.js';

const row = (jdRecorded: number, distanceAu = 5): Observation => ({
  jdRecorded,
  jdPredicted: jdRecorded - 0.03,
  phase: 'disappearance',
  distanceAu,
});

describe('storage round trip', () => {
  it('returns what it stored', () => {
    const observations = [row(2_432_000), row(2_432_010)];
    expect(parseLog(serializeLog(observations))).toEqual(observations);
  });

  it('treats an empty or absent store as an empty log', () => {
    expect(parseLog(null)).toEqual([]);
    expect(parseLog('')).toEqual([]);
  });

  it('discards a log written by an older version rather than guessing', () => {
    expect(parseLog(JSON.stringify({ version: 0, observations: [row(1)] }))).toEqual([]);
  });

  it('survives anything at all in the store', () => {
    // This string came out of a browser. It is not to be trusted.
    for (const junk of ['{', 'null', '[]', '"hello"', '{"version":1}']) {
      expect(parseLog(junk)).toEqual([]);
    }
  });

  it('drops rows that would reach the solver as NaN', () => {
    const poisoned = JSON.stringify({
      version: 1,
      observations: [
        row(2_432_000),
        { jdRecorded: 'soon', jdPredicted: 1, phase: 'disappearance', distanceAu: 5 },
        { jdRecorded: 1, jdPredicted: 1, phase: 'sideways', distanceAu: 5 },
        { jdRecorded: 1, jdPredicted: 1, phase: 'disappearance', distanceAu: null },
      ],
    });
    expect(parseLog(poisoned)).toHaveLength(1);
  });
});

describe('the log', () => {
  it('keeps entries in time order however they arrive', () => {
    const log = new ObservationLog([]);
    log.add(row(2_432_010));
    log.add(row(2_432_000));
    expect(log.entries.map((o) => o.jdRecorded)).toEqual([2_432_000, 2_432_010]);
  });

  it('tells its subscribers when it changes', () => {
    const log = new ObservationLog([]);
    let notifications = 0;
    log.subscribe(() => notifications++);

    log.add(row(2_432_000));
    log.clear();
    expect(notifications).toBe(2);
  });

  it('stops telling them once they unsubscribe', () => {
    const log = new ObservationLog([]);
    let notifications = 0;
    const stop = log.subscribe(() => notifications++);
    stop();
    log.add(row(2_432_000));
    expect(notifications).toBe(0);
  });

  it('works with no localStorage at all', () => {
    // A school machine with storage switched off must get a working app, not a
    // blank screen. This suite runs in node, where there is no localStorage —
    // so every test above is already the assertion. This one says so out loud.
    expect(() => {
      const log = new ObservationLog([]);
      log.add(row(2_432_000));
      log.clear();
    }).not.toThrow();
  });
});
