// Tracks which physical keys the user is holding and waits until all of them are released (docs/ARCHITECTURE.md#safety).
import { nextHeldKeys } from '../core/hotkey.js';

const POLL_INTERVAL_MS = 20;
const KEYUP_SWALLOW_MS = 1500;

export function createKeyTracker(win) {
  let held = new Set();
  const track = (event) => {
    if (event.isTrusted) held = nextHeldKeys(held, event);
  };
  const reset = () => { held = nextHeldKeys(held, { type: 'blur' }); };

  // Must be registered before other capture listeners so it still sees keys they stop.
  win.addEventListener('keydown', track, true);
  win.addEventListener('keyup', track, true);
  win.addEventListener('blur', reset);

  return {
    async waitUntilReleased(timeoutMs) {
      const deadline = performance.now() + timeoutMs;
      while (held.size > 0) {
        if (performance.now() > deadline) return false;
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
      return true;
    },

    dispose() {
      win.removeEventListener('keydown', track, true);
      win.removeEventListener('keyup', track, true);
      win.removeEventListener('blur', reset);
    },
  };
}

// When a keydown is kept from the client, swallow its keyup too so the remote session never gets an unpaired release.
export function swallowNextKeyUp(win, code) {
  const onKeyUp = (event) => {
    if (event.code !== code) return;
    event.stopImmediatePropagation();
    cleanup();
  };
  const cleanup = () => {
    clearTimeout(timer);
    win.removeEventListener('keyup', onKeyUp, true);
  };
  const timer = setTimeout(cleanup, KEYUP_SWALLOW_MS);
  win.addEventListener('keyup', onKeyUp, true);
}
