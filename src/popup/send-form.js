import { normalizeForTyping } from '../core/normalize.js';
import { buildTypingPlan, hasNonAscii } from '../core/segment.js';
import { evaluateDirect, estimateDurationMs } from '../core/policy.js';
import { pacingFor, precisePacingFor } from '../core/settings.js';
import { preparePrecise, toBase64 } from '../core/precise.js';
import { formatBytes, formatCount, formatEstimate, formatStats } from '../core/format.js';
import { readRemaining, remainingKey } from '../shared/remaining.js';
import { errorText } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);
const PRECISE_DEBOUNCE_MS = 200;
const COMMAND_OVERHEAD_LINES = 3;
const REJECT_REASONS = {
  busy: 'rejectBusy',
  'not-ready': 'rejectNotReady',
};

function setWarning(tone, text) {
  const element = $('warning');
  element.hidden = !text;
  element.className = `notice ${tone}`;
  element.textContent = text ?? '';
}

export async function createSendForm({ tab, settings, t, onSent }) {
  const createdAt = Date.now();
  const pacing = pacingFor(settings.speed);
  const precisePacing = precisePacingFor(settings.speed);
  let mode = 'direct';
  let file = null;
  let refreshToken = 0;
  let remaining = null;

  function refreshDirect() {
    const sendTabKey = $('send-tab').checked;
    const text = normalizeForTyping($('text').value, { tabWidth: settings.tabWidth, sendTabKey, keepTrailingNewline: settings.keepTrailingNewline });
    const verdict = evaluateDirect(text, settings);
    const plan = buildTypingPlan(text, { chunkSize: pacing.chunkSize, sendTabKey, imeCommitEnter: settings.imeCommitEnter });
    $('stats').textContent = verdict.empty
      ? t('statsEmptyDirect')
      : formatStats({ ...verdict.stats, durationMs: estimateDurationMs(plan, pacing) }, t);
    const notices = [
      verdict.exceedsLimit && { tone: 'error', text: t('panelOverLimit', { limit: formatCount(settings.maxDirectChars) }) },
      !verdict.exceedsLimit && verdict.suggestPrecise && { tone: 'warn', text: t('panelSuggestPrecise') },
      hasNonAscii(text) && { tone: 'info', text: t('nonAsciiNotice') },
    ].filter(Boolean);
    setWarning(notices[0]?.tone ?? 'warn', notices.length > 0 ? notices.map((notice) => notice.text).join(' ') : null);
    $('send').disabled = verdict.empty || verdict.exceedsLimit;
  }

  const preciseBytes = () => (file ? file.bytes : new TextEncoder().encode($('text').value));

  async function refreshPrecise() {
    const token = ++refreshToken;
    const bytes = preciseBytes();
    $('send').disabled = true;
    $('precise-details').hidden = true;
    if (bytes.length === 0) {
      $('stats').textContent = t('statsEmptyPrecise');
      setWarning('warn', null);
      return;
    }
    $('stats').textContent = file
      ? t('statsFile', { name: file.name, size: formatBytes(bytes.length) })
      : t('statsText', { size: formatBytes(bytes.length) });
    if (bytes.length > settings.maxPreciseBytes) {
      setWarning('error', t('panelPreciseTooLarge', { limit: formatBytes(settings.maxPreciseBytes) }));
      return;
    }
    setWarning('warn', null);
    await new Promise((resolve) => setTimeout(resolve, PRECISE_DEBOUNCE_MS));
    if (token !== refreshToken) return;
    const prepared = await preparePrecise({ bytes, date: new Date(createdAt), dir: settings.preciseDir, originalName: file?.name });
    if (token !== refreshToken) return;
    const plan = buildTypingPlan(prepared.commandText, { chunkSize: precisePacing.chunkSize, sendTabKey: false });
    $('detail-path').textContent = prepared.targetPath;
    $('detail-size').textContent = t('detailSizeValue', { size: formatBytes(prepared.byteLength), compressed: formatBytes(prepared.compressedLength) });
    $('detail-lines').textContent = `${t('lineCount', { count: formatCount(prepared.payloadLines + COMMAND_OVERHEAD_LINES) })} · ${formatEstimate(estimateDurationMs(plan, precisePacing), t)}`;
    $('detail-sha').textContent = prepared.sha256;
    $('precise-details').hidden = false;
    $('send').disabled = false;
  }

  function refresh() {
    if (mode === 'direct') {
      refreshDirect();
      return;
    }
    refreshPrecise().catch((error) => setWarning('error', t('panelPreciseFailed', { error: errorText(error, t) })));
  }

  function setMode(next) {
    mode = next;
    $('mode-direct').setAttribute('aria-selected', String(next === 'direct'));
    $('mode-precise').setAttribute('aria-selected', String(next === 'precise'));
    $('direct-options').hidden = next !== 'direct';
    $('precise-note').hidden = next !== 'precise';
    $('file-row').hidden = next !== 'precise';
    $('send').textContent = t(next === 'direct' ? 'sendDirect' : 'sendPrecise');
    refresh();
  }

  async function selectFile() {
    const [selected] = $('file').files;
    if (!selected) return;
    if (selected.size > settings.maxPreciseBytes) {
      $('file').value = '';
      setWarning('error', t('fileTooLarge', { name: selected.name, size: formatBytes(selected.size), limit: formatBytes(settings.maxPreciseBytes) }));
      return;
    }
    file = { name: selected.name, bytes: new Uint8Array(await selected.arrayBuffer()) };
    renderFileName();
    $('clear-file').hidden = false;
    $('text').disabled = true;
    refresh();
  }

  function renderFileName() {
    $('file-name').textContent = file ? file.name : t('fileNone');
  }

  function clearFile() {
    file = null;
    $('file').value = '';
    renderFileName();
    $('clear-file').hidden = true;
    $('text').disabled = false;
    refresh();
  }

  async function send() {
    $('send').disabled = true;
    const message = mode === 'direct'
      ? {
        type: 'typeshuttle/send-direct',
        text: $('text').value,
        sendTabKey: $('send-tab').checked,
        newlineKey: $('newline-key').value,
        leadingImeCommit: Boolean(remaining?.pendingImeCommit) && $('text').value === remaining.text,
      }
      : { type: 'typeshuttle/send-precise', dataBase64: toBase64(preciseBytes()), createdAt, fileName: file?.name ?? null };
    try {
      const response = await chrome.tabs.sendMessage(tab.id, message);
      if (!response?.accepted) {
        setWarning('error', t(REJECT_REASONS[response?.reason] ?? 'rejectUnknown'));
        $('send').disabled = false;
        return;
      }
      await chrome.storage.session.remove(remainingKey(tab.id));
      await chrome.tabs.update(tab.id, { active: true });
      onSent();
    } catch (error) {
      setWarning('error', t('sendFailed', { error: errorText(error, t) }));
      $('send').disabled = false;
    }
  }

  async function loadRemaining() {
    const key = remainingKey(tab.id);
    const { [key]: stored } = await chrome.storage.session.get(key);
    remaining = readRemaining(stored);
    if (!remaining?.text) return;
    $('text').value = remaining.text;
    $('remaining-banner').hidden = false;
  }

  async function clearRemaining() {
    await chrome.storage.session.remove(remainingKey(tab.id));
    remaining = null;
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
  $('file').addEventListener('change', () => selectFile().catch((error) => setWarning('error', t('fileReadFailed', { error: errorText(error, t) }))));
  $('clear-file').addEventListener('click', clearFile);
  $('choose-file').addEventListener('click', () => $('file').click());
  renderFileName();
  $('clear-remaining').addEventListener('click', () => clearRemaining().catch((error) => setWarning('error', errorText(error, t))));
  $('send').addEventListener('click', send);
  setMode('direct');
  $('text').focus();
}
