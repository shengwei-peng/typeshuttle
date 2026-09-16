// Panel send form with direct typing and precise transfer modes; shows stats, warnings and transfer details before sending.
import { normalizeForTyping } from '../core/normalize.js';
import { buildTypingPlan } from '../core/segment.js';
import { evaluateDirect, estimateDurationMs } from '../core/policy.js';
import { pacingFor } from '../core/settings.js';
import { preparePrecise, toBase64 } from '../core/precise.js';
import { formatBytes, formatCount, formatDuration } from '../core/format.js';
import { remainingKey } from '../shared/remaining.js';

const $ = (id) => document.getElementById(id);
const PRECISE_DEBOUNCE_MS = 200;
const COMMAND_OVERHEAD_LINES = 3;
const REJECT_REASONS = {
  busy: '正在送出中，請等目前的內容送完。',
  'not-ready': '找不到遠端桌面的輸入區，請確認 Citrix 仍在連線。',
};

function setWarning(tone, text) {
  const element = $('warning');
  element.hidden = !text;
  element.className = `notice ${tone}`;
  element.textContent = text ?? '';
}

export async function createSendForm({ tab, settings, onSent }) {
  const createdAt = Date.now();
  const pacing = pacingFor(settings.speed);
  let mode = 'direct';
  let file = null;
  let refreshToken = 0;

  function refreshDirect() {
    const sendTabKey = $('send-tab').checked;
    const text = normalizeForTyping($('text').value, { tabWidth: settings.tabWidth, sendTabKey, keepTrailingNewline: settings.keepTrailingNewline });
    const verdict = evaluateDirect(text, settings);
    const plan = buildTypingPlan(text, { chunkSize: pacing.chunkSize, sendTabKey });
    $('stats').textContent = verdict.empty
      ? '尚未輸入內容'
      : `${formatCount(verdict.stats.lines)} 行 · ${formatCount(verdict.stats.chars)} 字 · 約 ${formatDuration(estimateDurationMs(plan, pacing))}`;
    if (verdict.exceedsLimit) setWarning('error', `超過直接打字上限 ${formatCount(settings.maxDirectChars)} 字，請改用精確傳輸。`);
    else if (verdict.suggestPrecise) setWarning('warn', '文字較長，建議改用精確傳輸（接收端需為遠端 bash 終端機）。');
    else setWarning('warn', null);
    $('send').disabled = verdict.empty || verdict.exceedsLimit;
  }

  const preciseBytes = () => (file ? file.bytes : new TextEncoder().encode($('text').value));

  async function refreshPrecise() {
    const token = ++refreshToken;
    const bytes = preciseBytes();
    $('send').disabled = true;
    $('precise-details').hidden = true;
    if (bytes.length === 0) {
      $('stats').textContent = '尚未輸入內容或選擇檔案';
      setWarning('warn', null);
      return;
    }
    $('stats').textContent = file ? `檔案：${file.name}（${formatBytes(bytes.length)}）` : `文字：${formatBytes(bytes.length)}`;
    if (bytes.length > settings.maxPreciseBytes) {
      setWarning('error', `超過精確傳輸上限 ${formatBytes(settings.maxPreciseBytes)}。`);
      return;
    }
    setWarning('warn', null);
    await new Promise((resolve) => setTimeout(resolve, PRECISE_DEBOUNCE_MS));
    if (token !== refreshToken) return;
    const prepared = await preparePrecise({ bytes, date: new Date(createdAt), dir: settings.preciseDir, originalName: file?.name });
    if (token !== refreshToken) return;
    const plan = buildTypingPlan(prepared.commandText, { chunkSize: pacing.chunkSize, sendTabKey: false });
    $('detail-path').textContent = prepared.targetPath;
    $('detail-size').textContent = `${formatBytes(prepared.byteLength)}（壓縮後 ${formatBytes(prepared.compressedLength)}）`;
    $('detail-lines').textContent = `${formatCount(prepared.payloadLines + COMMAND_OVERHEAD_LINES)} 行 · 約 ${formatDuration(estimateDurationMs(plan, pacing))}`;
    $('detail-sha').textContent = prepared.sha256;
    $('precise-details').hidden = false;
    $('send').disabled = false;
  }

  function refresh() {
    if (mode === 'direct') {
      refreshDirect();
      return;
    }
    refreshPrecise().catch((error) => setWarning('error', `無法準備精確傳輸：${error.message}`));
  }

  function setMode(next) {
    mode = next;
    $('mode-direct').setAttribute('aria-selected', String(next === 'direct'));
    $('mode-precise').setAttribute('aria-selected', String(next === 'precise'));
    $('direct-options').hidden = next !== 'direct';
    $('precise-note').hidden = next !== 'precise';
    $('file-row').hidden = next !== 'precise';
    $('send').textContent = next === 'direct' ? '送出到遠端' : '送出到遠端終端機';
    refresh();
  }

  async function selectFile() {
    const [selected] = $('file').files;
    if (!selected) return;
    if (selected.size > settings.maxPreciseBytes) {
      $('file').value = '';
      setWarning('error', `「${selected.name}」有 ${formatBytes(selected.size)}，超過上限 ${formatBytes(settings.maxPreciseBytes)}。`);
      return;
    }
    file = { name: selected.name, bytes: new Uint8Array(await selected.arrayBuffer()) };
    $('clear-file').hidden = false;
    $('text').disabled = true;
    refresh();
  }

  function clearFile() {
    file = null;
    $('file').value = '';
    $('clear-file').hidden = true;
    $('text').disabled = false;
    refresh();
  }

  async function send() {
    $('send').disabled = true;
    const message = mode === 'direct'
      ? { type: 'typeshuttle/send-direct', text: $('text').value, sendTabKey: $('send-tab').checked, newlineKey: $('newline-key').value }
      : { type: 'typeshuttle/send-precise', dataBase64: toBase64(preciseBytes()), createdAt, fileName: file?.name ?? null };
    try {
      const response = await chrome.tabs.sendMessage(tab.id, message);
      if (!response?.accepted) {
        setWarning('error', REJECT_REASONS[response?.reason] ?? '頁面沒有接受這次送出，請重新整理後再試。');
        $('send').disabled = false;
        return;
      }
      await chrome.storage.session.remove(remainingKey(tab.id));
      await chrome.tabs.update(tab.id, { active: true });
      onSent();
    } catch (error) {
      setWarning('error', `送出失敗：${error.message}`);
      $('send').disabled = false;
    }
  }

  async function loadRemaining() {
    const key = remainingKey(tab.id);
    const { [key]: remaining } = await chrome.storage.session.get(key);
    if (!remaining) return;
    $('text').value = remaining;
    $('remaining-banner').hidden = false;
  }

  async function clearRemaining() {
    await chrome.storage.session.remove(remainingKey(tab.id));
    $('remaining-banner').hidden = true;
    $('text').value = '';
    refresh();
  }

  $('newline-key').value = settings.newlineKey;
  await loadRemaining();
  $('text').addEventListener('input', refresh);
  $('send-tab').addEventListener('change', refresh);
  $('mode-direct').addEventListener('click', () => setMode('direct'));
  $('mode-precise').addEventListener('click', () => setMode('precise'));
  $('file').addEventListener('change', () => selectFile().catch((error) => setWarning('error', `無法讀取檔案：${error.message}`)));
  $('clear-file').addEventListener('click', clearFile);
  $('clear-remaining').addEventListener('click', () => clearRemaining().catch((error) => setWarning('error', error.message)));
  $('send').addEventListener('click', send);
  setMode('direct');
  $('text').focus();
}
