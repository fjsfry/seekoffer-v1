import { describe, expect, it } from 'vitest';
import {
  getChangeReminderCopy,
  getLatestActionableChange
} from '@/lib/desktop-reminder-copy';

describe('desktop reminder change classification', () => {
  it('recognizes the real standalone Chinese status field as an application status change', () => {
    expect(getChangeReminderCopy('状态', '由报名中变更为材料审核')).toEqual({
      fieldLabel: '申请状态',
      detail: '项目状态已更新，请确认下一步安排。'
    });
  });

  it.each([
    ['duplicate_merge', 'merged records'],
    ['通知内容', '合并重复通知']
  ])('suppresses internal duplicate processing: %s', (field, change) => {
    expect(getChangeReminderCopy(field, change)).toBeNull();
  });

  it('does not surface an unknown field as a notification', () => {
    expect(getChangeReminderCopy('备注', '编辑了说明文字')).toBeNull();
  });

  it('skips a newer internal record and returns the earlier actionable change', () => {
    const result = getLatestActionableChange([
      {
        field: '状态',
        change: '由报名中变更为材料审核',
        date: '2026-08-08T09:30:00+08:00'
      },
      {
        field: 'duplicate_merge',
        change: '合并重复通知',
        date: '2026-08-09T16:15:00+08:00'
      }
    ]);

    expect(result?.entry.field).toBe('状态');
    expect(result?.copy.fieldLabel).toBe('申请状态');
  });
});
