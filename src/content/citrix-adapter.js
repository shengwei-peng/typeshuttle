// Injection adapter for Citrix Workspace app for HTML5, based on the behaviors in docs/clients.md (F1, F2, F4-F9).

const IME_BUFFER_ID = 'CitrixClientImeBuffer';

const ENTER = { key: 'Enter', code: 'Enter', keyCode: 13, withKeypress: true };
const TAB = { key: 'Tab', code: 'Tab', keyCode: 9, withKeypress: false };
const SHIFT = { key: 'Shift', code: 'ShiftLeft', keyCode: 16, withKeypress: false };

function findImeBuffer(doc) {
  return doc.getElementById(IME_BUFFER_ID);
}

function dispatchKey(target, type, spec, shiftKey) {
  // keyCode / charCode / which must be passed to the constructor (legacy fields Chrome still honors): content scripts run in an isolated world,
  // so properties added with Object.defineProperty are invisible to the page's own scripts.
  const charCode = type === 'keypress' ? spec.keyCode : 0;
  target.dispatchEvent(new KeyboardEvent(type, {
    key: spec.key,
    code: spec.code,
    keyCode: spec.keyCode,
    charCode,
    which: spec.keyCode,
    shiftKey,
    bubbles: true,
    cancelable: true,
    composed: true,
  }));
}

function tapKey(target, spec, { shift = false } = {}) {
  if (shift) dispatchKey(target, 'keydown', SHIFT, true);
  dispatchKey(target, 'keydown', spec, shift);
  if (spec.withKeypress) dispatchKey(target, 'keypress', spec, shift);
  dispatchKey(target, 'keyup', spec, shift);
  if (shift) dispatchKey(target, 'keyup', SHIFT, false);
}

export function createCitrixAdapter(doc) {
  const requireBuffer = () => {
    const buffer = findImeBuffer(doc);
    if (!buffer) throw new Error('找不到遠端桌面的輸入區，Citrix 連線可能已中斷');
    return buffer;
  };

  return {
    isAvailable: () => findImeBuffer(doc) !== null,

    insertText(text) {
      const buffer = requireBuffer();
      buffer.focus();
      // F5: after any key event Citrix swallows the next text input, so feed it an empty one first.
      buffer.dispatchEvent(new InputEvent('input', { data: '', inputType: 'insertText', bubbles: true }));
      if (!doc.execCommand('insertText', false, text)) {
        throw new Error('瀏覽器拒絕插入文字，請點一下遠端桌面畫面後再試');
      }
    },

    pressNewline({ shift }) {
      tapKey(requireBuffer(), ENTER, { shift });
    },

    pressTab() {
      tapKey(requireBuffer(), TAB);
    },
  };
}
