/**
 * The numbers this app is arranged around.
 *
 * Nothing here is a free parameter. Every value is either exact by definition,
 * taken from `@orrery/core`, or a measured physical constant with its source
 * named — and the one that differs from core's own figure says why.
 */

import { AU_IN_KM, BODIES } from '@orrery/core';

export const SECONDS_PER_DAY = 86_400;

/**
 * Speed of light in vacuum, km/s.
 *
 * Exact, and not by measurement: since 1983 the metre has been *defined* as the
 * distance light travels in 1/299 792 458 of a second, so this number is a
 * definition and cannot be improved on. Worth telling a student at the end of
 * the walkthrough — the quantity Rømer was the first to put a bound on is now
 * the standard that length itself is measured against.
 */
export const C_KM_PER_S = 299_792.458;

/** Light travel time across one astronomical unit, seconds. 499.005 s. */
export const LIGHT_TIME_PER_AU_S = AU_IN_KM / C_KM_PER_S;

/** The same in the units the engines work in: days per AU. */
export const LIGHT_TIME_PER_AU_DAYS = LIGHT_TIME_PER_AU_S / SECONDS_PER_DAY;

/** Speed of light as the engines would express it: AU per day. */
export const C_AU_PER_DAY = 1 / LIGHT_TIME_PER_AU_DAYS;

/**
 * Radius of Jupiter's shadow at the planet, km — the **equatorial** radius, not
 * core's `BODIES.jupiter.radius`.
 *
 * Core stores the *mean* radius, 69 911 km, which is the right figure for
 * drawing a disc. It is the wrong one here. Jupiter is visibly oblate, the
 * Galileans orbit close to its equatorial plane, and the shadow they cross is
 * the one cast by the equatorial section. The 1 581 km difference is not
 * cosmetic: at Io's orbital speed it moves the edge crossing by about a minute
 * and a half, against a signal of sixteen and a half minutes.
 */
export const JUPITER_SHADOW_RADIUS_KM = 71_492;

export const SUN_RADIUS_KM = BODIES.sun.radius;

/**
 * Length of the umbral cone behind Jupiter, km, at a given Sun–Jupiter distance.
 *
 * The shadow is a cone, not a cylinder, because the Sun is not a point. It
 * converges to nothing at
 *
 *     L = R_jupiter · d / (R_sun − R_jupiter)
 *
 * which for Jupiter comes to about 8.9×10⁷ km — and Io orbits at 421 800 km, so
 * the umbra is **0.47% narrower** where Io crosses it than it is at the planet.
 *
 * That taper was very nearly dismissed as negligible and it is not: 338 km at
 * Io's orbital speed is **19.5 seconds** of timing error, on a signal of 16.6
 * minutes. It would have been a systematic shift common to every eclipse, so it
 * would have cancelled out of the fitted speed almost exactly — but "it cancels"
 * is a much weaker thing to rest on than "we modelled it", and modelling it is
 * two lines. See `shadow.ts`.
 */
export const umbraLengthKm = (sunJupiterDistanceAu: number): number =>
  (JUPITER_SHADOW_RADIUS_KM * sunJupiterDistanceAu * AU_IN_KM) /
  (SUN_RADIUS_KM - JUPITER_SHADOW_RADIUS_KM);

/**
 * How long the *penumbra* takes to sweep across Io, and why it is not modelled.
 *
 * The Sun subtends about 0.1° from Jupiter, so the shadow edge is not sharp: it
 * is smeared over roughly 377 km at Io's distance. Io itself is 3 644 km across
 * — nearly ten times that — so what makes the disappearance gradual is
 * overwhelmingly the size of the moon, not the softness of the edge. The app
 * models the moon's size (`ingressDurationDays` in `eclipses.ts`) and ignores
 * the penumbra, which is the right way round.
 */
export const PENUMBRA_SPREAD_AT_IO_KM = 377;

/** The Galilean moons, in order out from Jupiter. */
export const GALILEAN_IDS = ['io', 'europa', 'ganymede', 'callisto'] as const;

export type GalileanId = (typeof GALILEAN_IDS)[number];

/**
 * The moon Rømer used, and the app's default.
 *
 * Io is the only one whose eclipses recur often enough to build a usable run of
 * observations inside a school lesson: one every 1.77 days against Callisto's
 * 16.7. See CLAUDE.md §14 on whether the others are ever made timeable.
 */
export const DEFAULT_MOON: GalileanId = 'io';
