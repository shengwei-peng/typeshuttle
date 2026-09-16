// Site enablement (docs/ARCHITECTURE.md#permissions): register the content script only for hosts the user granted.
import { SCRIPT_ID_PREFIX, isSitePattern, scriptIdForPattern } from '../core/sites.js';

const CONTENT_SCRIPT_FILE = 'content.js';

export async function listRegisteredSites() {
  const scripts = await chrome.scripting.getRegisteredContentScripts();
  return scripts.filter((script) => script.id.startsWith(SCRIPT_ID_PREFIX)).flatMap((script) => script.matches ?? []);
}

export async function registerSite(pattern) {
  if (!isSitePattern(pattern)) throw new Error(`Refusing to register non-site pattern: ${pattern}`);
  const id = scriptIdForPattern(pattern);
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
  if (existing.length > 0) return;
  await chrome.scripting.registerContentScripts([{
    id,
    matches: [pattern],
    js: [CONTENT_SCRIPT_FILE],
    runAt: 'document_start',
    allFrames: false,
    persistAcrossSessions: true,
  }]);
}

export async function unregisterSite(pattern) {
  const id = scriptIdForPattern(pattern);
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
  if (existing.length > 0) await chrome.scripting.unregisterContentScripts({ ids: [id] });
}

export async function injectIntoTab(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: [CONTENT_SCRIPT_FILE] });
}

export async function disableSite(pattern) {
  await unregisterSite(pattern);
  await chrome.permissions.remove({ origins: [pattern] });
}

// Bring registrations back in line with granted hosts after the user revokes access in chrome://extensions or the extension updates.
export async function reconcileSites() {
  const granted = ((await chrome.permissions.getAll()).origins ?? []).filter(isSitePattern);
  const registered = await listRegisteredSites();
  await Promise.all([
    ...granted.filter((pattern) => !registered.includes(pattern)).map(registerSite),
    ...registered.filter((pattern) => !granted.includes(pattern)).map(unregisterSite),
  ]);
}
