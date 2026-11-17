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

const NON_ASCII = /[^\x00-\x7f]/;

function newlineSteps(previousLine, { imeCommitEnter }) {
  return imeCommitEnter && NON_ASCII.test(previousLine) ? [{ type: 'imeCommit' }, { type: 'newline' }] : [{ type: 'newline' }];
}

export function withLeadingImeCommit(plan) {
  return plan[0]?.type === 'newline' ? [{ type: 'imeCommit' }, ...plan] : plan;
}

export function hasNonAscii(text) {
  return NON_ASCII.test(text);
}

export function buildTypingPlan(text, options) {
  if (text === '') return [];
  const lines = text.split('\n');
  return lines.flatMap((line, index) => [
    ...(index > 0 ? newlineSteps(lines[index - 1], options) : []),
    ...lineSteps(line, options),
  ]);
}

export function isLineBreakStep(step) {
  return step.type === 'newline' || step.type === 'imeCommit';
}

const STEP_TEXT = { newline: () => '\n', imeCommit: () => '', tab: () => '\t', text: (step) => step.value };

export function planToText(plan) {
  return plan.map((step) => STEP_TEXT[step.type](step)).join('');
}
