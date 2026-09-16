// Runs a typing plan step by step through an adapter: pacing, aborting and computing the unsent remainder.
import { planToText } from './segment.js';

function abortableSleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
  });
}

const STEP_ACTIONS = {
  text: (adapter, step) => adapter.insertText(step.value),
  newline: (adapter, _step, newlineKey) => adapter.pressNewline({ shift: newlineKey === 'shift-enter' }),
  tab: (adapter) => adapter.pressTab(),
};

function summarize(plan, completedSteps, status, extra = {}) {
  const newlinesDone = plan.slice(0, completedSteps).filter((step) => step.type === 'newline').length;
  return {
    status,
    completedSteps,
    totalSteps: plan.length,
    lineNumber: newlinesDone + 1,
    remainingText: planToText(plan.slice(completedSteps)),
    ...extra,
  };
}

export async function runPlan({ plan, adapter, pacing, newlineKey, signal, onProgress = () => {}, sleep }) {
  const wait = sleep ?? ((ms) => abortableSleep(ms, signal));
  for (const [index, step] of plan.entries()) {
    if (signal.aborted) return summarize(plan, index, 'aborted');
    try {
      STEP_ACTIONS[step.type](adapter, step, newlineKey);
    } catch (error) {
      return summarize(plan, index, 'error', { error: error.message });
    }
    onProgress({ done: index + 1, total: plan.length });
    await wait(step.type === 'newline' ? pacing.lineDelayMs : pacing.chunkDelayMs);
  }
  return summarize(plan, plan.length, signal.aborted && plan.length === 0 ? 'aborted' : 'done');
}
