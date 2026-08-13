/**
 * Numbers, dates and units, formatted for the reader's language.
 *
 * **This is where formatting happens, and nowhere else.** `physics/` deals in
 * raw numbers with no strings in it at all, and this module turns them into
 * something a person reads. The orrery got this the wrong way round once — its
 * calculation panel formatted inside the maths and hard-coded a decimal point —
 * and had to be redone, because Czech writes 299 792,458 where English writes
 * 299,792.458 and this app is nothing but numbers.
 *
 * Everything goes through `Intl`, so the separators, the month names and the
 * date order all follow the locale rather than a table maintained here.
 */

import { calendarFromJd } from '@orrery/core';

import type { Locale } from '../i18n/i18n.js';

const INTL_LOCALE: Record<Locale, string> = { cs: 'cs-CZ', en: 'en-GB' };

export function number(locale: Locale, value: number, decimals = 0): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** A date without a time — the log's first column. */
export function date(locale: Locale, jd: number): string {
  const calendar = calendarFromJd(jd);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(Date.UTC(calendar.year, calendar.month - 1, calendar.day));
}

/**
 * A clock time to the second.
 *
 * Seconds matter here in a way they rarely do in an interface: the whole
 * measurement is a difference of minutes, so a time rounded to the minute would
 * throw away a fifth of the signal.
 */
export function timeOfDay(locale: Locale, jd: number): string {
  const calendar = calendarFromJd(jd);
  const pad = (value: number) => String(Math.floor(value)).padStart(2, '0');
  void locale; // 24-hour in both languages; British English does not use AM/PM here
  return `${pad(calendar.hour)}:${pad(calendar.minute)}:${pad(calendar.second)}`;
}

export function dateAndTime(locale: Locale, jd: number): string {
  return `${date(locale, jd)} ${timeOfDay(locale, jd)}`;
}

/**
 * A duration in seconds, written the way the size of it deserves.
 *
 * Under two minutes reads as seconds, because "97 s" is a quantity a student can
 * hold; beyond that it reads as minutes, because "998 s" is not.
 */
export function duration(locale: Locale, seconds: number): string {
  if (Math.abs(seconds) < 120) return `${number(locale, seconds, 0)} s`;
  return `${number(locale, seconds / 60, 1)} min`;
}

/** Distances in millions of km, which is the unit a student has a feel for. */
export function millionKm(locale: Locale, km: number): string {
  return number(locale, km / 1e6, 1);
}

export function speed(locale: Locale, kmPerSecond: number): string {
  return number(locale, kmPerSecond, 0);
}

export function percent(locale: Locale, value: number): string {
  return number(locale, value, 1);
}

/**
 * How fast the clock is running, in whatever unit reads smallest.
 *
 * "0,001 d/s" told a student nothing, and at real time the ladder's own unit
 * gives "0,000 d/s" — a readout that says the clock has stopped when it is
 * running perfectly. So the number is written in the largest unit that keeps it
 * under about ninety: seconds, then minutes, then hours, then days.
 *
 * The seconds form is doing double duty and is the reason for choosing it. Sky
 * seconds per real second *is* the multiple of real time, so "1 s/s" reads as
 * real time and "10 s/s" as ten times real time without a word of explanation.
 */
export function rate(locale: Locale, daysPerSecond: number): string {
  const seconds = daysPerSecond * 86_400;
  if (seconds < 90) return `${number(locale, seconds, seconds < 10 ? 1 : 0)} s/s`;

  const minutes = seconds / 60;
  if (minutes < 90) return `${number(locale, minutes, minutes < 10 ? 1 : 0)} min/s`;

  // A day exactly is a day, not 24 hours. The band stops at 24 rather than
  // running on, so the app's default rate reads as "1.0 d/s" — the unit anyone
  // would use for it — instead of as an hour count nobody would.
  const hours = minutes / 60;
  if (hours < 24) return `${number(locale, hours, hours < 10 ? 1 : 0)} h/s`;

  const days = hours / 24;
  return `${number(locale, days, days < 10 ? 1 : 0)} d/s`;
}
