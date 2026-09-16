// Options page: validates and saves on every change; lists enabled sites and lets the user remove them.
import { DEFAULT_SETTINGS, sanitizeSettings } from '../core/settings.js';
import { disableSite, listRegisteredSites } from '../shared/site-registry.js';

const $ = (id) => document.getElementById(id);
const form = $('settings-form');
const NUMBER_FIELDS = ['tabWidth', 'confirmCharThreshold', 'suggestPreciseChars', 'maxDirectChars'];
const KB = 1024;

function readForm() {
  const data = new FormData(form);
  return {
    speed: data.get('speed'),
    tabWidth: Number(data.get('tabWidth')),
    newlineKey: data.get('newlineKey'),
    keepTrailingNewline: $('keepTrailingNewline').checked,
    confirmCharThreshold: Number(data.get('confirmCharThreshold')),
    suggestPreciseChars: Number(data.get('suggestPreciseChars')),
    maxDirectChars: Number(data.get('maxDirectChars')),
    maxPreciseBytes: Number(data.get('maxPreciseKb')) * KB,
    preciseDir: String(data.get('preciseDir')).trim(),
  };
}

function fillForm(settings) {
  form.elements.speed.value = settings.speed;
  NUMBER_FIELDS.forEach((name) => { $(name).value = settings[name]; });
  $('newlineKey').value = settings.newlineKey;
  $('keepTrailingNewline').checked = settings.keepTrailingNewline;
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
    showStatus('有欄位的值不正確，已標示為紅框，這些欄位沒有儲存。', true);
  }
  const valid = Object.fromEntries(Object.entries(input).filter(([key]) => !invalid.includes(key)));
  await chrome.storage.sync.set(valid);
  if (invalid.length === 0) showStatus('已儲存');
}

async function renderSites() {
  const sites = await listRegisteredSites();
  $('site-empty').hidden = sites.length > 0;
  $('site-list').replaceChildren(...sites.map((pattern) => {
    const remove = Object.assign(document.createElement('button'), { type: 'button', textContent: '移除' });
    remove.addEventListener('click', () => {
      disableSite(pattern)
        .then(renderSites)
        .then(() => showStatus(`已移除 ${pattern}`))
        .catch((error) => showStatus(`移除失敗：${error.message}`, true));
    });
    const item = document.createElement('li');
    item.append(pattern.replace(/\/\*$/, ''), remove);
    return item;
  }));
}

async function start() {
  fillForm(sanitizeSettings(await chrome.storage.sync.get(null)));
  form.addEventListener('change', () => save().catch((error) => showStatus(`儲存失敗：${error.message}`, true)));
  await renderSites();
}

start().catch((error) => showStatus(`載入設定失敗：${error.message}`, true));
