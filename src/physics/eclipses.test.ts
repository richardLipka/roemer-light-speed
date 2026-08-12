import { describe, expect, it } from 'vitest';
import { BODIES, jdFromCalendar } from '@orrery/core';
import { vsop87Engine } from '@orrery/core/engines/vsop87';

import { LIGHT_TIME_PER_AU_S, SECONDS_PER_DAY } from './constants.js';
import { eclipsePeriodDays, findEclipses, nextEclipse } from './eclipses.js';
import { cachedPositions } from './lightTime.js';

const positions = cachedPositions((jd) => vsop87Engine.positionsAt(jd));
const IO_SIDEREAL = BODIES.io.satellite!.periodDays;
const IO_ECLIPSE_PERIOD = eclipsePeriodDays('io');

const JD_1676 = jdFromCalendar(1676, 1, 1);

describe('the eclipse period', () => {
  it('is the synodic period, 62 seconds longer than the sidereal one', () => {
    // Discovered by this suite failing, and it matters: the shadow turns with
    // Jupiter, so a moon must go slightly further than once round to meet it.
    const extraSeconds = (IO_ECLIPSE_PERIOD - IO_SIDEREAL) * SECONDS_PER_DAY;
    expect(extraSeconds).toBeGreaterThan(60);
    expect(extraSeconds).toBeLessThan(64);
    expect(IO_ECLIPSE_PERIOD).toBeCloseTo(1.76986, 4);
  });

  it('accumulates over a year to far more than the effect being measured', () => {
    // Three and a half hours against a 16.6-minute signal — which is why the
    // solver numbers eclipses with this period and never the sidereal one.
    const orbits = Math.floor(365 / IO_ECLIPSE_PERIOD);
    const driftHours = ((IO_ECLIPSE_PERIOD - IO_SIDEREAL) * orbits * SECONDS_PER_DAY) / 3600;
    expect(driftHours).toBeGreaterThan(3);
  });
});

describe('finding eclipses of Io', () => {
  const year = findEclipses(positions, 'io', JD_1676, JD_1676 + 365);

  it('finds one disappearance and one reappearance per revolution', () => {
    // 365 days at 1.769 days an orbit is 206 revolutions, and every one of them
    // produces both events — shadow.test.ts holds the geometry that guarantees
    // it, and this holds that the solver actually catches them.
    const revolutions = Math.floor(365 / IO_ECLIPSE_PERIOD);
    expect(year.filter((e) => e.phase === 'disappearance').length).toBeGreaterThanOrEqual(
      revolutions - 1,
    );
    expect(year.filter((e) => e.phase === 'reappearance').length).toBeGreaterThanOrEqual(
      revolutions - 1,
    );
  });

  it('alternates the two phases without ever repeating one', () => {
    for (let i = 1; i < year.length; i++) {
      expect(year[i]!.phase).not.toBe(year[i - 1]!.phase);
    }
  });

  it('spaces consecutive disappearances by Io’s period in TRUE time', () => {
    // The assertion the whole measurement rests on: the clock in the sky really
    // does tick evenly, and any unevenness in what we SEE is therefore about
    // light and nothing else.
    const disappearances = year.filter((e) => e.phase === 'disappearance');
    for (let i = 1; i < disappearances.length; i++) {
      const gap = disappearances[i]!.jdTrue - disappearances[i - 1]!.jdTrue;
      expect(gap).toBeCloseTo(IO_ECLIPSE_PERIOD, 3);
    }
  });

  it('does NOT space consecutive disappearances evenly in SEEN time', () => {
    // The same list, through the light-time correction: the spacing now varies,
    // and that variation is the entire experiment.
    const disappearances = year.filter((e) => e.phase === 'disappearance');
    const gaps = disappearances
      .slice(1)
      .map((e, i) => e.jdSeen - disappearances[i]!.jdSeen);
    const spreadSeconds = (Math.max(...gaps) - Math.min(...gaps)) * SECONDS_PER_DAY;
    // Up to about 15 s per orbit, accumulating to the famous 16.6 minutes.
    expect(spreadSeconds).toBeGreaterThan(20);
  });

  it('keeps the moon in shadow for a couple of hours', () => {
    const disappearance = year.find((e) => e.phase === 'disappearance')!;
    const reappearance = year.find(
      (e) => e.phase === 'reappearance' && e.jdTrue > disappearance.jdTrue,
    )!;
    const hours = (reappearance.jdTrue - disappearance.jdTrue) * 24;
    expect(hours).toBeGreaterThan(1.5);
    expect(hours).toBeLessThan(3);
  });
});

describe('the light-time signal', () => {
  const year = findEclipses(positions, 'io', JD_1676, JD_1676 + 400);

  it('swings by rather more than the 16.6 minutes of Earth’s orbit alone', () => {
    // 16.63 minutes is the crossing time of Earth's orbital diameter, and would
    // be the whole answer if Jupiter stood still. It does not: over these 400
    // days it moves some 33° and its own eccentricity of 0.049 shifts it too, so
    // the observed swing runs a little past that. The pure 2-AU figure is
    // asserted on its own in lightTime.test.ts.
    const times = year.map((e) => (e.lightTimeDays * SECONDS_PER_DAY) / 60);
    const swing = Math.max(...times) - Math.min(...times);
    expect(swing).toBeGreaterThan(16.6);
    expect(swing).toBeLessThan(19);
  });

  it('runs from about 35 to about 52 minutes', () => {
    const minutes = year.map((e) => (e.lightTimeDays * SECONDS_PER_DAY) / 60);
    expect(Math.min(...minutes)).toBeGreaterThan(33);
    expect(Math.max(...minutes)).toBeLessThan(54);
  });

  it('tracks the Earth–Jupiter distance exactly', () => {
    for (const eclipse of year.slice(0, 20)) {
      const minutes = (eclipse.lightTimeDays * SECONDS_PER_DAY) / 60;
      expect(minutes).toBeCloseTo((eclipse.distanceAu * LIGHT_TIME_PER_AU_S) / 60, 9);
    }
  });
});

describe('how long the disappearance takes', () => {
  it('is three and a half minutes for Io — a fifth of the whole signal', () => {
    // The reason Rømer needed many eclipses rather than two, and the reason the
    // log records what the student pressed rather than the true instant.
    const eclipse = nextEclipse(positions, 'io', JD_1676, 'disappearance');
    const minutes = eclipse.ingressDurationDays * 24 * 60;
    expect(minutes).toBeGreaterThan(3);
    expect(minutes).toBeLessThan(4);
  });

  it('is longer for the bigger, slower moons', () => {
    const io = nextEclipse(positions, 'io', JD_1676).ingressDurationDays;
    const callisto = nextEclipse(positions, 'callisto', JD_1676).ingressDurationDays;
    expect(callisto).toBeGreaterThan(io);
  });
});

describe('nextEclipse', () => {
  it('returns the first event at or after the date', () => {
    const first = nextEclipse(positions, 'io', JD_1676);
    expect(first.jdTrue).toBeGreaterThanOrEqual(JD_1676);
    expect(first.jdTrue).toBeLessThan(JD_1676 + IO_ECLIPSE_PERIOD);
  });

  it('can be asked for one kind only', () => {
    const disappearance = nextEclipse(positions, 'io', JD_1676, 'disappearance');
    expect(disappearance.phase).toBe('disappearance');
  });

  it('sees every event later than it happened', () => {
    const eclipse = nextEclipse(positions, 'io', JD_1676);
    expect(eclipse.jdSeen).toBeGreaterThan(eclipse.jdTrue);
    // Not to more places than a Julian Date can carry: near JD 2.4 million a
    // double resolves about 40 microseconds, so differencing two of them loses
    // the last few digits of a quantity as small as half an hour.
    expect(eclipse.jdSeen - eclipse.jdTrue).toBeCloseTo(eclipse.lightTimeDays, 9);
  });
});
