import { describe, expect, it } from 'vitest';
import { jdFromCalendar } from '@orrery/core';
import { vsop87Engine } from '@orrery/core/engines/vsop87';

import {
  delayCurve,
  earthJupiterAu,
  extremaBetween,
  nextExtremum,
  SYNODIC_PERIOD_DAYS,
} from './configuration.js';
import { cachedPositions } from './lightTime.js';

const positions = cachedPositions((jd) => vsop87Engine.positionsAt(jd));
const JD_1676 = jdFromCalendar(1676, 1, 1);

describe('nearest and furthest approach', () => {
  const nearest = nextExtremum(positions, JD_1676, 'nearest');
  const furthest = nextExtremum(positions, JD_1676, 'furthest');

  it('puts the nearest approach around 4.2 AU', () => {
    // Jupiter's own eccentricity moves this about, so the window is generous.
    const distance = earthJupiterAu(positions, nearest);
    expect(distance).toBeGreaterThan(3.9);
    expect(distance).toBeLessThan(4.6);
  });

  it('puts the furthest around 6.2 AU', () => {
    const distance = earthJupiterAu(positions, furthest);
    expect(distance).toBeGreaterThan(5.8);
    expect(distance).toBeLessThan(6.5);
  });

  it('really is a turning point, not just a low sample', () => {
    const at = earthJupiterAu(positions, nearest);
    expect(earthJupiterAu(positions, nearest - 10)).toBeGreaterThan(at);
    expect(earthJupiterAu(positions, nearest + 10)).toBeGreaterThan(at);
  });

  it('separates the two by about half a synodic period', () => {
    // Nearest and furthest alternate, so consecutive ones are ~199 days apart.
    const gap = Math.abs(furthest - nearest);
    expect(gap).toBeGreaterThan(SYNODIC_PERIOD_DAYS * 0.3);
    expect(gap).toBeLessThan(SYNODIC_PERIOD_DAYS * 1.2);
  });

  it('always looks forward, never back', () => {
    expect(nearest).toBeGreaterThan(JD_1676);
    expect(nextExtremum(positions, nearest + 1, 'nearest')).toBeGreaterThan(nearest);
  });
});

describe('the delay curve', () => {
  const curve = delayCurve(positions, JD_1676, JD_1676 + 3 * 365);

  it('swings by about 17 minutes over three years', () => {
    // This is the picture the app is for: the delay is not a fixed number, it
    // rises and falls with where Earth and Jupiter stand.
    const minutes = curve.map((s) => s.minutes);
    const swing = Math.max(...minutes) - Math.min(...minutes);
    expect(swing).toBeGreaterThan(16.6);
    expect(swing).toBeLessThan(20);
  });

  it('never leaves the 32 to 54 minute band', () => {
    // The floor is set by Jupiter's own eccentricity: an opposition near its
    // perihelion brings it inside 4 AU, and 3.97 AU is 33.0 minutes of light.
    for (const sample of curve) {
      expect(sample.minutes).toBeGreaterThan(32);
      expect(sample.minutes).toBeLessThan(54);
    }
  });

  it('tracks distance exactly, because that is all it is', () => {
    for (const sample of curve.slice(0, 10)) {
      expect(sample.minutes).toBeCloseTo((sample.distanceAu * 499.0047838) / 60, 6);
    }
  });
});

describe('marking the extremes on the curve', () => {
  const marks = extremaBetween(positions, JD_1676, JD_1676 + 3 * 365);

  it('finds roughly one of each per synodic period', () => {
    const expected = Math.round((3 * 365) / SYNODIC_PERIOD_DAYS);
    expect(marks.filter((m) => m.kind === 'nearest').length).toBeGreaterThanOrEqual(expected - 1);
    expect(marks.filter((m) => m.kind === 'furthest').length).toBeGreaterThanOrEqual(expected - 1);
  });

  it('alternates them, because they cannot do otherwise', () => {
    for (let i = 1; i < marks.length; i++) {
      expect(marks[i]!.kind).not.toBe(marks[i - 1]!.kind);
    }
  });

  it('puts every "nearest" below every "furthest"', () => {
    const near = marks.filter((m) => m.kind === 'nearest').map((m) => earthJupiterAu(positions, m.jd));
    const far = marks.filter((m) => m.kind === 'furthest').map((m) => earthJupiterAu(positions, m.jd));
    expect(Math.max(...near)).toBeLessThan(Math.min(...far));
  });
});
