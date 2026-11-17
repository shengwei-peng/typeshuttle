import { sanitizeSettings } from '../core/settings.js';
import { originPatternFromUrl } from '../core/sites.js';
import { isMacPlatform } from '../core/hotkey.js';
import { registerSite, injectIntoTab } from '../shared/site-registry.js';
import { createSendForm } from './send-form.js';
import { createTranslator, errorText, resolveLocale } from '../core/i18n.js';
import { localizeDocument } from '../ui/localize.js';

const $ = (id) => document.getElementById(id);
const STATUS_RETRY_DELAY_MS = 150;
let t = createTranslator(resolveLocale('auto', navigator.language));

function applyLanguage(settings) {
  const locale = resolveLocale(settings.uiLanguage, navigator.language);
  t = createTranslator(locale);
  localizeDocument(document, t, locale);
}

function showState({ title, body, action }) {
  $('ready').hidden = true;
  $('state').hidden = false;
  $('state-title').textContent = title;
  $('state-body').textContent = body;
  const button = $('state-action');
  button.hidden = !action;
  button.onclick = action ? action.onClick : null;
  button.textContent = action ? action.label : '';
}

async function resolveTab() {
  const override = Number(new URLSearchParams(location.search).get('tabId'));
  if (Number.isInteger(override) && override > 0) return chrome.tabs.get(override);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function queryStatus(tabId) {
  const ask = () => chrome.tabs.sendMessage(tabId, { type: 'typeshuttle/status' });
  try {
    const status = await ask();
    if (status) return status;
  } catch {
  }
  try {
    await injectIntoTab(tabId);
    await new Promise((resolve) => setTimeout(resolve, STATUS_RETRY_DELAY_MS));
    return (await ask()) ?? { error: t('pageNoResponse') };
  } catch (error) {
    return { error: errorText(error, t) };
  }
}

function renderHotkeyHint() {
  if (!isMacPlatform(navigator.userAgentData?.platform ?? navigator.platform)) return;
  const keys = ['Cmd', 'Shift', 'V'].map((label) => Object.assign(document.createElement('kbd'), { textContent: label }));
  $('hotkey-hint').replaceChildren(keys[0], ' ', keys[1], ' ', keys[2]);
}

function enableSite(tab, pattern) {
  chrome.permissions.request({ origins: [pattern] })
    .then(async (granted) => {
      if (!granted) {
        showState({
          title: t('notEnabledTitle'),
          body: t('notEnabledBody'),
          action: { label: t('enableOnSite'), onClick: () => enableSite(tab, pattern) },
        });
        return;
      }
      await registerSite(pattern);
      await injectIntoTab(tab.id);
      await start();
    })
    .catch((error) => showState({ title: t('enableFailedTitle'), body: errorText(error, t), action: { label: t('checkAgain'), onClick: start } }));
}

async function start() {
  const settings = sanitizeSettings(await chrome.storage.sync.get(null));
  applyLanguage(settings);
  const tab = await resolveTab();
  const pattern = originPatternFromUrl(tab?.url);
  if (!pattern) {
    showState({ title: t('unsupportedTabTitle'), body: t('unsupportedTabBody') });
    return;
  }
  const host = new URL(tab.url).hostname;
  $('site').textContent = host;

  if (!(await chrome.permissions.contains({ origins: [pattern] }))) {
    showState({
      title: t('enablePromptTitle'),
      body: t('enablePromptBody', { host }),
      action: { label: t('enableOnSite'), onClick: () => enableSite(tab, pattern) },
    });
    return;
  }

  const status = await queryStatus(tab.id);
  const retry = { label: t('checkAgain'), onClick: start };
  if (status.error) {
    showState({ title: t('tabUnreachableTitle'), body: t('tabUnreachableBody', { error: status.error }), action: retry });
  } else if (!status.ready) {
    showState({ title: t('remoteMissingTitle'), body: t('remoteMissingBody'), action: retry });
  } else if (status.busy) {
    showState({ title: t('busyTitle'), body: t('busyStateBody'), action: retry });
  } else {
    $('state').hidden = true;
    $('ready').hidden = false;
    renderHotkeyHint();
    await createSendForm({ tab, settings, t, onSent: () => window.close() });
  }
}

$('open-options').addEventListener('click', () => chrome.runtime.openOptionsPage());
start().catch((error) => showState({ title: t('errorTitle'), body: errorText(error, t), action: { label: t('checkAgain'), onClick: start } }));
