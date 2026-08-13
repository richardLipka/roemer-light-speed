import { describe, expect, it } from 'vitest';
import { jdFromCalendar } from '@orrery/core';

import { date, duration, millionKm, number, rate, speed, timeOfDay } from './format.js';

describe('numbers in two languages', () => {
  it('uses a comma in Czech and a point in English, from the same value', () => {
    // The trap that bit the orrery. 299 792,458 against 299,792.458 — same
    // number, and a Czech student reading the English form gets it wrong by a
    // factor of a thousand.
    const value = 299_792.458;
    expect(number('cs', value, 3)).toContain(',');
    expect(number('en', value, 3)).toContain('.');
    expect(number('cs', value, 3).replace(/\s| /g, '')).toBe('299792,458');
    expect(number('en', value, 3)).toBe('299,792.458');
  });

  it('groups thousands in both, differently', () => {
    expect(number('cs', 1_000_000)).not.toBe(number('en', 1_000_000));
  });

  it('honours the requested number of decimals', () => {
    expect(number('en', 1.23456, 2)).toBe('1.23');
    expect(number('en', 1, 2)).toBe('1.00');
  });
});

describe('dates', () => {
  const jd = jdFromCalendar(1676, 11, 9, 21, 30, 0);

  it('writes the Czech and English forms differently', () => {
    expect(date('cs', jd)).not.toBe(date('en', jd));
  });

  it('names the month in Czech rather than swapping an English one in', () => {
    expect(date('cs', jd)).toContain('listopad');
  });

  it('keeps the same instant in both', () => {
    expect(date('en', jd)).toContain('1676');
    expect(date('cs', jd)).toContain('1676');
  });

  it('carries seconds, because the measurement is made of them', () => {
    expect(timeOfDay('en', jd)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});

describe('durations', () => {
  it('reads short spans in seconds and long ones in minutes', () => {
    expect(duration('en', 97)).toContain('s');
    expect(duration('en', 998)).toContain('min');
    expect(duration('en', 998)).toContain('16.6');
  });
});

describe('how fast the clock is running', () => {
  it('says "1.0 s/s" at real time rather than "0.000 d/s"', () => {
    // The whole reason this formatter exists. In days per second, real time
    // rounds to zero and the readout claims a running clock has stopped.
    expect(rate('en', 1 / 86_400)).toBe('1.0 s/s');
  });

  it('reads the close-up as ten times real time, with no arithmetic asked of anyone', () => {
    // Sky seconds per real second *is* the multiple of real time, which is why
    // the seconds form is the one used at the slow end.
    expect(rate('en', 10 / 86_400)).toBe('10 s/s');
  });

  it('climbs through minutes, hours and days as the number would run out of room', () => {
    // A minute a second stays in seconds — "60 s/s" is both readable and still
    // the multiple of real time, which is worth more than the tidier unit.
    expect(rate('en', 1 / 1440)).toBe('60 s/s');
    expect(rate('en', 5 / 1440)).toContain('min/s');
    // Likewise an hour a second reads as 60 min/s rather than 1 h/s.
    expect(rate('en', 1 / 24)).toBe('60 min/s');
    expect(rate('en', 4 / 24)).toContain('h/s');
    expect(rate('en', 100)).toContain('d/s');
  });

  it('writes the fraction with a comma in Czech', () => {
    expect(rate('cs', 1.5 / 86_400)).toContain(',');
  });
});

describe('units a student has a feel for', () => {
  it('gives Jupiter’s distance in millions of km', () => {
    expect(millionKm('en', 778_000_000)).toBe('778.0');
  });

  it('rounds the speed of light to whole km/s', () => {
    expect(speed('en', 299_792.458)).toBe('299,792');
  });
});
