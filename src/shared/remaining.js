// chrome.storage.session key for text left over after an abort, shared by the service worker and the panel.
export const remainingKey = (tabId) => `remaining:${tabId}`;
