import { describe, expect, it } from 'vitest';
import { BODIES, jdFromCalendar } from '@orrery/core';
import { vsop87Engine } from '@orrery/core/engines/vsop87';

import { SECONDS_PER_DAY } from './constants.js';
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

  it('matches on SEEN time, not on true time', () => {
    // The only clock an observer has is the arrival of the news. Pressing at
    // the *true* instant is pressing three quarters of an hour early, and if
    // that matched, the log would be built on a clock nobody has.
    const atTrueInstant = someEclipse.jdTrue;
    const matched = nearestEclipse(positions, 'io', atTrueInstant, 5 / 1440);
    expect(matched).toBeNull();
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
    const matched = nearestEclipse(
      positions,
      'io',
      reappearance.jdSeen,
      30 / 1440,
      'reappearance',
    );
    expect(matched?.phase).toBe('reappearance');
  });

  it('respects the tolerance it is given', () => {
    const pressed = someEclipse.jdSeen + 20 / 1440;
    expect(nearestEclipse(positions, 'io', pressed, 30 / 1440)).not.toBeNull();
    expect(nearestEclipse(positions, 'io', pressed, 10 / 1440)).toBeNull();
  });
});
