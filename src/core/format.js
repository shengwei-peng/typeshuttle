const numberFormat = new Intl.NumberFormat('en-US');

export function formatCount(value) {
  return numberFormat.format(value);
}

export function formatDuration(ms, t) {
  if (ms < 1000) return t('durationUnderSecond');
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return t('durationSeconds', { seconds });
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? t('durationMinutes', { minutes }) : t('durationMinutesSeconds', { minutes, seconds: rest });
}

export function formatEstimate(ms, t) {
  return ms < 1000 ? t('durationUnderSecond') : t('aboutDuration', { duration: formatDuration(ms, t) });
}

export function formatStats({ lines, chars, durationMs }, t) {
  const parts = [t('lineCount', { count: formatCount(lines) }), t('charCount', { count: formatCount(chars) })];
  if (durationMs !== undefined) parts.push(formatEstimate(durationMs, t));
  return parts.join(' · ');
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
