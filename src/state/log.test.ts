import { describe, expect, it } from 'vitest';

import type { Observation } from '../physics/solve.js';
import { ObservationLog, parseLog, serializeLog } from './log.js';

const row = (
  jdRecorded: number,
  distanceAu = 5,
  mode: Observation['mode'] = 'seen',
): Observation => ({
  jdRecorded,
  moon: 'io',
  phase: 'disappearance',
  distanceAu,
  mode,
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
    for (const junk of ['{', 'null', '[]', '"hello"', '{"version":3}']) {
      expect(parseLog(junk)).toEqual([]);
    }
  });

  it('drops rows that would reach the solver as NaN', () => {
    const poisoned = JSON.stringify({
      version: 3,
      observations: [
        row(2_432_000),
        { jdRecorded: 'soon', moon: 'io', phase: 'disappearance', distanceAu: 5, mode: 'seen' },
        { jdRecorded: 1, moon: 'io', phase: 'sideways', distanceAu: 5, mode: 'seen' },
        { jdRecorded: 1, moon: 'io', phase: 'disappearance', distanceAu: null, mode: 'seen' },
        { jdRecorded: 1, moon: 'titan', phase: 'disappearance', distanceAu: 5, mode: 'seen' },
      ],
    });
    expect(parseLog(poisoned)).toHaveLength(1);
  });

  it('drops a row that does not say which experiment it belongs to', () => {
    // A version 1 row reaching the solver unlabelled would be counted into
    // whichever experiment happened to be open, and the comparison the student
    // is asked to trust would quietly be between a run and part of itself.
    const unlabelled = JSON.stringify({
      version: 3,
      observations: [{ jdRecorded: 1, moon: 'io', phase: 'disappearance', distanceAu: 5 }],
    });
    expect(parseLog(unlabelled)).toEqual([]);
  });
});

describe('the log', () => {
  it('keeps entries in time order however they arrive', () => {
    const log = new ObservationLog('test', []);
    log.add(row(2_432_010));
    log.add(row(2_432_000));
    expect(log.entries.map((o) => o.jdRecorded)).toEqual([2_432_000, 2_432_010]);
  });

  it('tells its subscribers when it changes', () => {
    const log = new ObservationLog('test', []);
    let notifications = 0;
    log.subscribe(() => notifications++);

    log.add(row(2_432_000));
    log.clear();
    expect(notifications).toBe(2);
  });

  it('stops telling them once they unsubscribe', () => {
    const log = new ObservationLog('test', []);
    let notifications = 0;
    const stop = log.subscribe(() => notifications++);
    stop();
    log.add(row(2_432_000));
    expect(notifications).toBe(0);
  });

  it('keeps the two experiments apart', () => {
    // Both are kept, so a student can build one run, build the other, and flip
    // between them — but nothing may ever analyse them together.
    const log = new ObservationLog('test', [
      row(2_432_000),
      row(2_432_001, 5, 'true'),
      row(2_432_002),
    ]);
    expect(log.countIn('seen')).toBe(2);
    expect(log.countIn('true')).toBe(1);
    expect(log.in('true').map((o) => o.jdRecorded)).toEqual([2_432_001]);
  });

  it('clears one experiment without touching the other', () => {
    const log = new ObservationLog('test', [row(2_432_000), row(2_432_001, 5, 'true')]);
    log.clearMode('seen');
    expect(log.countIn('seen')).toBe(0);
    expect(log.countIn('true')).toBe(1);
  });

  it('replaces one experiment’s rows and leaves the other’s alone', () => {
    const log = new ObservationLog('test', [row(2_432_000), row(2_432_001, 5, 'true')]);
    log.replaceMode('seen', [row(2_432_010), row(2_432_011)]);
    expect(log.countIn('seen')).toBe(2);
    expect(log.countIn('true')).toBe(1);
    expect(log.count).toBe(3);
  });

  it('works with no localStorage at all', () => {
    // A school machine with storage switched off must get a working app, not a
    // blank screen. This suite runs in node, where there is no localStorage —
    // so every test above is already the assertion. This one says so out loud.
    expect(() => {
      const log = new ObservationLog('test', []);
      log.add(row(2_432_000));
      log.clear();
    }).not.toThrow();
  });
});

