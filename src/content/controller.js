// Send flow: hotkey or panel -> normalize and check -> confirm -> wait for keys to be released -> type step by step -> report.
import { normalizeForTyping } from '../core/normalize.js';
import { buildTypingPlan, planToText } from '../core/segment.js';
import { evaluateDirect, estimateDurationMs, textStats } from '../core/policy.js';
import { pacingFor } from '../core/settings.js';
import { preparePrecise, fromBase64 } from '../core/precise.js';
import { runPlan } from '../core/sender.js';
import { formatBytes, formatCount, formatDuration } from '../core/format.js';
import { watchInterruptions, waitForPageFocus, INTERRUPT_REASONS } from './guard.js';
import { validateMessage } from '../core/messages.js';

const KEY_RELEASE_TIMEOUT_MS = 3000;
const FOCUS_TIMEOUT_MS = 5000;
const PREVIEW_LINES = 8;

function previewOf(text) {
  const lines = text.split('\n');
  const hidden = lines.length - PREVIEW_LINES;
  return lines.slice(0, PREVIEW_LINES).join('\n') + (hidden > 0 ? `\n… 還有 ${formatCount(hidden)} 行` : '');
}

export function createController({ win, doc, adapter, overlay, keys, getSettings, storeRemaining }) {
  let busy = false;

  function runExclusive(task) {
    busy = true;
    task()
      .catch((error) => overlay.toast({ tone: 'error', title: '送出失敗', body: error.message }))
      .finally(() => { busy = false; });
  }

  function confirmDirect({ text, verdict, durationMs, settings }) {
    const { lines, chars } = verdict.stats;
    const notices = [
      verdict.exceedsLimit && { tone: 'error', text: `超過直接打字上限 ${formatCount(settings.maxDirectChars)} 字。請改用精確傳輸（接收端需為遠端 bash 終端機）。` },
      !verdict.exceedsLimit && verdict.suggestPrecise && { tone: 'warn', text: '文字較長，建議改用精確傳輸：內容完整保留，還能用 sha256 核對（接收端需為遠端 bash 終端機）。' },
      lines > 1 && { tone: 'info', text: '如果遠端游標在終端機裡，每一行都會立即執行。' },
    ].filter(Boolean);
    return overlay.confirm({
      title: '送出到遠端桌面？',
      meta: `${formatCount(lines)} 行 · ${formatCount(chars)} 字 · 約 ${formatDuration(durationMs)}`,
      preview: previewOf(text),
      notices,
      actions: [
        { id: 'cancel', label: '取消', hint: 'Esc' },
        { id: 'precise', label: '改用精確傳輸', hint: 'P' },
        { id: 'send', label: '送出', hint: 'Enter', primary: true, disabled: verdict.exceedsLimit },
      ],
      keymap: { Enter: 'send', NumpadEnter: 'send', Escape: 'cancel', KeyP: 'precise' },
    });
  }

  async function reportStopped({ result, kind, reason }) {
    const cause = result.status === 'error' ? result.error : INTERRUPT_REASONS[reason] ?? '已中止';
    if (kind === 'precise') {
      overlay.toast({ tone: 'warn', title: '精確傳輸已中止', body: `${cause}。遠端終端機仍在等待資料，請在遠端按 Ctrl+C 結束後再重新送出。` });
      return;
    }
    const stored = await storeRemaining(result.remainingText).then(() => true, () => false);
    overlay.toast({
      tone: result.status === 'error' ? 'error' : 'warn',
      title: `已中止：停在第 ${formatCount(result.lineNumber)} 行`,
      body: stored
        ? `${cause}。剩餘內容已放進工具列面板，把游標移回正確位置後，從面板再送出。`
        : `${cause}。剩餘內容無法放進面板，請重新複製後再送出。`,
    });
  }

  function reportDone({ kind, stats, prepared }) {
    if (kind === 'precise') {
      overlay.toast({ tone: 'ok', title: `已送出到 ${prepared.targetPath}`, body: '遠端終端機最後會印出 sha256，請與下列值核對：', code: prepared.sha256 });
      return;
    }
    overlay.toast({ tone: 'ok', title: '已送出', body: `${formatCount(stats.lines)} 行 · ${formatCount(stats.chars)} 字` });
  }

  async function ensureReadyToType({ source, plan, kind }) {
    if (!adapter.isAvailable()) {
      overlay.toast({ tone: 'error', title: '找不到遠端桌面的輸入區', body: '請確認 Citrix 已連線，並點一下遠端桌面畫面。' });
      return false;
    }
    if (source === 'panel' && !(await waitForPageFocus({ win, doc, timeoutMs: FOCUS_TIMEOUT_MS }))) {
      const stored = kind === 'direct' && await storeRemaining(planToText(plan)).then(() => true, () => false);
      overlay.toast({
        tone: 'warn',
        title: '沒有開始送出',
        body: stored
          ? '請點回遠端桌面分頁，再從工具列面板送出一次（內容已保留在面板）。'
          : '請點回遠端桌面分頁，再從工具列面板重新送出。',
      });
      return false;
    }
    if (!(await keys.waitUntilReleased(KEY_RELEASE_TIMEOUT_MS))) {
      overlay.toast({ tone: 'warn', title: '沒有開始送出', body: '偵測到有按鍵沒有放開。請放開所有按鍵後再試一次。' });
      return false;
    }
    return true;
  }

  async function typePlan({ plan, pacing, newlineKey, source, kind, stats, prepared }) {
    if (!(await ensureReadyToType({ source, plan, kind }))) return;
    const abort = new AbortController();
    let reason = null;
    const stopWatching = watchInterruptions({
      win, doc, onInterrupt: (cause) => { reason = reason ?? cause; abort.abort(); },
    });
    const progress = overlay.progress({ title: kind === 'precise' ? '精確傳輸中' : '送出中' });
    try {
      const result = await runPlan({
        plan, adapter, pacing, newlineKey, signal: abort.signal,
        onProgress: ({ done, total }) => progress.update(done, total),
      });
      if (result.status === 'done') reportDone({ kind, stats, prepared });
      else await reportStopped({ result, kind, reason });
    } finally {
      stopWatching();
      progress.close();
    }
  }

  async function preciseFlow(prepared, source) {
    const pacing = pacingFor(getSettings().speed);
    const plan = buildTypingPlan(prepared.commandText, { chunkSize: pacing.chunkSize, sendTabKey: false });
    await typePlan({ plan, pacing, newlineKey: 'enter', source, kind: 'precise', prepared });
  }

  async function prepareBytes({ bytes, createdAt, fileName }) {
    const settings = getSettings();
    if (bytes.length > settings.maxPreciseBytes) {
      throw new Error(`內容 ${formatBytes(bytes.length)} 超過精確傳輸上限 ${formatBytes(settings.maxPreciseBytes)}`);
    }
    return preparePrecise({ bytes, date: new Date(createdAt), dir: settings.preciseDir, originalName: fileName ?? undefined });
  }

  async function directFlow(rawText, { source, sendTabKey, newlineKey }) {
    const settings = getSettings();
    const text = normalizeForTyping(rawText, { tabWidth: settings.tabWidth, sendTabKey, keepTrailingNewline: settings.keepTrailingNewline });
    const verdict = evaluateDirect(text, settings);
    if (verdict.empty) {
      overlay.toast({ tone: 'warn', title: '沒有可送出的文字', body: '剪貼簿是空的，或只有圖片等非文字內容。' });
      return;
    }
    const pacing = pacingFor(settings.speed);
    const plan = buildTypingPlan(text, { chunkSize: pacing.chunkSize, sendTabKey });

    if (source === 'hotkey' && (verdict.needsConfirm || verdict.exceedsLimit)) {
      const choice = await confirmDirect({ text, verdict, durationMs: estimateDurationMs(plan, pacing), settings });
      if (choice === 'cancel') return;
      if (choice === 'precise') {
        const bytes = new TextEncoder().encode(rawText);
        await preciseFlow(await prepareBytes({ bytes, createdAt: Date.now() }), source);
        return;
      }
    } else if (verdict.exceedsLimit) {
      overlay.toast({ tone: 'error', title: '文字超過直接打字上限', body: `上限 ${formatCount(settings.maxDirectChars)} 字，請改用精確傳輸。` });
      return;
    }
    await typePlan({ plan, pacing, newlineKey: newlineKey ?? settings.newlineKey, source, kind: 'direct', stats: textStats(text) });
  }

  return {
    fromHotkey(text) {
      if (busy) {
        overlay.toast({ tone: 'warn', title: '正在送出中', body: '請等目前的內容送完，或按任意鍵中止後再試。' });
        return;
      }
      runExclusive(() => directFlow(text, { source: 'hotkey', sendTabKey: false }));
    },

    handleMessage(rawMessage) {
      const message = validateMessage(rawMessage);
      if (!message) return null;
      if (message.type === 'typeshuttle/status') return { ready: adapter.isAvailable(), busy };
      if (busy) return { accepted: false, reason: 'busy' };
      if (!adapter.isAvailable()) return { accepted: false, reason: 'not-ready' };
      if (message.type === 'typeshuttle/send-direct') {
        runExclusive(() => directFlow(message.text, { source: 'panel', sendTabKey: message.sendTabKey, newlineKey: message.newlineKey }));
      } else {
        runExclusive(async () => preciseFlow(await prepareBytes({ ...message, bytes: fromBase64(message.dataBase64) }), 'panel'));
      }
      return { accepted: true };
    },
  };
}
