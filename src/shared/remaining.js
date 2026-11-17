export const remainingKey = (tabId) => `remaining:${tabId}`;

export function readRemaining(value) {
  if (typeof value === 'string') return { text: value, pendingImeCommit: false };
  if (value && typeof value.text === 'string') return { text: value.text, pendingImeCommit: value.pendingImeCommit === true };
  return null;
}
