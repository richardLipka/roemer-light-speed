/**
 * Jupiter's shadow, and whether a moon is in it.
 *
 * The umbra is a **cone**, because the Sun is not a point. It starts at
 * Jupiter's equatorial radius and converges to nothing some 8.9×10⁷ km behind
 * the planet, so where Io crosses it — 421 800 km out — it is 0.47% narrower
 * than at the planet. That is 338 km, and at Io's orbital speed it is **19.5
 * seconds** of eclipse timing. Modelling it costs one multiplication; treating
 * the shadow as a cylinder and arguing the error away costs a paragraph and
 * leaves a systematic in the data. See `constants.ts`.
 *
 * Everything here works in **km**, converted at the boundary. The engines work
 * in AU, where Jupiter's radius is 4.8×10⁻⁴ and Io's orbit 2.8×10⁻³ — numbers
 * that are hard to sanity-check by eye, in a module whose entire job is a
 * comparison of small lengths.
 */

import type { Vec3 } from '@orrery/core';
import { AU_IN_KM, dot, scale, sub } from '@orrery/core';
import { length, normalize } from '@orrery/core/vec';

import { JUPITER_SHADOW_RADIUS_KM, umbraLengthKm } from './constants.js';

/** The shadow's axis and how fast it narrows, for one instant. */
export interface ShadowAxis {
  /** Unit vector from the Sun towards Jupiter — the direction the shadow runs. */
  direction: Vec3;
  /** Sun–Jupiter distance, AU, which sets the cone's length. */
  sunDistanceAu: number;
  /** Distance behind Jupiter at which the umbra closes to a point, km. */
  coneLengthKm: number;
}

export function shadowAxis(sunPosition: Vec3, jupiterPosition: Vec3): ShadowAxis {
  const sunToJupiter = sub(jupiterPosition, sunPosition);
  const sunDistanceAu = length(sunToJupiter);
  return {
    direction: normalize(sunToJupiter),
    sunDistanceAu,
    coneLengthKm: umbraLengthKm(sunDistanceAu),
  };
}

/** Radius of the umbra at a given distance behind Jupiter, km. */
export const umbraRadiusKm = (axis: ShadowAxis, behindKm: number): number =>
  JUPITER_SHADOW_RADIUS_KM * (1 - behindKm / axis.coneLengthKm);

export interface ShadowState {
  /** How far behind Jupiter, along the shadow axis, km. Negative = sunward. */
  behindKm: number;
  /** Perpendicular distance from the shadow axis, km. */
  offAxisKm: number;
  /** The umbra's radius at this point along the axis, km. */
  umbraRadiusKm: number;
  /** True when the moon's centre is inside the umbra. */
  eclipsed: boolean;
}

/**
 * Where a moon stands relative to the shadow.
 *
 * `moonOffset` is the moon relative to **Jupiter**, in AU — exactly what
 * `satelliteOffsetAt` returns, which is why the eclipse solver can vary the moon
 * without touching the n-body engine.
 */
export function shadowState(axis: ShadowAxis, moonOffsetAu: Vec3): ShadowState {
  const offset = scale(moonOffsetAu, AU_IN_KM);
  const behindKm = dot(offset, axis.direction);
  const offAxisKm = length(sub(offset, scale(axis.direction, behindKm)));
  const radius = umbraRadiusKm(axis, behindKm);
  return {
    behindKm,
    offAxisKm,
    umbraRadiusKm: radius,
    eclipsed: behindKm > 0 && offAxisKm < radius,
  };
}

/**
 * A single continuous number that is negative exactly when the moon is
 * eclipsed — the function the solver bisects.
 *
 * Two conditions have to hold at once: the moon must be *behind* Jupiter, and it
 * must be *within* the umbra's radius. Taking the larger of the two signed
 * quantities gives a single value that is negative only when both are, and stays
 * continuous across the boundary, which a boolean pair does not.
 *
 * The `-behindKm` term never actually produces the root in practice — an eclipse
 * happens deep behind the planet, where that term is hugely negative and the
 * radial term does all the work. It is here so the function is well defined
 * across the whole orbit and a bracket can never straddle a discontinuity.
 */
export function shadowFunctionKm(axis: ShadowAxis, moonOffsetAu: Vec3): number {
  const state = shadowState(axis, moonOffsetAu);
  return Math.max(state.offAxisKm - state.umbraRadiusKm, -state.behindKm);
}
