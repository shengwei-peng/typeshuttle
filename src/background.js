import { reconcileSites, registerSite, unregisterSite } from './shared/site-registry.js';
import { isSitePattern } from './core/sites.js';
import { remainingKey } from './shared/remaining.js';

const MAX_REMAINING_LENGTH = 5_000_000;

chrome.runtime.onInstalled.addListener(() => reconcileSites());
chrome.runtime.onStartup.addListener(() => reconcileSites());

chrome.permissions.onAdded.addListener(({ origins = [] }) => {
  origins.filter(isSitePattern).forEach((pattern) => registerSite(pattern));
});

chrome.permissions.onRemoved.addListener(({ origins = [] }) => {
  origins.filter(isSitePattern).forEach((pattern) => unregisterSite(pattern));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(remainingKey(tabId));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'typeshuttle/store-remaining') return false;
  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId) || typeof message.text !== 'string' || message.text.length > MAX_REMAINING_LENGTH) {
    sendResponse({ ok: false });
    return false;
  }
  const value = { text: message.text, pendingImeCommit: message.pendingImeCommit === true };
  chrome.storage.session.set({ [remainingKey(tabId)]: value })
    .then(() => sendResponse({ ok: true }), (error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
