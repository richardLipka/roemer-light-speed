/**
 * Czech and English, with **Czech as the original**.
 *
 * Not merely the default — the original. The walkthrough is six steps of
 * historical prose aimed at a sixteen-year-old, and prose written in English and
 * then translated reads like translated English, which a Czech student notices
 * immediately and which quietly pushes the reading level up. Every string here
 * is written in Czech first and rendered into English afterwards, which is why
 * the two files hold the same *keys* and not the same sentences.
 *
 * `i18n.test.ts` asserts the key sets match. A missing Czech key falling back to
 * an English sentence is precisely the failure this project cannot ship.
 */

import cs from './cs.json';
import en from './en.json';

export type Locale = 'cs' | 'en';

export const LOCALES: readonly Locale[] = ['cs', 'en'];

/** Czech, and the app opens in it. */
export const DEFAULT_LOCALE: Locale = 'cs';

const DICTIONARIES: Record<Locale, Record<string, string>> = { cs, en };

const STORAGE_KEY = 'roemer.locale';

/**
 * Substitution is `{name}` and nothing more — no plural rules, no gender.
 *
 * Czech pluralisation is genuinely hard (1 pozorování / 2 pozorování / 5
 * pozorování) and the app has one counted noun. Where a count appears the string
 * is phrased to dodge it — "Pozorování: 5" rather than "5 pozorování" — which is
 * how a Czech interface would be written anyway.
 */
export function translate(
  locale: Locale,
  key: string,
  params: Record<string, string | number> = {},
): string {
  const template = DICTIONARIES[locale][key];
  if (template === undefined) {
    // Loud rather than silent: an English sentence appearing in a Czech
    // interface is the one thing the language support must never do.
    console.error(`missing translation: ${locale}/${key}`);
    return key;
  }

  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/** Every key in a dictionary — the parity test's input. */
export const keysOf = (locale: Locale): string[] => Object.keys(DICTIONARIES[locale]).sort();

export function storedLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'cs' || stored === 'en') return stored;
  } catch {
    // Private browsing, a locked-down school machine, or storage simply full.
    // The app must work without it — see CLAUDE.md §13.
  }
  return DEFAULT_LOCALE;
}

export function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // As above: remembering the choice is a convenience, not a requirement.
  }
}
