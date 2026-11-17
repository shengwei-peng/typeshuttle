import { DEFAULT_SETTINGS, sanitizeSettings } from '../core/settings.js';
import { disableSite, listRegisteredSites } from '../shared/site-registry.js';
import { createTranslator, errorText, resolveLocale } from '../core/i18n.js';
import { localizeDocument } from '../ui/localize.js';

const $ = (id) => document.getElementById(id);
const form = $('settings-form');
const NUMBER_FIELDS = ['tabWidth', 'confirmCharThreshold', 'suggestPreciseChars', 'maxDirectChars'];
const KB = 1024;
let t = createTranslator(resolveLocale('auto', navigator.language));

function applyLanguage(uiLanguage) {
  const locale = resolveLocale(uiLanguage, navigator.language);
  t = createTranslator(locale);
  localizeDocument(document, t, locale);
}

function readForm() {
  const data = new FormData(form);
  return {
    uiLanguage: data.get('uiLanguage'),
    speed: data.get('speed'),
    tabWidth: Number(data.get('tabWidth')),
    newlineKey: data.get('newlineKey'),
    keepTrailingNewline: $('keepTrailingNewline').checked,
    imeCommitEnter: $('imeCommitEnter').checked,
    confirmCharThreshold: Number(data.get('confirmCharThreshold')),
    suggestPreciseChars: Number(data.get('suggestPreciseChars')),
    maxDirectChars: Number(data.get('maxDirectChars')),
    maxPreciseBytes: Number(data.get('maxPreciseKb')) * KB,
    preciseDir: String(data.get('preciseDir')).trim(),
  };
}

function fillForm(settings) {
  $('uiLanguage').value = settings.uiLanguage;
  form.elements.speed.value = settings.speed;
  NUMBER_FIELDS.forEach((name) => { $(name).value = settings[name]; });
  $('newlineKey').value = settings.newlineKey;
  $('keepTrailingNewline').checked = settings.keepTrailingNewline;
  $('imeCommitEnter').checked = settings.imeCommitEnter;
  $('maxPreciseKb').value = Math.round(settings.maxPreciseBytes / KB);
  $('preciseDir').value = settings.preciseDir;
}

function showStatus(text, isError = false) {
  const status = $('save-status');
  status.textContent = text;
  status.classList.toggle('error', isError);
}

const FIELD_FOR_SETTING = { maxPreciseBytes: 'maxPreciseKb' };

async function save() {
  const input = readForm();
  const sanitized = sanitizeSettings(input);
  const invalid = Object.keys(DEFAULT_SETTINGS).filter((key) => sanitized[key] !== input[key]);
  Object.keys(DEFAULT_SETTINGS).forEach((key) => {
    $(FIELD_FOR_SETTING[key] ?? key)?.setAttribute('aria-invalid', String(invalid.includes(key)));
  });
  if (invalid.length > 0) {
    showStatus(t('statusInvalid'), true);
  }
  const valid = Object.fromEntries(Object.entries(input).filter(([key]) => !invalid.includes(key)));
  await chrome.storage.sync.set(valid);
  if (!invalid.includes('uiLanguage')) {
    applyLanguage(sanitized.uiLanguage);
    await renderSites();
  }
  if (invalid.length === 0) showStatus(t('statusSaved'));
}

async function renderSites() {
  const sites = await listRegisteredSites();
  $('site-empty').hidden = sites.length > 0;
  $('site-list').replaceChildren(...sites.map((pattern) => {
    const remove = Object.assign(document.createElement('button'), { type: 'button', textContent: t('siteRemove') });
    remove.addEventListener('click', () => {
      disableSite(pattern)
        .then(renderSites)
        .then(() => showStatus(t('statusRemoved', { pattern })))
        .catch((error) => showStatus(t('statusRemoveFailed', { error: errorText(error, t) }), true));
    });
    const item = document.createElement('li');
    item.append(pattern.replace(/\/\*$/, ''), remove);
    return item;
  }));
}

async function start() {
  const settings = sanitizeSettings(await chrome.storage.sync.get(null));
  applyLanguage(settings.uiLanguage);
  fillForm(settings);
  form.addEventListener('change', () => save().catch((error) => showStatus(t('statusSaveFailed', { error: errorText(error, t) }), true)));
  await renderSites();
}

start().catch((error) => showStatus(t('statusLoadFailed', { error: errorText(error, t) }), true));
