import { normalizeForTyping } from '../core/normalize.js';
import { buildTypingPlan, hasNonAscii, planToText, withLeadingImeCommit } from '../core/segment.js';
import { evaluateDirect, estimateDurationMs, textStats } from '../core/policy.js';
import { pacingFor, precisePacingFor } from '../core/settings.js';
import { preparePrecise, fromBase64 } from '../core/precise.js';
import { runPlan } from '../core/sender.js';
import { formatBytes, formatCount, formatStats } from '../core/format.js';
import { watchInterruptions, waitForPageFocus, INTERRUPT_REASONS } from './guard.js';
import { validateMessage } from '../core/messages.js';
import { errorText } from '../core/i18n.js';

const KEY_RELEASE_TIMEOUT_MS = 3000;
const FOCUS_TIMEOUT_MS = 5000;
const PREVIEW_LINES = 8;

function previewOf(text, t) {
  const lines = text.split('\n');
  const hidden = lines.length - PREVIEW_LINES;
  return lines.slice(0, PREVIEW_LINES).join('\n') + (hidden > 0 ? `\n${t('previewMoreLines', { count: formatCount(hidden) })}` : '');
}

export function createController({ win, doc, adapter, overlay, keys, getSettings, getT, storeRemaining }) {
  let busy = false;
  let stopping = false;

  const keepRemaining = (text, pendingImeCommit) => Promise.resolve()
    .then(() => storeRemaining(text, pendingImeCommit))
    .then((stored) => stored === true, () => false);
  const isPageFocused = () => doc.visibilityState === 'visible' && doc.hasFocus();

  function runExclusive(task) {
    busy = true;
    task()
      .catch((error) => overlay.toast({ tone: 'error', title: getT()('sendFailedTitle'), body: errorText(error, getT()) }))
      .finally(() => { busy = false; stopping = false; });
  }

  function confirmDirect({ text, verdict, durationMs, settings }) {
    const t = getT();
    const { lines, chars } = verdict.stats;
    const notices = [
      verdict.exceedsLimit && { tone: 'error', text: t('confirmExceedsLimit', { limit: formatCount(settings.maxDirectChars) }) },
      !verdict.exceedsLimit && verdict.suggestPrecise && { tone: 'warn', text: t('confirmSuggestPrecise') },
      lines > 1 && { tone: 'info', text: t('confirmTerminalLines') },
      hasNonAscii(text) && { tone: 'info', text: t('nonAsciiNotice') },
    ].filter(Boolean);
    return overlay.confirm({
      title: t('confirmTitle'),
      meta: formatStats({ lines, chars, durationMs }, t),
      preview: previewOf(text, t),
      notices,
      actions: [
        { id: 'cancel', label: t('actionCancel'), hint: 'Esc' },
        { id: 'precise', label: t('actionPrecise'), hint: 'P' },
        { id: 'send', label: t('actionSend'), hint: 'Enter', primary: true, disabled: verdict.exceedsLimit },
      ],
      keymap: { Enter: 'send', NumpadEnter: 'send', Escape: 'cancel', KeyP: 'precise' },
    });
  }

  async function reportStopped({ result, kind, reason }) {
    const t = getT();
    const cause = result.status === 'error' ? result.error : t(INTERRUPT_REASONS[reason] ?? 'causeStopped');
    if (kind === 'precise') {
      overlay.toast({ tone: 'warn', title: t('preciseStoppedTitle'), body: t('preciseStoppedBody', { cause }) });
      return;
    }
    const stored = await keepRemaining(result.remainingText, result.pendingImeCommit);
    overlay.toast({
      tone: result.status === 'error' ? 'error' : 'warn',
      title: t('stoppedTitle', { line: formatCount(result.lineNumber) }),
      body: t(stored ? 'stoppedBodyStored' : 'stoppedBodyNotStored', { cause }),
    });
  }

  function reportDone({ kind, stats, prepared }) {
    const t = getT();
    if (kind === 'precise') {
      overlay.toast({ tone: 'ok', title: t('preciseDoneTitle', { path: prepared.targetPath }), body: t('preciseDoneBody'), code: prepared.sha256 });
      return;
    }
    overlay.toast({ tone: 'ok', title: t('doneTitle'), body: formatStats(stats, t) });
  }

  async function notStarted({ source, plan, kind }, { tone = 'warn', title = 'notStartedTitle', body, keptBody }) {
    const kept = source === 'panel' && kind === 'direct' && await keepRemaining(planToText(plan), plan[0]?.type === 'imeCommit');
    overlay.toast({ tone, title: getT()(title), body: getT()(kept ? keptBody : body) });
    return false;
  }

  function focusLost(context) {
    if (context.source === 'panel') return notStarted(context, { body: 'notStartedFocus', keptBody: 'notStartedFocusKept' });
    return notStarted(context, { body: 'notStartedFocusHotkey' });
  }

  async function ensureReadyToType(context) {
    if (!adapter.isAvailable()) {
      return notStarted(context, { tone: 'error', title: 'inputNotFoundTitle', body: 'inputNotFoundBody', keptBody: 'inputNotFoundKept' });
    }
    if (context.source === 'panel' && !(await waitForPageFocus({ win, doc, timeoutMs: FOCUS_TIMEOUT_MS }))) return focusLost(context);
    if (!(await keys.waitUntilReleased(KEY_RELEASE_TIMEOUT_MS))) {
      return notStarted(context, { body: 'notStartedKeysHeld', keptBody: 'notStartedKeysHeldKept' });
    }
    if (!isPageFocused()) return focusLost(context);
    return true;
  }

  async function typePlan({ plan, pacing, newlineKey, source, kind, stats, prepared }) {
    if (!(await ensureReadyToType({ source, plan, kind }))) return;
    const abort = new AbortController();
    let reason = null;
    const stopWatching = watchInterruptions({
      win, doc, onInterrupt: (cause) => { reason = reason ?? cause; stopping = true; abort.abort(); },
    });
    const progress = overlay.progress({ title: getT()(kind === 'precise' ? 'progressPrecise' : 'progressDirect') });
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
    const pacing = precisePacingFor(getSettings().speed);
    const plan = buildTypingPlan(prepared.commandText, { chunkSize: pacing.chunkSize, sendTabKey: false });
    await typePlan({ plan, pacing, newlineKey: 'enter', source, kind: 'precise', prepared });
  }

  async function prepareBytes({ bytes, createdAt, fileName }) {
    const settings = getSettings();
    if (bytes.length > settings.maxPreciseBytes) {
      throw new Error(getT()('preciseTooLarge', { size: formatBytes(bytes.length), limit: formatBytes(settings.maxPreciseBytes) }));
    }
    return preparePrecise({ bytes, date: new Date(createdAt), dir: settings.preciseDir, originalName: fileName ?? undefined });
  }

  async function directFlow(rawText, { source, sendTabKey, newlineKey, leadingImeCommit = false }) {
    const settings = getSettings();
    const text = normalizeForTyping(rawText, { tabWidth: settings.tabWidth, sendTabKey, keepTrailingNewline: settings.keepTrailingNewline });
    const verdict = evaluateDirect(text, settings);
    if (verdict.empty) {
      overlay.toast({ tone: 'warn', title: getT()('emptyTitle'), body: getT()('emptyBody') });
      return;
    }
    const pacing = pacingFor(settings.speed);
    const basePlan = buildTypingPlan(text, { chunkSize: pacing.chunkSize, sendTabKey, imeCommitEnter: settings.imeCommitEnter });
    const plan = leadingImeCommit ? withLeadingImeCommit(basePlan) : basePlan;

    if (source === 'hotkey' && (verdict.needsConfirm || verdict.exceedsLimit)) {
      const choice = await confirmDirect({ text, verdict, durationMs: estimateDurationMs(plan, pacing), settings });
      if (choice === 'cancel') return;
      if (choice === 'precise') {
        const bytes = new TextEncoder().encode(rawText);
        await preciseFlow(await prepareBytes({ bytes, createdAt: Date.now() }), source);
        return;
      }
    } else if (verdict.exceedsLimit) {
      overlay.toast({ tone: 'error', title: getT()('overLimitTitle'), body: getT()('overLimitBody', { limit: formatCount(settings.maxDirectChars) }) });
      return;
    }
    await typePlan({ plan, pacing, newlineKey: newlineKey ?? settings.newlineKey, source, kind: 'direct', stats: textStats(text) });
  }

  return {
    fromHotkey(text) {
      if (busy && stopping) return;
      if (busy) {
        overlay.toast({ tone: 'warn', title: getT()('busyTitle'), body: getT()('busyBody') });
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
        runExclusive(() => directFlow(message.text, {
          source: 'panel', sendTabKey: message.sendTabKey, newlineKey: message.newlineKey, leadingImeCommit: message.leadingImeCommit,
        }));
      } else {
        runExclusive(async () => preciseFlow(await prepareBytes({ ...message, bytes: fromBase64(message.dataBase64) }), 'panel'));
      }
      return { accepted: true };
    },
  };
}
