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
