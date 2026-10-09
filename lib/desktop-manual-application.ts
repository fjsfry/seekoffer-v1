import type { ManualProjectInput } from '@/lib/cloudbase-data';

export type ManualApplicationValidationResult =
  | { ok: true; value: ManualProjectInput }
  | { ok: false; field: keyof ManualProjectInput; message: string };

function normalizeDateTime(value: string | undefined) {
  return (value || '').trim().replace('T', ' ');
}

function parseDateTime(value: string) {
  if (!value) return null;
  const timestamp = new Date(value.replace(' ', 'T')).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizeHttpUrl(value: string | undefined) {
  const trimmed = (value || '').trim();
  if (!trimmed) return { ok: true as const, value: '' };

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return { ok: false as const };
    }
    return { ok: true as const, value: url.toString() };
  } catch {
    return { ok: false as const };
  }
}

export function validateManualApplicationInput(
  input: ManualProjectInput
): ManualApplicationValidationResult {
  const schoolName = input.schoolName.trim();
  if (!schoolName) {
    return { ok: false, field: 'schoolName', message: '请填写学校名称。' };
  }

  const projectName = input.projectName.trim();
  if (!projectName) {
    return { ok: false, field: 'projectName', message: '请填写项目名称。' };
  }

  const deadlineDate = normalizeDateTime(input.deadlineDate);
  const deadlineTimestamp = parseDateTime(deadlineDate);
  if (deadlineTimestamp === null) {
    return { ok: false, field: 'deadlineDate', message: '请选择有效的申请截止时间。' };
  }

  const eventStartDate = normalizeDateTime(input.eventStartDate);
  const eventEndDate = normalizeDateTime(input.eventEndDate);
  const eventStartTimestamp = parseDateTime(eventStartDate);
  const eventEndTimestamp = parseDateTime(eventEndDate);
  if (eventStartDate && eventStartTimestamp === null) {
    return { ok: false, field: 'eventStartDate', message: '请选择有效的活动开始时间。' };
  }
  if (eventEndDate && eventEndTimestamp === null) {
    return { ok: false, field: 'eventEndDate', message: '请选择有效的活动结束时间。' };
  }
  if (
    eventStartTimestamp !== null &&
    eventEndTimestamp !== null &&
    eventEndTimestamp < eventStartTimestamp
  ) {
    return { ok: false, field: 'eventEndDate', message: '活动结束时间不能早于开始时间。' };
  }

  const applyLink = normalizeHttpUrl(input.applyLink);
  if (!applyLink.ok) {
    return { ok: false, field: 'applyLink', message: '报名链接需要以 http:// 或 https:// 开头。' };
  }

  return {
    ok: true,
    value: {
      ...input,
      schoolName,
      departmentName: input.departmentName.trim(),
      projectName,
      discipline: input.discipline.trim(),
      deadlineDate,
      eventStartDate,
      eventEndDate,
      applyLink: applyLink.value
    }
  };
}
