import { htmlLangFor } from '../core/i18n.js';

export function localizeDocument(doc, t, locale) {
  doc.documentElement.lang = htmlLangFor(locale);
  doc.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  doc.querySelectorAll('[data-i18n-attr]').forEach((element) => {
    element.dataset.i18nAttr.split(';').forEach((pair) => {
      const [attribute, key] = pair.split(':');
      element.setAttribute(attribute, t(key));
    });
  });
}
