// Turns text into typing steps. Citrix strips newlines from inserted text (docs/clients.md, F6), so lines are sent one by one with a newline key in between.
// Long lines are chunked on grapheme boundaries so emoji and combining sequences stay intact.

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export function splitGraphemes(text) {
  return Array.from(graphemeSegmenter.segment(text), ({ segment }) => segment);
}

export function chunkLine(line, maxChunk) {
  const graphemes = splitGraphemes(line);
  return Array.from({ length: Math.ceil(graphemes.length / maxChunk) }, (_, index) =>
    graphemes.slice(index * maxChunk, (index + 1) * maxChunk).join(''),
  );
}

function textSteps(segment, chunkSize) {
  return chunkLine(segment, chunkSize).map((value) => ({ type: 'text', value }));
}

function lineSteps(line, { chunkSize, sendTabKey }) {
  if (!sendTabKey) return textSteps(line, chunkSize);
  return line.split('\t').flatMap((segment, index) => [
    ...(index > 0 ? [{ type: 'tab' }] : []),
    ...textSteps(segment, chunkSize),
  ]);
}

export function buildTypingPlan(text, options) {
  if (text === '') return [];
  return text.split('\n').flatMap((line, index) => [
    ...(index > 0 ? [{ type: 'newline' }] : []),
    ...lineSteps(line, options),
  ]);
}

const STEP_TEXT = { newline: () => '\n', tab: () => '\t', text: (step) => step.value };

export function planToText(plan) {
  return plan.map((step) => STEP_TEXT[step.type](step)).join('');
}
