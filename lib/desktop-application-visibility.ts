import { getDeadlineTimestamp } from './deadline-display';

const missingDeadlineTimestamp = Number.MAX_SAFE_INTEGER;
const strictDeadlinePattern = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?([zZ]|[+-]\d{2}:\d{2})?)?$/;

export type DesktopApplicationDeadlineValue = string | null | undefined;

export function isStrictDesktopApplicationDeadline(
  deadlineDate: DesktopApplicationDeadlineValue
) {
  const match = String(deadlineDate || '').trim().match(strictDeadlinePattern);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = match[4] === undefined ? 0 : Number(match[4]);
  const minute = match[5] === undefined ? 0 : Number(match[5]);
  const second = match[6] === undefined ? 0 : Number(match[6]);
  const timezone = match[8] || '';

  if (year < 1 || month < 1 || month > 12) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day < 1 || day > daysInMonth) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;

  if (timezone && !/^[zZ]$/.test(timezone)) {
    const timezoneMatch = timezone.match(/^[+-](\d{2}):(\d{2})$/);
    if (
      !timezoneMatch ||
      Number(timezoneMatch[1]) > 23 ||
      Number(timezoneMatch[2]) > 59
    ) {
      return false;
    }
  }

  return true;
}

export function isDesktopApplicationExpired(
  deadlineDate: DesktopApplicationDeadlineValue,
  now = Date.now()
) {
  if (!isStrictDesktopApplicationDeadline(deadlineDate)) return false;
  const deadlineTimestamp = getDeadlineTimestamp(deadlineDate);
  return deadlineTimestamp !== missingDeadlineTimestamp && deadlineTimestamp <= now;
}

export function getDesktopExpiredApplicationCount<T>(
  rows: readonly T[],
  getDeadlineDate: (row: T) => DesktopApplicationDeadlineValue,
  now = Date.now()
) {
  return rows.reduce(
    (count, row) => count + (isDesktopApplicationExpired(getDeadlineDate(row), now) ? 1 : 0),
    0
  );
}

export function filterDesktopExpiredApplications<T>(
  rows: readonly T[],
  hideExpired: boolean,
  getDeadlineDate: (row: T) => DesktopApplicationDeadlineValue,
  now = Date.now()
) {
  if (!hideExpired) return [...rows];
  return rows.filter((row) => !isDesktopApplicationExpired(getDeadlineDate(row), now));
}

export function getNextVisibleDesktopApplicationId<T>(
  rows: readonly T[],
  selectedId: string,
  getId: (row: T) => string
) {
  if (!rows.length) return '';
  return rows.some((row) => getId(row) === selectedId) ? selectedId : getId(rows[0]);
}
