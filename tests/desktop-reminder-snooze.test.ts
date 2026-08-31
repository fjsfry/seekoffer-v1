import { describe, expect, it } from 'vitest';
import { getReminderSnoozeOptions } from '@/lib/desktop-reminder-snooze';

describe('desktop reminder snooze presets', () => {
  it('builds predictable one-hour, evening, morning, and next-Monday targets', () => {
    const now = new Date('2026-08-13T06:30:00.000Z');
    const options = getReminderSnoozeOptions(now);

    expect(options.map((option) => option.id)).toEqual([
      'default-delay',
      'tonight',
      'tomorrow-morning',
      'next-monday'
    ]);
    expect(options[0].target.getTime()).toBe(now.getTime() + 60 * 60 * 1000);
    expect(options[1].label).toBe('今晚 20:00');
    expect(options[1].target.toISOString()).toBe('2026-08-13T12:00:00.000Z');
    expect(options[2].target.toISOString()).toBe('2026-08-14T01:00:00.000Z');
    expect(options[3].target.toISOString()).toBe('2026-08-17T01:00:00.000Z');
  });

  it('uses the configured default delay without changing the calendar presets', () => {
    const now = new Date('2026-08-13T06:30:00.000Z');
    const options = getReminderSnoozeOptions(now, 30);

    expect(options[0].label).toBe('30 分钟后');
    expect(options[0].target.toISOString()).toBe('2026-08-13T07:00:00.000Z');
    expect(options[1].target.toISOString()).toBe('2026-08-13T12:00:00.000Z');
  });

  it('never creates an already-expired evening target', () => {
    const now = new Date('2026-08-13T13:15:00.000Z');
    const evening = getReminderSnoozeOptions(now)[1];

    expect(evening.label).toBe('明晚 20:00');
    expect(evening.target.toISOString()).toBe('2026-08-14T12:00:00.000Z');
    expect(evening.target.getTime()).toBeGreaterThan(now.getTime());
  });

  it('always treats next Monday as the following week when opened on Monday', () => {
    const monday = new Date('2026-08-17T02:00:00.000Z');
    const nextMonday = getReminderSnoozeOptions(monday)[3].target;

    expect(nextMonday.toISOString()).toBe('2026-08-24T01:00:00.000Z');
  });
});
