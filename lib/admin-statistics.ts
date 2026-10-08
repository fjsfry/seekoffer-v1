export function formatMetric(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('zh-CN').format(value)
    : '--';
}

export function isStatisticsFresh(generatedAt: string | null | undefined, intervalSeconds: number, now = Date.now()) {
  const timestamp = Date.parse(generatedAt || '');
  if (!Number.isFinite(timestamp) || timestamp > now + 60000 || now - timestamp >= (intervalSeconds + 60) * 1000) return false;
  const day = (value: number) => new Date(value + 28800000).toISOString().slice(0, 10);
  return day(timestamp) === day(now);
}
