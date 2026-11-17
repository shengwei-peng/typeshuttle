const IME_BUFFER_ID = 'CitrixClientImeBuffer';

const ENTER = { key: 'Enter', code: 'Enter', keyCode: 13 };
const TAB = { key: 'Tab', code: 'Tab', keyCode: 9 };
const SHIFT = { key: 'Shift', code: 'ShiftLeft', keyCode: 16 };
const PRESERVED_WHITE_SPACE = ['pre', 'pre-wrap', 'break-spaces'];

function findImeBuffer(doc) {
  return doc.getElementById(IME_BUFFER_ID);
}

function preserveSpaces(buffer, doc) {
  const current = doc.defaultView?.getComputedStyle(buffer).whiteSpace;
  if (!PRESERVED_WHITE_SPACE.includes(current)) buffer.style.setProperty('white-space', 'pre', 'important');
}

function dispatchKey(target, type, spec, shiftKey) {
  target.dispatchEvent(new KeyboardEvent(type, {
    key: spec.key,
    code: spec.code,
    keyCode: spec.keyCode,
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
  dispatchKey(target, 'keyup', spec, shift);
  if (shift) dispatchKey(target, 'keyup', SHIFT, false);
}

export function createCitrixAdapter(doc, { getT }) {
  const requireBuffer = () => {
    const buffer = findImeBuffer(doc);
    if (!buffer) throw new Error(getT()('adapterNoInput'));
    return buffer;
  };

  return {
    isAvailable: () => findImeBuffer(doc) !== null,

    insertText(text) {
      const buffer = requireBuffer();
      preserveSpaces(buffer, doc);
      buffer.focus();
      buffer.dispatchEvent(new InputEvent('input', { data: '', inputType: 'insertText', bubbles: true }));
      if (!doc.execCommand('insertText', false, text)) {
        throw new Error(getT()('adapterInsertRefused'));
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
