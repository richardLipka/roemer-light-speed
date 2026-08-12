import { describe, expect, it } from 'vitest';
import { AU_IN_KM, vec3 } from '@orrery/core';
import type { BodyId } from '@orrery/core';
import type { PositionSet } from '@orrery/core/engines/types';

import { C_AU_PER_DAY, LIGHT_TIME_PER_AU_S, SECONDS_PER_DAY } from './constants.js';
import { cachedPositions, lightTimeDays, retardedPosition, seenAt } from './lightTime.js';

/**
 * A toy system with a known answer: the observer sits still at the origin and
 * the target runs along +x at a constant speed. Driving the solver with an
 * analytic orbit rather than an integrator is the point of `PositionsAt` being
 * a parameter — the assertions below are about the retardation, not about
 * anybody's ephemeris.
 */
const straightLine = (speedAuPerDay: number, startAu: number) => {
  return (jd: number): PositionSet =>
    new Map<BodyId, ReturnType<typeof vec3>>([
      ['earth', vec3(0, 0, 0)],
      ['jupiter', vec3(startAu + speedAuPerDay * jd, 0, 0)],
    ]);
};

describe('light time', () => {
  it('crosses one AU in 499.005 seconds', () => {
    expect(LIGHT_TIME_PER_AU_S).toBeCloseTo(499.005, 3);
    expect(lightTimeDays(1) * SECONDS_PER_DAY).toBeCloseTo(499.005, 3);
  });

  it('crosses the diameter of Earth’s orbit in 16.6 minutes', () => {
    // The number the whole app is arranged around, and the one Rømer put at 22.
    const minutes = (2 * LIGHT_TIME_PER_AU_S) / 60;
    expect(minutes).toBeGreaterThan(16.6);
    expect(minutes).toBeLessThan(16.7);
  });

  it('has c near 173 AU per day, as the units demand', () => {
    expect(C_AU_PER_DAY).toBeCloseTo(173.14, 2);
  });
});

describe('retardation', () => {
  it('solves the implicit equation, not merely the first guess', () => {
    // Moving fast enough that one pass would be visibly wrong.
    const positions = straightLine(0.05, 5);
    const result = retardedPosition(positions, 'jupiter', 'earth', 0);

    // Self-consistency is the whole definition: the light left where the body
    // was at the emission date, and took exactly that long to arrive.
    expect(result.seen.x).toBeCloseTo(5 + 0.05 * result.jdEmitted, 12);
    expect(result.lightTimeDays).toBeCloseTo(result.distanceAu / C_AU_PER_DAY, 12);
    expect(result.jdEmitted).toBeCloseTo(-result.lightTimeDays, 12);
  });

  it('converges in three passes at solar-system speeds', () => {
    // Jupiter's actual pace, ~0.0047 AU/day.
    const result = retardedPosition(straightLine(0.0047, 5.2), 'jupiter', 'earth', 0);
    expect(result.iterations).toBeLessThanOrEqual(3);
  });

  it('separates where a body is seen from where it is', () => {
    const result = retardedPosition(straightLine(0.0047, 5.2), 'jupiter', 'earth', 0);
    const gapAu = Math.abs(result.actual.x - result.seen.x);
    // Half an hour of Jupiter's motion — small, real, and never to be
    // exaggerated on the map (CLAUDE.md §9).
    expect(gapAu).toBeGreaterThan(0);
    expect(gapAu * AU_IN_KM).toBeCloseTo(0.0047 * result.lightTimeDays * AU_IN_KM, 6);
  });
});

describe('seenAt', () => {
  it('is the inverse of retardation', () => {
    const positions = straightLine(0.0047, 5.2);
    const forward = seenAt(positions, 'jupiter', 'earth', 0);
    const backward = retardedPosition(positions, 'jupiter', 'earth', forward.jdSeen);
    expect(backward.jdEmitted).toBeCloseTo(0, 9);
  });

  it('accounts for the observer moving while the light is in transit', () => {
    // Observer running away from the target: the light has further to go than
    // the gap at the moment it left, so a single pass would undercount.
    const drifting = (jd: number): PositionSet =>
      new Map<BodyId, ReturnType<typeof vec3>>([
        ['earth', vec3(-0.017 * jd, 0, 0)],
        ['jupiter', vec3(5.2, 0, 0)],
      ]);

    const result = seenAt(drifting, 'jupiter', 'earth', 0);
    const naive = lightTimeDays(5.2);
    expect(result.lightTimeDays).toBeGreaterThan(naive);
    expect(result.distanceAu).toBeCloseTo(5.2 + 0.017 * result.lightTimeDays, 9);
  });
});

describe('cachedPositions', () => {
  it('asks the engine once per date', () => {
    let calls = 0;
    const counted = (jd: number): PositionSet => {
      calls++;
      return straightLine(0.0047, 5.2)(jd);
    };
    const cached = cachedPositions(counted);

    cached(2_450_000);
    cached(2_450_000);
    cached(2_450_000.5);
    expect(calls).toBe(2);
  });
});
