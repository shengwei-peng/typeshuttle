import { swallowNextKeyUp } from './keys.js';

export const INTERRUPT_REASONS = Object.freeze({
  keyboard: 'interruptKeyboard',
  mouse: 'interruptMouse',
  hidden: 'interruptHidden',
  blur: 'interruptBlur',
});

export function watchInterruptions({ win, doc, onInterrupt }) {
  const onKeyDown = (event) => {
    if (!event.isTrusted) return;
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
