// Content script entry: injected only on enabled sites, and intercepts the hotkey only when the page has a supported input target.
import { DEFAULT_SETTINGS, sanitizeSettings } from '../core/settings.js';
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
  // After the extension updates or reloads, the old content script stays on the page but runtime.id becomes undefined.
  const runtime = chrome.runtime;
  const isAlive = () => Boolean(runtime?.id);
  let disposers = [];
  const dispose = () => {
    const pending = disposers;
    disposers = [];
    pending.forEach((fn) => fn());
  };

  // Register first so it still sees keys that later capture listeners stop.
  const keys = createKeyTracker(win);
  disposers = [...disposers, keys.dispose];
  let settings = DEFAULT_SETTINGS;

  const loadSettings = () => chrome.storage.sync.get(null)
    .then((stored) => { settings = sanitizeSettings(stored); })
    .catch(() => { settings = DEFAULT_SETTINGS; });
  const onStorageChanged = (_changes, area) => {
    if (area === 'sync') loadSettings();
  };
  loadSettings();
  chrome.storage.onChanged.addListener(onStorageChanged);
  disposers = [...disposers, () => {
    try { chrome.storage?.onChanged?.removeListener(onStorageChanged); } catch {}
  }];

  const adapter = createCitrixAdapter(doc);
  const overlay = createOverlay({ doc, win });
  const controller = createController({
    win,
    doc,
    adapter,
    overlay,
    keys,
    getSettings: () => settings,
    storeRemaining: (text) => runtime.sendMessage({ type: 'typeshuttle/store-remaining', text }),
  });

  const disposeHotkey = installPasteHotkey({
    win,
    isMac: isMacPlatform(navigator.userAgentData?.platform ?? navigator.platform),
    isActive: () => {
      if (isAlive()) return adapter.isAvailable();
      // Orphaned instance: hand the hotkey over to the newly injected one.
      dispose();
      return false;
    },
    onText: (text) => controller.fromHotkey(text),
    onMissedPaste: () => overlay.toast({
      tone: 'warn',
      title: '沒有收到剪貼簿內容',
      body: '請先點一下遠端桌面畫面，再按一次快捷鍵。',
    }),
  });
  disposers = [...disposers, disposeHotkey];

  const onMessage = (message, sender, sendResponse) => {
    if (sender.id !== runtime.id) return false;
    const response = controller.handleMessage(message);
    if (response !== null) sendResponse(response);
    return false;
  };
  runtime.onMessage.addListener(onMessage);
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
