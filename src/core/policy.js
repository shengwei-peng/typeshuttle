// Pre-send checks: whether to confirm, whether to suggest precise transfer, and whether the text exceeds the limit.
import { splitGraphemes } from './segment.js';

export function textStats(text) {
  if (text === '') return { lines: 0, chars: 0 };
  return {
    lines: text.split('\n').length,
    chars: splitGraphemes(text).filter((grapheme) => grapheme !== '\n').length,
  };
}

export function evaluateDirect(text, settings) {
  const stats = textStats(text);
  return {
    stats,
    empty: stats.chars === 0 && stats.lines <= 1,
    needsConfirm: stats.lines > 1 || stats.chars > settings.confirmCharThreshold,
    suggestPrecise: stats.chars > settings.suggestPreciseChars,
    exceedsLimit: stats.chars > settings.maxDirectChars,
  };
}

export function estimateDurationMs(plan, pacing) {
  return plan.reduce(
    (total, step) => total + (step.type === 'newline' ? pacing.lineDelayMs : pacing.chunkDelayMs),
    0,
  );
}
