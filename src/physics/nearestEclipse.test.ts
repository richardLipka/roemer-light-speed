import { describe, expect, it } from 'vitest';
import { BODIES, jdFromCalendar } from '@orrery/core';
import { vsop87Engine } from '@orrery/core/engines/vsop87';

import { LIGHT_TIME_PER_AU_DAYS, SECONDS_PER_DAY } from './constants.js';
import { findEclipses, nearestEclipse } from './eclipses.js';
import { cachedPositions } from './lightTime.js';

const positions = cachedPositions((jd) => vsop87Engine.positionsAt(jd));
const JD = jdFromCalendar(1676, 3, 1);
const IO_PERIOD = BODIES.io.satellite!.periodDays;

const someEclipse = findEclipses(positions, 'io', JD, JD + 10)[0]!;

describe('matching a key press to an eclipse', () => {
  it('finds the event the observer was actually watching', () => {
    // Pressed a minute after it vanished, as a person would.
    const pressed = someEclipse.jdSeen + 60 / SECONDS_PER_DAY;
    const matched = nearestEclipse(positions, 'io', pressed);
    expect(matched).not.toBeNull();
    expect(matched!.jdTrue).toBeCloseTo(someEclipse.jdTrue, 6);
  });

  it('matches on SEEN time by default, not on true time', () => {
    // The only clock an observer has is the arrival of the news. Pressing at
    // the *true* instant is pressing three quarters of an hour early, and if
    // that matched by default, the log would be built on a clock nobody has.
    const atTrueInstant = someEclipse.jdTrue;
    const matched = nearestEclipse(positions, 'io', atTrueInstant, { toleranceDays: 5 / 1440 });
    expect(matched).toBeNull();
  });

  it('matches on true time when the control experiment asks it to', () => {
    // The impossible clock, offered deliberately: timing the event itself is
    // how a student checks that the effect exists only because the news has to
    // travel. Asked for explicitly, so it can never happen by accident.
    const matched = nearestEclipse(positions, 'io', someEclipse.jdTrue, {
      toleranceDays: 5 / 1440,
      matchOn: 'true',
    });
    expect(matched?.jdTrue).toBeCloseTo(someEclipse.jdTrue, 6);

    // And the two are genuinely different instants: pressing at the arrival
    // time is now three quarters of an hour late rather than on time.
    expect(
      nearestEclipse(positions, 'io', someEclipse.jdSeen, {
        toleranceDays: 5 / 1440,
        matchOn: 'true',
      }),
    ).toBeNull();
  });

  it('returns nothing for a press with no eclipse near it', () => {
    // Half a period away from anything — a stray key, not an observation.
    const idle = someEclipse.jdSeen + IO_PERIOD / 2;
    expect(nearestEclipse(positions, 'io', idle)).toBeNull();
  });

  it('gives a lateness of the right size, which the old version did not', () => {
    // The regression this file exists for: the recorder used to ask for the
    // next eclipse two periods in the past, so every row came out about 2 800
    // minutes late. Lateness is a light travel time and nothing else.
    const pressed = someEclipse.jdSeen;
    const matched = nearestEclipse(positions, 'io', pressed)!;
    const latenessMinutes = ((pressed - matched.jdTrue) * SECONDS_PER_DAY) / 60;
    expect(latenessMinutes).toBeGreaterThan(30);
    expect(latenessMinutes).toBeLessThan(55);
  });

  it('can be held to one kind of event', () => {
    const reappearance = findEclipses(positions, 'io', JD, JD + 10).find(
      (e) => e.phase === 'reappearance',
    )!;
    const matched = nearestEclipse(positions, 'io', reappearance.jdSeen, {
      phase: 'reappearance',
    });
    expect(matched?.phase).toBe('reappearance');
  });

  it('respects the tolerance it is given', () => {
    const pressed = someEclipse.jdSeen + 20 / 1440;
    expect(nearestEclipse(positions, 'io', pressed, { toleranceDays: 30 / 1440 })).not.toBeNull();
    expect(nearestEclipse(positions, 'io', pressed, { toleranceDays: 10 / 1440 })).toBeNull();
  });

  it('still finds the event behind an arrival when light runs twenty times slower', () => {
    // The game's universe. The light time reaches seventeen hours, a serious
    // fraction of Io's 1.77-day period, so the search window had to widen — and
    // if it ever narrows again this is the test that catches it.
    const slow = 20 * LIGHT_TIME_PER_AU_DAYS;
    const slowEclipse = findEclipses(positions, 'io', JD, JD + 10, slow)[0]!;
    expect((slowEclipse.jdSeen - slowEclipse.jdTrue) * 24).toBeGreaterThan(10);

    const matched = nearestEclipse(positions, 'io', slowEclipse.jdSeen, { perAuDays: slow });
    expect(matched?.jdTrue).toBeCloseTo(slowEclipse.jdTrue, 6);
  });
});
