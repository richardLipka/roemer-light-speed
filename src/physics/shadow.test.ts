import { describe, expect, it } from 'vitest';
import { AU_IN_KM, BODIES, vec3 } from '@orrery/core';
import { satelliteOffsetAt } from '@orrery/core/satellites';
import { length } from '@orrery/core/vec';

import { JUPITER_SHADOW_RADIUS_KM, umbraLengthKm } from './constants.js';
import { shadowAxis, shadowFunctionKm, shadowState, umbraRadiusKm } from './shadow.js';

const IO = BODIES.io.satellite!;
const IO_ORBIT_KM = IO.a * AU_IN_KM;

/** Jupiter parked at 5.2 AU along +x, Sun at the origin. */
const axis = shadowAxis(vec3(0, 0, 0), vec3(5.2, 0, 0));

describe('the umbral cone', () => {
  it('narrows by 0.47% across Io’s orbit — not a negligible amount', () => {
    const narrowing = JUPITER_SHADOW_RADIUS_KM - umbraRadiusKm(axis, IO_ORBIT_KM);
    expect(narrowing).toBeGreaterThan(330);
    expect(narrowing).toBeLessThan(345);
    expect(narrowing / JUPITER_SHADOW_RADIUS_KM).toBeCloseTo(0.0047, 4);
  });

  it('would have cost about 20 seconds of timing if taken as a cylinder', () => {
    // The figure that settled it. Io covers ground at 17.3 km/s, so 338 km of
    // shadow radius is 19.5 s — on a signal of 16.6 minutes, and it was very
    // nearly waved away as negligible. See constants.ts.
    const orbitalSpeedKmPerS = (2 * Math.PI * IO_ORBIT_KM) / (IO.periodDays * 86_400);
    const narrowing = JUPITER_SHADOW_RADIUS_KM - umbraRadiusKm(axis, IO_ORBIT_KM);
    const seconds = narrowing / orbitalSpeedKmPerS;
    expect(seconds).toBeGreaterThan(18);
    expect(seconds).toBeLessThan(21);
  });

  it('closes to a point some 89 million km behind the planet', () => {
    expect(umbraLengthKm(5.2) / 1e6).toBeCloseTo(89.1, 1);
    expect(umbraRadiusKm(axis, umbraLengthKm(5.2))).toBeCloseTo(0, 6);
  });
});

describe('the shadow predicate', () => {
  it('puts a moon directly behind Jupiter in shadow, and one in front not', () => {
    const behind = shadowState(axis, vec3(IO.a, 0, 0));
    const inFront = shadowState(axis, vec3(-IO.a, 0, 0));
    expect(behind.eclipsed).toBe(true);
    expect(inFront.eclipsed).toBe(false);
  });

  it('puts a moon beside Jupiter out of shadow', () => {
    const beside = shadowState(axis, vec3(0, IO.a, 0));
    expect(beside.eclipsed).toBe(false);
    expect(beside.offAxisKm).toBeCloseTo(IO_ORBIT_KM, 3);
  });

  it('gives a continuous function that is negative exactly inside', () => {
    // Sampled right round one orbit: sign and predicate must never disagree,
    // which is what makes the value safe to bisect.
    for (let f = 0; f < 1; f += 1 / 512) {
      const angle = 2 * Math.PI * f;
      const offset = vec3(IO.a * Math.cos(angle), IO.a * Math.sin(angle), 0);
      const state = shadowState(axis, offset);
      expect(shadowFunctionKm(axis, offset) < 0).toBe(state.eclipsed);
    }
  });
});

describe('Io’s orbit against the shadow', () => {
  it('stays far enough in the plane that every revolution is eclipsed', () => {
    // The inclination is 2.21° to the ecliptic, which carries Io some 16 300 km
    // out of plane against an umbra 71 154 km across at its distance. That
    // margin is why the solver never has to handle a missed eclipse.
    let worstOutOfPlaneKm = 0;
    for (let jd = 2_451_545; jd < 2_451_545 + 40; jd += 0.01) {
      const offset = satelliteOffsetAt(jd, 'io')!;
      worstOutOfPlaneKm = Math.max(worstOutOfPlaneKm, Math.abs(offset.z) * AU_IN_KM);
    }
    expect(worstOutOfPlaneKm).toBeGreaterThan(15_000);
    expect(worstOutOfPlaneKm).toBeLessThan(umbraRadiusKm(axis, IO_ORBIT_KM) * 0.3);
  });

  it('keeps a near-constant radius, so the crossing geometry is stable', () => {
    const radii: number[] = [];
    for (let jd = 2_451_545; jd < 2_451_545 + 4; jd += 0.01) {
      radii.push(length(satelliteOffsetAt(jd, 'io')!) * AU_IN_KM);
    }
    const min = Math.min(...radii);
    const max = Math.max(...radii);
    expect((max - min) / min).toBeLessThan(0.01); // e = 0.0041
  });
});
