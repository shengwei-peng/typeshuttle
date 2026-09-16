// Aborts a send when the user interacts (docs/ARCHITECTURE.md#safety). Keys the extension dispatches are untrusted and never trigger it.
import { swallowNextKeyUp } from './keys.js';

export const INTERRUPT_REASONS = Object.freeze({
  keyboard: '偵測到按鍵',
  mouse: '偵測到滑鼠點擊',
  hidden: '分頁被切換',
  blur: '視窗失去焦點',
});

export function watchInterruptions({ win, doc, onInterrupt }) {
  const onKeyDown = (event) => {
    if (!event.isTrusted) return;
    // The key used to abort (and its release) is not forwarded to the remote session.
    event.preventDefault();
    event.stopImmediatePropagation();
    swallowNextKeyUp(win, event.code);
    onInterrupt('keyboard');
  };
  const onMouseDown = (event) => {
    if (event.isTrusted) onInterrupt('mouse');
  };
  const onVisibilityChange = () => {
    if (doc.visibilityState === 'hidden') onInterrupt('hidden');
  };
  const onBlur = () => onInterrupt('blur');

  win.addEventListener('keydown', onKeyDown, true);
  win.addEventListener('mousedown', onMouseDown, true);
  doc.addEventListener('visibilitychange', onVisibilityChange);
  win.addEventListener('blur', onBlur);

  return () => {
    win.removeEventListener('keydown', onKeyDown, true);
    win.removeEventListener('mousedown', onMouseDown, true);
    doc.removeEventListener('visibilitychange', onVisibilityChange);
    win.removeEventListener('blur', onBlur);
  };
}

// When sending from the panel, focus returns to the remote desktop tab only after the panel closes; wait for it before typing.
export function waitForPageFocus({ win, doc, timeoutMs }) {
  const focused = () => doc.visibilityState === 'visible' && doc.hasFocus();
  if (focused()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const finish = (result) => {
      clearTimeout(timer);
      win.removeEventListener('focus', check);
      doc.removeEventListener('visibilitychange', check);
      resolve(result);
    };
    const check = () => { if (focused()) finish(true); };
    const timer = setTimeout(() => finish(focused()), timeoutMs);
    win.addEventListener('focus', check);
    doc.addEventListener('visibilitychange', check);
  });
}
