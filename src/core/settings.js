import { isSafeDir } from './precise.js';
import { UI_LANGUAGES } from './i18n.js';

export const SPEED_PRESETS = Object.freeze({
  fast: Object.freeze({ chunkSize: 100, chunkDelayMs: 40, lineDelayMs: 80 }),
  normal: Object.freeze({ chunkSize: 40, chunkDelayMs: 80, lineDelayMs: 150 }),
  safe: Object.freeze({ chunkSize: 20, chunkDelayMs: 100, lineDelayMs: 250 }),
});
const SPEED_ORDER = Object.freeze(['safe', 'normal', 'fast']);
const PRECISE_MAX_SPEED = 'normal';

export const DEFAULT_SETTINGS = Object.freeze({
  uiLanguage: 'auto',
  speed: 'normal',
  tabWidth: 4,
  newlineKey: 'enter',
  keepTrailingNewline: false,
  imeCommitEnter: false,
  confirmCharThreshold: 500,
  suggestPreciseChars: 2000,
  maxDirectChars: 50000,
  maxPreciseBytes: 1024 * 1024,
  preciseDir: '~/typeshuttle-inbox',
});

const oneOf = (allowed) => (value) => allowed.includes(value);
const integerBetween = (min, max) => (value) => Number.isInteger(value) && value >= min && value <= max;
const isBoolean = (value) => typeof value === 'boolean';

const VALIDATORS = Object.freeze({
  uiLanguage: oneOf(UI_LANGUAGES),
  speed: oneOf(Object.keys(SPEED_PRESETS)),
  tabWidth: integerBetween(1, 8),
  newlineKey: oneOf(['enter', 'shift-enter']),
  keepTrailingNewline: isBoolean,
  imeCommitEnter: isBoolean,
  confirmCharThreshold: integerBetween(0, 1_000_000),
  suggestPreciseChars: integerBetween(0, 1_000_000),
  maxDirectChars: integerBetween(1, 1_000_000),
  maxPreciseBytes: integerBetween(1, 20 * 1024 * 1024),
  preciseDir: isSafeDir,
});

export function sanitizeSettings(raw) {
  const source = raw ?? {};
  return Object.fromEntries(
    Object.entries(DEFAULT_SETTINGS).map(([key, fallback]) => [
      key,
      VALIDATORS[key](source[key]) ? source[key] : fallback,
    ]),
  );
}

export function pacingFor(speed) {
  return SPEED_PRESETS[speed] ?? SPEED_PRESETS.normal;
}

export function precisePacingFor(speed) {
  const index = SPEED_ORDER.indexOf(speed);
  const capped = index === -1 || index > SPEED_ORDER.indexOf(PRECISE_MAX_SPEED) ? PRECISE_MAX_SPEED : speed;
  return SPEED_PRESETS[capped];
}
