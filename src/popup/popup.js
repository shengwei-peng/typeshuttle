// Toolbar panel: works out the tab state (unsupported / not enabled / not connected / ready) and hands off to the send form.
import { sanitizeSettings } from '../core/settings.js';
import { originPatternFromUrl } from '../core/sites.js';
import { isMacPlatform } from '../core/hotkey.js';
import { registerSite, injectIntoTab } from '../shared/site-registry.js';
import { createSendForm } from './send-form.js';

const $ = (id) => document.getElementById(id);
const STATUS_RETRY_DELAY_MS = 150;

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

// Automated tests open popup.html?tabId=; otherwise use the active tab of the current window.
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
    // No content script on the page yet (for example right after an update); inject below and ask again.
  }
  try {
    await injectIntoTab(tabId);
    await new Promise((resolve) => setTimeout(resolve, STATUS_RETRY_DELAY_MS));
    return (await ask()) ?? { error: '頁面沒有回應' };
  } catch (error) {
    return { error: error.message };
  }
}

function renderHotkeyHint() {
  if (!isMacPlatform(navigator.userAgentData?.platform ?? navigator.platform)) return;
  const keys = ['Cmd', 'Shift', 'V'].map((label) => Object.assign(document.createElement('kbd'), { textContent: label }));
  $('hotkey-hint').replaceChildren(keys[0], ' ', keys[1], ' ', keys[2]);
}

function enableSite(tab, pattern) {
  // permissions.request must be called within the click handler, before awaiting anything else.
  chrome.permissions.request({ origins: [pattern] })
    .then(async (granted) => {
      if (!granted) {
        showState({
          title: '尚未啟用',
          body: '沒有取得這個網站的權限。需要時再按一次「在此網站啟用」。',
          action: { label: '在此網站啟用', onClick: () => enableSite(tab, pattern) },
        });
        return;
      }
      await registerSite(pattern);
      await injectIntoTab(tab.id);
      await start();
    })
    .catch((error) => showState({ title: '啟用失敗', body: error.message, action: { label: '重新檢查', onClick: start } }));
}

async function start() {
  const settings = sanitizeSettings(await chrome.storage.sync.get(null));
  const tab = await resolveTab();
  const pattern = originPatternFromUrl(tab?.url);
  if (!pattern) {
    showState({ title: '這個分頁不能使用', body: '請切到瀏覽器版遠端桌面（例如 Citrix）的分頁，再開啟 TypeShuttle。' });
    return;
  }
  const host = new URL(tab.url).hostname;
  $('site').textContent = host;

  if (!(await chrome.permissions.contains({ origins: [pattern] }))) {
    showState({
      title: '在這個網站啟用 TypeShuttle？',
      body: `TypeShuttle 只會取得 ${host} 的存取權限，用來把文字送進遠端桌面。啟用後不需要重新整理頁面。`,
      action: { label: '在此網站啟用', onClick: () => enableSite(tab, pattern) },
    });
    return;
  }

  const status = await queryStatus(tab.id);
  const retry = { label: '重新檢查', onClick: start };
  if (status.error) {
    showState({ title: '無法連到這個分頁', body: `${status.error}。請重新整理遠端桌面頁面後再試。`, action: retry });
  } else if (!status.ready) {
    showState({ title: '找不到遠端桌面', body: '請先連上 Citrix 遠端桌面，等畫面出現後再開啟這個面板。', action: retry });
  } else if (status.busy) {
    showState({ title: '正在送出中', body: '請等目前的內容送完，或在遠端桌面分頁按任意鍵中止。', action: retry });
  } else {
    $('state').hidden = true;
    $('ready').hidden = false;
    renderHotkeyHint();
    await createSendForm({ tab, settings, onSent: () => window.close() });
  }
}

$('open-options').addEventListener('click', () => chrome.runtime.openOptionsPage());
start().catch((error) => showState({ title: '發生錯誤', body: error.message, action: { label: '重新檢查', onClick: start } }));
