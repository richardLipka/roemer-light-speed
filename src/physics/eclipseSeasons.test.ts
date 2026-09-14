/**
 * Which moons are eclipsed every orbit, and which are not.
 *
 * **This file used to assert a sampling bug as though it were astronomy.** It
 * recorded Ganymede as missing 3 eclipses a year and Callisto as catching only
 * 8 of 21, and explained both as the moons riding out of the shadow. Checked
 * against a brute-force scan, neither was true: the scanner's step was
 * `period / 48`, which for the outer moons is *longer than the eclipse it was
 * looking for*, and it was stepping over real events. Ganymede never misses one
 * at all, and Callisto in 1676 is eclipsed on every single revolution.
 *
 * What is real is the other half of the story, and it is sharper than the
 * version that was written down: Callisto's eclipse seasons are total, not
 * partial. It is eclipsed on all 22 revolutions in 1676 and on none whatever in
 * 1679. The tests below hold both halves — the moons that never miss, and the
 * one that misses for years — against ground truth rather than against whatever
 * the scanner happens to find.
 */

import { describe, expect, it } from 'vitest';
import { AU_IN_KM, BODIES, jdFromCalendar } from '@orrery/core';
import { satelliteOffsetAt } from '@orrery/core/satellites';
import { vsop87Engine } from '@orrery/core/engines/vsop87';

import { JUPITER_SHADOW_RADIUS_KM, umbraLengthKm } from './constants.js';
import { findEclipses, nextEclipse } from './eclipses.js';
import { cachedPositions } from './lightTime.js';
import { shadowAxis, shadowState } from './shadow.js';

const positions = cachedPositions((jd) => vsop87Engine.positionsAt(jd));

type Moon = 'io' | 'europa' | 'ganymede' | 'callisto';
const MOONS = ['io', 'europa', 'ganymede', 'callisto'] as const;

const outOfPlaneKm = (id: Moon) => {
  const orbit = BODIES[id].satellite!;
  return orbit.a * AU_IN_KM * Math.sin((orbit.i * Math.PI) / 180);
};

const umbraAtKm = (id: Moon) => {
  const aKm = BODIES[id].satellite!.a * AU_IN_KM;
  return JUPITER_SHADOW_RADIUS_KM * (1 - aKm / umbraLengthKm(5.2));
};

const eclipsesIn = (id: Moon, jd: number, days: number) =>
  findEclipses(positions, id, jd, jd + days).filter((e) => e.phase === 'disappearance').length;

const revolutionsIn = (id: Moon, days: number) =>
  Math.floor(days / BODIES[id].satellite!.periodDays);

/**
 * Ground truth, by brute force: how many times the moon's centre actually
 * enters the umbra, sampled far finer than any eclipse is short.
 *
 * The point of this file is to check the production scanner against something
 * that does not share its assumptions, so this deliberately does not call
 * `findEclipses`. The shadow axis is quantised to 0.05 d — it turns by nothing
 * worth counting in that time — so the engine is not asked once per sample.
 */
function trueEclipseCount(id: Moon, jdFrom: number, days: number): number {
  const period = BODIES[id].satellite!.periodDays;
  const step = period / 3000;
  let count = 0;
  let inside = false;
  for (let jd = jdFrom; jd < jdFrom + days; jd += step) {
    const sky = positions(Math.round(jd / 0.05) * 0.05);
    const axis = shadowAxis(sky.get('sun')!, sky.get('jupiter')!);
    const state = shadowState(axis, satelliteOffsetAt(jd, id)!);
    const now = state.behindKm > 0 && state.offAxisKm < state.umbraRadiusKm;
    if (now && !inside) count++;
    inside = now;
  }
  return count;
}

const JD_1676 = jdFromCalendar(1676, 1, 1); // Callisto in season
const JD_1679 = jdFromCalendar(1679, 1, 1); // Callisto out of season

describe('the scanner finds every eclipse that happens', () => {
  // The regression this file exists for. A step scaled to the orbit rather than
  // to the shadow crossing lost 14 of Callisto's 22 and 3 of Ganymede's 51.
  for (const id of MOONS) {
    for (const [label, jd] of [
      ['1676', JD_1676],
      ['1679', JD_1679],
    ] as const) {
      it(`${id}, ${label}: agrees with a brute-force scan`, () => {
        expect(eclipsesIn(id, jd, 365)).toBe(trueEclipseCount(id, jd, 365));
      });
    }
  }
});

describe('the inner three are eclipsed on every revolution', () => {
  // Io and Europa clear the plane test outright. Ganymede does not by much, and
  // was written up as missing a few on that basis — but it never does.
  for (const id of ['io', 'europa', 'ganymede'] as const) {
    it(`${id} is eclipsed every time round`, () => {
      expect(outOfPlaneKm(id)).toBeLessThan(umbraAtKm(id));
      for (const jd of [JD_1676, JD_1679]) {
        // Within one, because a year is not a whole number of revolutions.
        expect(eclipsesIn(id, jd, 365)).toBeGreaterThanOrEqual(revolutionsIn(id, 365) - 1);
        expect(eclipsesIn(id, jd, 365)).toBeLessThanOrEqual(revolutionsIn(id, 365) + 1);
      }
    });
  }
});

describe('Callisto has eclipse seasons, and they are total', () => {
  it('rides clear of the shadow by the plane test', () => {
    // 72 601 km out of plane against a 69 981 km umbra — the one moon of the
    // four that can miss, and the reason the seasons exist at all.
    expect(outOfPlaneKm('callisto')).toBeGreaterThan(umbraAtKm('callisto'));
  });

  it('is eclipsed on every revolution while in season', () => {
    expect(eclipsesIn('callisto', JD_1676, 365)).toBeGreaterThanOrEqual(
      revolutionsIn('callisto', 365),
    );
  });

  it('is eclipsed on none at all while out of season', () => {
    // Not "a few": none. The line of nodes has turned far enough that the moon
    // passes above or below the shadow on every pass, for a year together.
    expect(eclipsesIn('callisto', JD_1679, 365)).toBe(0);
  });
});

describe('the "next eclipse" control always finds one', () => {
  it('never throws, on any moon, in or out of season', () => {
    // It used to, on four of five years sampled: Callisto's off-season runs to
    // 74 revolutions and the search gave up after twenty, so choosing Callisto
    // and pressing the button took the click handler down.
    for (const year of [1676, 1678, 1679, 1680, 1682, 1685]) {
      const jd = jdFromCalendar(year, 6, 1);
      for (const id of MOONS) {
        expect(() => nextEclipse(positions, id, jd), `${id} in ${year}`).not.toThrow();
      }
    }
  }, 60_000);
});
