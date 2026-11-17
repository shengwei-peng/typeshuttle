import en from '../_locales/en/messages.json' with { type: 'json' };
import zhTW from '../_locales/zh_TW/messages.json' with { type: 'json' };

export const LOCALES = Object.freeze({ en, zh_TW: zhTW });
export const UI_LANGUAGES = Object.freeze(['auto', 'en', 'zh_TW']);
const FALLBACK_LOCALE = 'en';
const HTML_LANG = Object.freeze({ en: 'en', zh_TW: 'zh-Hant' });

export function resolveLocale(uiLanguage, browserLanguage) {
  if (Object.hasOwn(LOCALES, uiLanguage)) return uiLanguage;
  return /^zh\b/i.test(browserLanguage ?? '') ? 'zh_TW' : FALLBACK_LOCALE;
}

export function localizedError(messageKey, values, fallback) {
  return Object.assign(new Error(fallback), { messageKey, values });
}

export function errorText(error, t) {
  return error?.messageKey ? t(error.messageKey, error.values) : String(error?.message ?? error);
}

export function htmlLangFor(locale) {
  return HTML_LANG[locale] ?? HTML_LANG[FALLBACK_LOCALE];
}

function lookup(table, key, values) {
  if (String(values.count) === '1' && table[`${key}_one`]) return table[`${key}_one`].message;
  return table[key]?.message;
}

export function createTranslator(locale) {
  const table = LOCALES[locale] ?? LOCALES[FALLBACK_LOCALE];
  return (key, values = {}) => {
    const message = lookup(table, key, values) ?? lookup(LOCALES[FALLBACK_LOCALE], key, values);
    if (message === undefined) throw new Error(`Missing message: ${key}`);
    return message.replace(/\{(\w+)\}/g, (placeholder, name) => (Object.hasOwn(values, name) ? String(values[name]) : placeholder));
  };
}
