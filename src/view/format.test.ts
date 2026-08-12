import { describe, expect, it } from 'vitest';
import { jdFromCalendar } from '@orrery/core';

import { date, duration, millionKm, number, speed, timeOfDay } from './format.js';

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

describe('units a student has a feel for', () => {
  it('gives Jupiter’s distance in millions of km', () => {
    expect(millionKm('en', 778_000_000)).toBe('778.0');
  });

  it('rounds the speed of light to whole km/s', () => {
    expect(speed('en', 299_792.458)).toBe('299,792');
  });
});
