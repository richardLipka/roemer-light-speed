import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE, keysOf, LOCALES, translate } from './i18n.js';

describe('the two dictionaries', () => {
  it('hold identical key sets', () => {
    // CLAUDE.md §12. A Czech key that silently falls back to an English
    // sentence is the failure this project cannot ship, and it is one assertion.
    expect(keysOf('cs')).toEqual(keysOf('en'));
  });

  it('leave no string empty in either language', () => {
    for (const locale of LOCALES) {
      for (const key of keysOf(locale)) {
        expect(translate(locale, key).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('use the same placeholders in both languages', () => {
    // Czech and English word order differ freely, but a {minutes} that exists in
    // one and not the other means one language prints a raw brace at a student.
    const placeholders = (locale: 'cs' | 'en', key: string) =>
      (translate(locale, key).match(/\{(\w+)\}/g) ?? []).sort();

    for (const key of keysOf('cs')) {
      expect(placeholders('cs', key)).toEqual(placeholders('en', key));
    }
  });

  it('opens in Czech', () => {
    expect(DEFAULT_LOCALE).toBe('cs');
  });
});

describe('substitution', () => {
  it('fills named placeholders', () => {
    expect(translate('en', 'log.count', { count: 12 })).toContain('12');
    expect(translate('cs', 'log.count', { count: 12 })).toContain('12');
  });

  it('leaves an unknown placeholder alone rather than printing "undefined"', () => {
    expect(translate('en', 'log.count', {})).toContain('{count}');
  });
});

describe('the honesty note', () => {
  it('exists in both languages, because §6 requires it on screen', () => {
    for (const locale of LOCALES) {
      const note = translate(locale, 'notes.datesWarning');
      expect(note).not.toBe('notes.datesWarning');
      expect(note.length).toBeGreaterThan(60);
    }
  });
});
