/**
 * Everything the interface draws for one instant, computed in one place.
 *
 * The views below are deliberately dumb — they take this object and write CSS
 * custom properties. All the deciding happens here, so the plan view, the
 * telescope strip and the readout can never disagree about where Io is.
 */

import type { BodyId, Vec3 } from '@orrery/core';
import { AU_IN_KM, sub } from '@orrery/core';
import { nbodyEngine } from '@orrery/core/engines/nbody';
import { satelliteOffsetAt } from '@orrery/core/satellites';
import { length } from '@orrery/core/vec';

import { GALILEAN_IDS, type GalileanId, SECONDS_PER_DAY } from '../physics/constants.js';
import { cachedPositions, retardedPosition } from '../physics/lightTime.js';
import { shadowAxis, shadowState } from '../physics/shadow.js';

/** Newton is the engine on show — CLAUDE.md §1. */
const positions = cachedPositions((jd) => nbodyEngine.positionsAt(jd));

export interface MoonView {
  id: GalileanId;
  /** Offset from Jupiter as Earth sees it now, AU. */
  seen: Vec3;
  /** Offset from Jupiter as it actually is now, AU. */
  actual: Vec3;
  /** True when the moon Earth is looking at is inside the shadow. */
  eclipsed: boolean;
  /** Degrees of its own orbit between the two — 5 to 7 for Io. */
  ghostSeparationDegrees: number;
}

export interface Scene {
  jd: number;
  /** Where the Sun, Earth and Jupiter are, heliocentric AU. */
  sun: Vec3;
  earth: Vec3;
  jupiter: Vec3;
  /** As Earth sees it — the tiny offset the plan view cannot resolve. */
  jupiterSeen: Vec3;
  earthJupiterAu: number;
  lightTimeMinutes: number;
  moons: MoonView[];
}

export function buildScene(jd: number, moonPeriodDays: Record<GalileanId, number>): Scene {
  const now = positions(jd);
  const sun = now.get('sun')!;
  const earth = now.get('earth')!;
  const jupiter = now.get('jupiter')!;

  const retarded = retardedPosition(positions, 'jupiter', 'earth', jd);
  const jdEmitted = retarded.jdEmitted;

  // The shadow at the moment the light left, because that is the configuration
  // the observer is actually looking at.
  const emitted = positions(jdEmitted);
  const axis = shadowAxis(emitted.get('sun')!, emitted.get('jupiter')!);

  const moons = GALILEAN_IDS.map((id): MoonView => {
    const seen = satelliteOffsetAt(jdEmitted, id)!;
    const actual = satelliteOffsetAt(jd, id)!;
    return {
      id,
      seen,
      actual,
      eclipsed: shadowState(axis, seen).eclipsed,
      ghostSeparationDegrees: (retarded.lightTimeDays / moonPeriodDays[id]) * 360,
    };
  });

  return {
    jd,
    sun,
    earth,
    jupiter,
    jupiterSeen: retarded.seen,
    earthJupiterAu: retarded.distanceAu,
    lightTimeMinutes: (retarded.lightTimeDays * SECONDS_PER_DAY) / 60,
    moons,
  };
}

/** Distance between two bodies right now, km — for the readout. */
export const separationKm = (a: Vec3, b: Vec3): number => length(sub(a, b)) * AU_IN_KM;

export const bodyAt = (jd: number, id: BodyId): Vec3 => positions(jd).get(id)!;

/** The shared, cached provider, so the eclipse solver and the views agree. */
export const scenePositions = positions;
