/**
 * Which moons are eclipsed every orbit, and which are not.
 *
 * The interface said all four vanished into the shadow once per revolution.
 * Two of them do not, and this file is what caught it: a moon is eclipsed every
 * orbit only while its excursion out of Jupiter's orbital plane stays inside the
 * umbra, and that fails further out. Real Callisto has eclipse seasons for
 * exactly this reason, so the model is right and the sentence was wrong.
 */

import { describe, expect, it } from 'vitest';
import { AU_IN_KM, BODIES, jdFromCalendar } from '@orrery/core';
import { vsop87Engine } from '@orrery/core/engines/vsop87';

import { JUPITER_SHADOW_RADIUS_KM, umbraLengthKm } from './constants.js';
import { findEclipses, nextEclipse } from './eclipses.js';
import { cachedPositions } from './lightTime.js';

const positions = cachedPositions((jd) => vsop87Engine.positionsAt(jd));
const JD = jdFromCalendar(1676, 1, 1);

const outOfPlaneKm = (id: 'io' | 'europa' | 'ganymede' | 'callisto') => {
  const orbit = BODIES[id].satellite!;
  return orbit.a * AU_IN_KM * Math.sin((orbit.i * Math.PI) / 180);
};

const umbraAtKm = (id: 'io' | 'europa' | 'ganymede' | 'callisto') => {
  const aKm = BODIES[id].satellite!.a * AU_IN_KM;
  return JUPITER_SHADOW_RADIUS_KM * (1 - aKm / umbraLengthKm(5.2));
};

const eclipsesIn = (id: 'io' | 'europa' | 'ganymede' | 'callisto', days: number) =>
  findEclipses(positions, id, JD, JD + days).filter((e) => e.phase === 'disappearance').length;

const revolutionsIn = (id: 'io' | 'europa' | 'ganymede' | 'callisto', days: number) =>
  Math.floor(days / BODIES[id].satellite!.periodDays);

describe('the inner two are eclipsed every orbit', () => {
  for (const id of ['io', 'europa'] as const) {
    it(`${id} clears the shadow on no revolution`, () => {
      expect(outOfPlaneKm(id)).toBeLessThan(umbraAtKm(id));
      expect(eclipsesIn(id, 365)).toBe(revolutionsIn(id, 365));
    });
  }
});

describe('the outer two have eclipse seasons', () => {
  it('Ganymede misses a few', () => {
    // Still inside the umbra by the plane test, but close enough to it that the
    // geometry of the moment decides — 48 of 51 over a year.
    const eclipses = eclipsesIn('ganymede', 365);
    expect(eclipses).toBeLessThan(revolutionsIn('ganymede', 365));
    expect(eclipses).toBeGreaterThan(revolutionsIn('ganymede', 365) * 0.85);
  });

  it('Callisto misses most of them', () => {
    // 72 601 km out of plane against a 69 981 km umbra: it genuinely passes
    // above and below the shadow, and goes months without an eclipse.
    expect(outOfPlaneKm('callisto')).toBeGreaterThan(umbraAtKm('callisto'));
    expect(eclipsesIn('callisto', 365)).toBeLessThan(revolutionsIn('callisto', 365) * 0.6);
  });

  it('still lets the "next eclipse" control find one', () => {
    // The search gives up after twenty orbits. Callisto's widest measured gap is
    // five, so this is a real margin — but it is a margin, not an impossibility,
    // which is why the cap was raised from ten.
    for (const id of ['io', 'europa', 'ganymede', 'callisto'] as const) {
      expect(() => nextEclipse(positions, id, JD)).not.toThrow();
    }
  });

  it('never leaves a gap wider than the search window', () => {
    const eclipses = findEclipses(positions, 'callisto', JD, JD + 730).filter(
      (e) => e.phase === 'disappearance',
    );
    let widest = 0;
    for (let i = 1; i < eclipses.length; i++) {
      widest = Math.max(widest, eclipses[i]!.jdTrue - eclipses[i - 1]!.jdTrue);
    }
    expect(widest / BODIES.callisto.satellite!.periodDays).toBeLessThan(20);
  });
});
