// Confirmation dialog, progress and toasts shown on top of the remote desktop page (docs/ARCHITECTURE.md#safety).
// A closed shadow root isolates it from the page styles; pointer and key events never reach the client, so clicks are not sent to the remote session.
import { OVERLAY_CSS } from './overlay-style.js';
import { swallowNextKeyUp } from './keys.js';

const ISOLATED_POINTER_EVENTS = [
  'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'wheel',
  'pointerdown', 'pointerup', 'pointermove', 'mousemove', 'touchstart', 'touchend',
];
const TOAST_DURATION_MS = { ok: 6000, warn: 12000, error: 12000 };
// Keep only the latest few toasts so repeated actions do not cover the remote screen.
const MAX_TOASTS = 3;
// Production uses a closed shadow root so page scripts cannot read the clipboard preview; test builds use open so Playwright can inspect it.
const SHADOW_MODE = __TYPESHUTTLE_TEST__ ? 'open' : 'closed';

function h(doc, tag, props = {}, children = []) {
  const element = doc.createElement(tag);
  Object.entries(props).forEach(([name, value]) => {
    if (name === 'text') element.textContent = value;
    else if (name === 'on') Object.entries(value).forEach(([type, fn]) => element.addEventListener(type, fn));
    else if (value !== false && value !== undefined) element.setAttribute(name, value === true ? '' : value);
  });
  children.filter(Boolean).forEach((child) => element.append(child));
  return element;
}

export function createOverlay({ doc, win }) {
  let root = null;

  const ensureRoot = () => {
    if (root?.host.isConnected) return root;
    const host = h(doc, 'typeshuttle-overlay');
    ISOLATED_POINTER_EVENTS.forEach((type) => host.addEventListener(type, (event) => event.stopPropagation()));
    root = host.attachShadow({ mode: SHADOW_MODE });
    root.append(h(doc, 'style', { text: OVERLAY_CSS }), h(doc, 'div', { class: 'toasts', 'aria-live': 'polite' }));
    doc.documentElement.append(host);
    return root;
  };

  function confirm({ title, meta, preview, notices = [], actions, keymap }) {
    const shadow = ensureRoot();
    return new Promise((resolve) => {
      const close = (actionId) => {
        win.removeEventListener('keydown', onKeyDown, true);
        dialog.remove();
        resolve(actionId);
      };
      const onKeyDown = (event) => {
        if (!event.isTrusted) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        // Match on physical key codes so the keymap still works while a local IME is active.
        const actionId = keymap[event.code];
        const action = actions.find((candidate) => candidate.id === actionId);
        if (!action || action.disabled || event.repeat) return;
        swallowNextKeyUp(win, event.code);
        close(actionId);
      };

      const buttons = actions.map((action) => h(doc, 'button', {
        type: 'button',
        class: action.primary ? 'primary' : '',
        disabled: Boolean(action.disabled),
        on: { click: () => close(action.id) },
      }, [action.label, action.hint && h(doc, 'kbd', { text: action.hint })]));

      const dialog = h(doc, 'section', { class: 'dialog', role: 'dialog', 'aria-label': title }, [
        h(doc, 'p', { class: 'brand', text: 'TypeShuttle' }),
        h(doc, 'h2', { text: title }),
        h(doc, 'p', { class: 'meta', text: meta }),
        preview && h(doc, 'pre', { class: 'preview', text: preview }),
        ...notices.map((notice) => h(doc, 'p', { class: `notice ${notice.tone}`, text: notice.text })),
        h(doc, 'div', { class: 'actions' }, buttons),
      ]);
      win.addEventListener('keydown', onKeyDown, true);
      shadow.append(dialog);
    });
  }

  function progress({ title }) {
    const shadow = ensureRoot();
    const label = h(doc, 'span', { class: 'percent', text: '0%' });
    const fill = h(doc, 'span', { class: 'fill' });
    const panel = h(doc, 'section', { class: 'progress', role: 'status' }, [
      h(doc, 'div', { class: 'row' }, [h(doc, 'strong', { text: title }), label]),
      h(doc, 'span', { class: 'bar' }, [fill]),
      h(doc, 'p', { class: 'hint', text: '按任意鍵或點一下畫面即可中止' }),
    ]);
    shadow.append(panel);
    return {
      update(done, total) {
        const ratio = total === 0 ? 1 : done / total;
        label.textContent = `${Math.floor(ratio * 100)}%`;
        fill.style.transform = `scaleX(${ratio})`;
      },
      close: () => panel.remove(),
    };
  }

  function toast({ tone, title, body, code }) {
    const container = ensureRoot().querySelector('.toasts');
    const item = h(doc, 'section', { class: `toast ${tone}`, role: tone === 'ok' ? 'status' : 'alert' }, [
      h(doc, 'div', { class: 'row' }, [
        h(doc, 'strong', { text: title }),
        h(doc, 'button', { type: 'button', class: 'close', 'aria-label': '關閉', text: '×', on: { click: () => item.remove() } }),
      ]),
      body && h(doc, 'p', { text: body }),
      code && h(doc, 'code', { text: code }),
    ]);
    container.append(item);
    Array.from(container.children).slice(0, -MAX_TOASTS).forEach((old) => old.remove());
    setTimeout(() => item.remove(), TOAST_DURATION_MS[tone] ?? TOAST_DURATION_MS.ok);
  }

  return { confirm, progress, toast };
}
