// Overlay styles. They live inside the shadow root, so page CSS cannot affect them and they cannot affect the page.
export const OVERLAY_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
section, .toasts {
  --ground: #ffffff;
  --ink: #1a1f26;
  --muted: #5a6472;
  --rule: #d9dee5;
  --accent: #0e6f7c;
  --accent-ink: #ffffff;
  --code-bg: #eef1f4;
  --ok: #2e7a4c;
  --warn: #8f5a00;
  --error: #a9322b;
  --font: system-ui, "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif;
  --mono: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  section, .toasts {
    --ground: #1b2027;
    --ink: #e4e8ed;
    --muted: #98a2af;
    --rule: #2f3640;
    --accent: #5cc0cc;
    --accent-ink: #0b1416;
    --code-bg: #232932;
    --ok: #6cc38f;
    --warn: #e0a843;
    --error: #ee8a82;
  }
}
section {
  position: fixed;
  z-index: 2147483647;
  font: 14px/1.6 var(--font);
  color: var(--ink);
  background: var(--ground);
  border: 1px solid var(--rule);
  border-radius: 10px;
  box-shadow: 0 12px 32px rgb(0 0 0 / 0.22);
}
h2 { margin: 0; font-size: 17px; line-height: 1.4; text-wrap: balance; }
p { margin: 0; }
.brand { font: 600 11px/1 var(--mono); letter-spacing: 0.08em; color: var(--accent); }
.dialog {
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: min(560px, calc(100vw - 32px));
  padding: 20px;
  display: grid;
  gap: 12px;
}
.meta { color: var(--muted); font-variant-numeric: tabular-nums; }
.preview {
  margin: 0;
  max-height: 180px;
  overflow: auto;
  padding: 10px 12px;
  background: var(--code-bg);
  border-radius: 8px;
  font: 12.5px/1.6 var(--mono);
  white-space: pre;
}
.notice { padding-left: 10px; border-left: 3px solid var(--rule); }
.notice.warn { border-color: var(--warn); }
.notice.error { border-color: var(--error); color: var(--error); }
.actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
button {
  font: inherit;
  color: var(--ink);
  background: transparent;
  border: 1px solid var(--rule);
  border-radius: 7px;
  padding: 6px 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
button:hover { border-color: var(--accent); }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
button.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
button:disabled { opacity: 0.45; cursor: not-allowed; }
kbd { font: 11px/1.4 var(--mono); padding: 0 5px; border: 1px solid currentColor; border-radius: 4px; opacity: 0.75; }
.progress { right: 16px; bottom: 16px; width: 280px; padding: 12px 14px; display: grid; gap: 8px; }
.row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.percent { font: 600 13px/1 var(--mono); font-variant-numeric: tabular-nums; color: var(--accent); }
.bar { display: block; height: 4px; border-radius: 2px; background: var(--code-bg); overflow: hidden; }
.fill { display: block; height: 100%; background: var(--accent); transform: scaleX(0); transform-origin: left; transition: transform 120ms linear; }
.hint { font-size: 12px; color: var(--muted); }
.toasts {
  position: fixed;
  z-index: 2147483647;
  top: 16px;
  right: 16px;
  width: min(380px, calc(100vw - 32px));
  display: grid;
  gap: 8px;
}
.toast { position: static; padding: 12px 14px; display: grid; gap: 6px; border-left: 4px solid var(--ok); }
.toast.warn { border-left-color: var(--warn); }
.toast.error { border-left-color: var(--error); }
.toast code {
  font: 12px/1.5 var(--mono);
  background: var(--code-bg);
  padding: 4px 6px;
  border-radius: 5px;
  word-break: break-all;
  user-select: all;
}
.close { border: 0; padding: 0 4px; font-size: 18px; line-height: 1; color: var(--muted); }
@media (prefers-reduced-motion: reduce) { .fill { transition: none; } }
`;
