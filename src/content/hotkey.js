// Ctrl+Shift+V (Cmd+Shift+V on macOS) interception (docs/ARCHITECTURE.md#triggers):
// the keydown is kept from the client but its default action is preserved, so the browser fires a paste event carrying the clipboard text.
import { isPasteHotkey } from '../core/hotkey.js';

const PASTE_ACCEPT_MS = 1500;

export function installPasteHotkey({ win, isMac, isActive, onText, onMissedPaste }) {
  let armedUntil = 0;
  let missTimer = null;
  let swallowKeyUpCode = null;

  const disarm = () => {
    clearTimeout(missTimer);
    missTimer = null;
    armedUntil = 0;
  };

  const onKeyDown = (event) => {
    if (!event.isTrusted || !isPasteHotkey(event, { isMac }) || !isActive()) return;
    event.stopImmediatePropagation();
    swallowKeyUpCode = event.code;
    if (event.repeat || missTimer) return;
    armedUntil = performance.now() + PASTE_ACCEPT_MS;
    missTimer = setTimeout(() => {
      disarm();
      onMissedPaste();
    }, PASTE_ACCEPT_MS);
  };

  const onKeyUp = (event) => {
    if (event.code !== swallowKeyUpCode) return;
    swallowKeyUpCode = null;
    event.stopImmediatePropagation();
  };

  const onPaste = (event) => {
    // Accept only paste events the browser fires for the physical shortcut; synthetic paste events from page scripts are ignored.
    if (!event.isTrusted || performance.now() > armedUntil) return;
    disarm();
    event.preventDefault();
    event.stopImmediatePropagation();
    onText(event.clipboardData?.getData('text/plain') ?? '');
  };

  win.addEventListener('keydown', onKeyDown, true);
  win.addEventListener('keyup', onKeyUp, true);
  win.addEventListener('paste', onPaste, true);

  return () => {
    disarm();
    win.removeEventListener('keydown', onKeyDown, true);
    win.removeEventListener('keyup', onKeyUp, true);
    win.removeEventListener('paste', onPaste, true);
  };
}
