import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPlan } from '../../src/core/sender.js';
import { buildTypingPlan } from '../../src/core/segment.js';

const PACING = { chunkDelayMs: 40, lineDelayMs: 80 };
const noSleep = async () => {};

function recordingAdapter(onText = () => {}) {
  const calls = [];
  return {
    calls,
    insertText: (text) => { calls.push(['text', text]); onText(text); },
    pressNewline: ({ shift }) => calls.push(['newline', shift]),
    pressTab: () => calls.push(['tab']),
  };
}

const plan = (text, sendTabKey = false) => buildTypingPlan(text, { chunkSize: 10, sendTabKey });

test('runPlan executes steps in order and reports progress', async () => {
  const adapter = recordingAdapter();
  const progress = [];
  const result = await runPlan({
    plan: plan('ab\ncd'), adapter, pacing: PACING, newlineKey: 'enter',
    signal: new AbortController().signal, onProgress: (p) => progress.push(p), sleep: noSleep,
  });

  assert.deepEqual(adapter.calls, [['text', 'ab'], ['newline', false], ['text', 'cd']]);
  assert.equal(result.status, 'done');
  assert.equal(result.remainingText, '');
  assert.deepEqual(progress.at(-1), { done: 3, total: 3 });
});

test('runPlan presses Shift+Enter when configured and sends Tab keys', async () => {
  const adapter = recordingAdapter();
  await runPlan({
    plan: plan('a\tb\nc', true), adapter, pacing: PACING, newlineKey: 'shift-enter',
    signal: new AbortController().signal, sleep: noSleep,
  });
  assert.deepEqual(adapter.calls, [['text', 'a'], ['tab'], ['text', 'b'], ['newline', true], ['text', 'c']]);
});

test('runPlan waits the chunk delay after text and the line delay after newline', async () => {
  const waits = [];
  await runPlan({
    plan: plan('a\nb'), adapter: recordingAdapter(), pacing: PACING, newlineKey: 'enter',
    signal: new AbortController().signal, sleep: async (ms) => waits.push(ms),
  });
  assert.deepEqual(waits, [40, 80, 40]);
});

test('runPlan stops after an abort and returns the untyped remainder', async () => {
  const controller = new AbortController();
  const adapter = recordingAdapter((text) => { if (text === 'l2') controller.abort(); });
  const result = await runPlan({
    plan: plan('l1\nl2\nl3'), adapter, pacing: PACING, newlineKey: 'enter', signal: controller.signal, sleep: noSleep,
  });

  assert.equal(result.status, 'aborted');
  assert.equal(result.remainingText, '\nl3');
  assert.equal(result.lineNumber, 2);
  assert.deepEqual(adapter.calls, [['text', 'l1'], ['newline', false], ['text', 'l2']]);
});

test('runPlan does nothing when the signal is already aborted', async () => {
  const controller = new AbortController();
  controller.abort();
  const adapter = recordingAdapter();
  const result = await runPlan({
    plan: plan('a\nb'), adapter, pacing: PACING, newlineKey: 'enter', signal: controller.signal, sleep: noSleep,
  });

  assert.equal(result.status, 'aborted');
  assert.equal(result.remainingText, 'a\nb');
  assert.equal(result.lineNumber, 1);
  assert.deepEqual(adapter.calls, []);
});

test('runPlan reports an error with the remainder when the adapter throws', async () => {
  const adapter = {
    insertText: (text) => { if (text === 'b') throw new Error('input target disappeared'); },
    pressNewline: () => {},
    pressTab: () => {},
  };
  const result = await runPlan({
    plan: plan('a\nb\nc'), adapter, pacing: PACING, newlineKey: 'enter', signal: new AbortController().signal, sleep: noSleep,
  });

  assert.equal(result.status, 'error');
  assert.equal(result.error, 'input target disappeared');
  assert.equal(result.remainingText, 'b\nc');
  assert.equal(result.lineNumber, 2);
});

test('runPlan uses an abortable default sleep', async () => {
  const controller = new AbortController();
  const started = Date.now();
  setTimeout(() => controller.abort(), 20);
  const result = await runPlan({
    plan: plan('a\nb'), adapter: recordingAdapter(), pacing: { chunkDelayMs: 5000, lineDelayMs: 5000 },
    newlineKey: 'enter', signal: controller.signal,
  });

  assert.equal(result.status, 'aborted');
  assert.ok(Date.now() - started < 1000);
});
