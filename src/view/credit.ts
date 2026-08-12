/**
 * The imprint line: who made this, where to write, and the two institutional
 * marks.
 *
 * The marks are **inlined SVG rather than `<img>`**, and every fill in them is
 * `currentColor`. The artwork the university ships is flat white, meant for the
 * dark header it sits in there; on parchment a white mark is invisible. Inlined,
 * it takes the footer's own ink instead. That also keeps the app free of any
 * runtime network request, which §13 requires — it must work offline once
 * loaded, and a logo hotlinked from kiv.zcu.cz would not.
 *
 * An imprint, not a sponsor's banner: small, quiet, and at the bottom.
 */

import favMark from '../assets/fav.svg?raw';
import kivMark from '../assets/kiv.svg?raw';

import { translate } from '../i18n/i18n.js';
import type { Store } from '../state/store.js';
import { el } from './dom.js';

const EMAIL = 'lipka@fav.zcu.cz';
const HOMEPAGE = 'https://home.zcu.cz/~lipka/';

export interface CreditView {
  root: HTMLElement;
  render(): void;
}

export function createCredit(store: Store): CreditView {
  const line = el('p', 'credit__line');
  const marks = el('div', 'credit__marks');

  const root = el('footer', 'credit');
  root.append(line, marks);

  for (const [markup, href, label, extra] of [
    [favMark, 'https://www.fav.zcu.cz/', 'Fakulta aplikovaných věd ZČU', ''],
    [
      kivMark,
      'https://www.kiv.zcu.cz/',
      'Katedra informatiky a výpočetní techniky',
      ' credit__mark--wordmark',
    ],
  ] as const) {
    const link = el('a', `credit__mark${extra}`);
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = label;
    link.setAttribute('aria-label', label);
    link.innerHTML = markup;
    marks.append(link);
  }

  return {
    root,
    render() {
      const { locale } = store.current;

      const mail = el('a', undefined, EMAIL);
      mail.href = `mailto:${EMAIL}`;

      const home = el('a', undefined, 'home.zcu.cz/~lipka');
      home.href = HOMEPAGE;
      home.target = '_blank';
      home.rel = 'noopener noreferrer';

      line.replaceChildren(
        `${translate(locale, 'footer.copyright', { year: new Date().getFullYear() })} · `,
        mail,
        ' · ',
        home,
      );
    },
  };
}
