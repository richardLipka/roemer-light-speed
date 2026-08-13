/**
 * Everything the interface draws for one instant, computed in one place.
 *
 * The views below are deliberately dumb — they take this object and write CSS
 * custom properties. All the deciding happens here, so the plan view, the
 * telescope strip and the readout can never disagree about where Io is.
 */

import type { BodyId, Vec3 } from '@orrery/core';
import { AU_IN_KM, cross, dot, sub, vec3 } from '@orrery/core';
import { nbodyEngine } from '@orrery/core/engines/nbody';
import { satelliteOffsetAt } from '@orrery/core/satellites';
import { length, normalize } from '@orrery/core/vec';

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
  /**
   * True when the moon is inside the shadow *now* — what an observer would see
   * if light were infinitely fast.
   *
   * Tested against the shadow at `jd` rather than at emission, so both halves of
   * the pair are internally consistent: this is the whole system as it stands at
   * this instant, news or no news. During the half hour or so between the two,
   * the real moon is already dark while the eyepiece still shows it shining —
   * which is the demonstration the telescope's second lane exists to make.
   */
  eclipsedActual: boolean;
  /** Degrees of its own orbit between the two — 5 to 7 for Io. */
  ghostSeparationDegrees: number;
  /**
   * Sideways from Jupiter as seen from Earth, AU — the telescope's one axis.
   *
   * Measured along a bearing perpendicular to the Earth–Jupiter line, not along
   * the ecliptic x axis. Those coincide only when Earth happens to lie due
   * y-ward of Jupiter, and using x regardless made the moons' spread wander
   * with the season for no physical reason. This is what ties the eyepiece to
   * the plan view: the same configuration, seen end-on.
   */
  acrossAu: number;
  /** The same axis, for where the moon really is now. */
  acrossActualAu: number;
  /** Further from Earth than Jupiter is — so hidden behind the planet. */
  behindPlanet: boolean;
  behindPlanetActual: boolean;
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

export function buildScene(
  jd: number,
  moonPeriodDays: Record<GalileanId, number>,
  perAuDays?: number,
): Scene {
  const now = positions(jd);
  const sun = now.get('sun')!;
  const earth = now.get('earth')!;
  const jupiter = now.get('jupiter')!;

  const retarded = retardedPosition(positions, 'jupiter', 'earth', jd, perAuDays);
  const jdEmitted = retarded.jdEmitted;

  // The shadow at the moment the light left, because that is the configuration
  // the observer is actually looking at.
  const emitted = positions(jdEmitted);
  const axis = shadowAxis(emitted.get('sun')!, emitted.get('jupiter')!);

  // The line of sight, and a bearing square to it in the ecliptic plane. The
  // telescope sees the second and is blind to the first.
  const sight = normalize(sub(retarded.seen, earth));
  const across = normalize(cross(sight, vec3(0, 0, 1)));

  // The same pair of axes for the system as it stands now, drawn to Jupiter's
  // real position rather than its apparent one. The two bearings differ by about
  // a hundredth of a degree, which changes nothing anyone can see — but taking
  // the trouble means the second lane of the telescope is a straight answer to
  // "what would this look like if light were instantaneous" rather than a
  // half-corrected mixture of the two cases.
  const axisNow = shadowAxis(sun, jupiter);
  const sightNow = normalize(sub(jupiter, earth));
  const acrossNow = normalize(cross(sightNow, vec3(0, 0, 1)));

  const moons = GALILEAN_IDS.map((id): MoonView => {
    const seen = satelliteOffsetAt(jdEmitted, id)!;
    const actual = satelliteOffsetAt(jd, id)!;
    return {
      id,
      seen,
      actual,
      eclipsed: shadowState(axis, seen).eclipsed,
      eclipsedActual: shadowState(axisNow, actual).eclipsed,
      ghostSeparationDegrees: (retarded.lightTimeDays / moonPeriodDays[id]) * 360,
      acrossAu: dot(seen, across),
      acrossActualAu: dot(actual, acrossNow),
      behindPlanet: dot(seen, sight) > 0,
      behindPlanetActual: dot(actual, sightNow) > 0,
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
