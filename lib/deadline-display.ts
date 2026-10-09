import type { DeadlineLevel, PublicProjectStatus } from './mock-data';

const DAY_MS = 1000 * 60 * 60 * 24;

function normalizeDeadlineInput(value: string | undefined | null) {
  const text = String(value || '').trim();
  if (!text) return '';

  const normalized = text.replace(/\//g, '-').replace(' ', 'T');
  const withTime = /^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized) ? `${normalized}T23:59` : normalized;
  const withSeconds = /T\d{1,2}:\d{2}:\d{2}/.test(withTime) ? withTime : withTime.replace(/T(\d{1,2}:\d{2})$/, 'T$1:00');

  return /([zZ]|[+-]\d{2}:\d{2})$/.test(withSeconds) ? withSeconds : `${withSeconds}+08:00`;
}

export function getDeadlineTimestamp(value: string | undefined | null) {
  const normalized = normalizeDeadlineInput(value);
  if (!normalized) return Number.MAX_SAFE_INTEGER;

  const timestamp = new Date(normalized).getTime();
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

export function getDeadlineLevelFromDate(value: string | undefined | null, now = Date.now()): DeadlineLevel {
  const timestamp = getDeadlineTimestamp(value);
  if (timestamp === Number.MAX_SAFE_INTEGER) return 'future';

  const diff = timestamp - now;
  if (diff <= 0) return 'expired';
  if (diff <= DAY_MS) return 'today';
  if (diff <= DAY_MS * 3) return 'within3days';
  if (diff <= DAY_MS * 7) return 'within7days';
  return 'future';
}

export function getDaysUntilDeadline(value: string | undefined | null, now = Date.now()) {
  const timestamp = getDeadlineTimestamp(value);
  if (timestamp === Number.MAX_SAFE_INTEGER) return null;

  const diff = timestamp - now;
  if (diff <= 0) return 0;

  return Math.ceil(diff / DAY_MS);
}

export function getDeadlineDistanceLabel(value: string | undefined | null, now = Date.now()) {
  const timestamp = getDeadlineTimestamp(value);
  if (timestamp === Number.MAX_SAFE_INTEGER) return '时间待补充';

  const diff = timestamp - now;
  if (diff <= 0) return '已截止';
  if (diff <= DAY_MS) return '24小时内截止';

  const days = Math.ceil(diff / DAY_MS);
  return `剩余 ${days} 天`;
}

export function getCountdownLabel(value: string | undefined | null, now = Date.now()) {
  const timestamp = getDeadlineTimestamp(value);
  if (timestamp === Number.MAX_SAFE_INTEGER) return '截止时间待补充';

  const diff = timestamp - now;
  if (diff <= 0) return '项目已截止';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 24) return `距截止约 ${Math.max(hours, 1)} 小时`;

  return `距截止约 ${Math.ceil(diff / DAY_MS)} 天`;
}

export function getPublicStatusForDeadlineLevel(level: DeadlineLevel): PublicProjectStatus {
  if (level === 'expired') return '已截止';
  if (level === 'today' || level === 'within3days' || level === 'within7days') return '即将截止';
  return '报名中';
}

export function getDeadlineBadgeMeta(level?: DeadlineLevel | null) {
  switch (level) {
    case 'today':
      return {
        label: '24小时内截止',
        tone: 'danger' as const
      };
    case 'within3days':
      return {
        label: '3天内截止',
        tone: 'warning' as const
      };
    case 'within7days':
      return {
        label: '7天内截止',
        tone: 'info' as const
      };
    case 'expired':
      return {
        label: '已截止',
        tone: 'muted' as const
      };
    case 'future':
    default:
      return {
        label: '可跟进',
        tone: 'success' as const
      };
  }
}
