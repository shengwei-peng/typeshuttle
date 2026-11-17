import { DEFAULT_SETTINGS, sanitizeSettings } from '../core/settings.js';
import { createTranslator, resolveLocale } from '../core/i18n.js';
import { isMacPlatform } from '../core/hotkey.js';
import { createKeyTracker } from './keys.js';
import { createCitrixAdapter } from './citrix-adapter.js';
import { createOverlay } from './overlay.js';
import { installPasteHotkey } from './hotkey.js';
import { createController } from './controller.js';

const INSTANCE_KEY = '__typeshuttleInstance';

function bootstrap() {
  const win = window;
  const doc = document;
  const runtime = chrome.runtime;
  const isAlive = () => Boolean(runtime?.id);
  let disposers = [];
  const dispose = () => {
    const pending = disposers;
    disposers = [];
    pending.forEach((fn) => fn());
  };

  const keys = createKeyTracker(win);
  disposers = [...disposers, keys.dispose];
  let settings = DEFAULT_SETTINGS;
  const translatorFor = (current) => createTranslator(resolveLocale(current.uiLanguage, navigator.language));
  let t = translatorFor(settings);
  const getT = () => t;
  const applySettings = (next) => {
    settings = next;
    t = translatorFor(next);
  };

  const loadSettings = () => chrome.storage.sync.get(null)
    .then((stored) => applySettings(sanitizeSettings(stored)))
    .catch(() => applySettings(DEFAULT_SETTINGS));
  const onStorageChanged = (_changes, area) => {
    if (area === 'sync') loadSettings();
  };
  loadSettings();
  chrome.storage.onChanged.addListener(onStorageChanged);
  disposers = [...disposers, () => {
    try { chrome.storage?.onChanged?.removeListener(onStorageChanged); } catch {}
  }];

  const adapter = createCitrixAdapter(doc, { getT });
  const overlay = createOverlay({ doc, win, getT });
  const controller = createController({
    win,
    doc,
    adapter,
    overlay,
    keys,
    getSettings: () => settings,
    getT,
    storeRemaining: async (text, pendingImeCommit = false) => (await runtime.sendMessage({ type: 'typeshuttle/store-remaining', text, pendingImeCommit }))?.ok === true,
  });

  const disposeHotkey = installPasteHotkey({
    win,
    isMac: isMacPlatform(navigator.userAgentData?.platform ?? navigator.platform),
    isActive: () => {
      if (isAlive()) return adapter.isAvailable();
      dispose();
      return false;
    },
    onText: (text) => controller.fromHotkey(text),
    onMissedPaste: () => overlay.toast({ tone: 'warn', title: t('missedPasteTitle'), body: t('missedPasteBody') }),
  });
  disposers = [...disposers, disposeHotkey];

  const onMessage = (message, sender, sendResponse) => {
    if (sender.id !== runtime.id) return false;
    const response = controller.handleMessage(message);
    if (response !== null) sendResponse(response);
    return false;
  };
  runtime.onMessage.addListener(onMessage);

  if (__TYPESHUTTLE_TEST__) {
    const onTestMessage = (event) => {
      if (event.source !== win || event.data?.source !== 'typeshuttle-test') return;
      const { id, action, values, message } = event.data;
      const reply = (result) => win.postMessage({ source: 'typeshuttle-test-reply', id, result }, '*');
      if (action === 'settings') {
        chrome.storage.sync.set(values).then(loadSettings).then(() => reply({ ok: true }), (error) => reply({ ok: false, error: error.message }));
      } else if (action === 'send') {
        reply(controller.handleMessage(message));
      }
    };
    win.addEventListener('message', onTestMessage);
    disposers = [...disposers, () => win.removeEventListener('message', onTestMessage)];
  }
  disposers = [...disposers, () => {
    try { runtime?.onMessage?.removeListener(onMessage); } catch {}
  }];

  return { isAlive, dispose };
}

const previous = globalThis[INSTANCE_KEY];
if (!previous?.isAlive()) {
  previous?.dispose();
  globalThis[INSTANCE_KEY] = bootstrap();
}
