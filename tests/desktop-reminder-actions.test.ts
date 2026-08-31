import { describe, expect, it } from 'vitest';
import {
  markReminderIdsRead,
  restoreMarkedReminderIds
} from '@/lib/desktop-reminder-actions';

describe('desktop reminder bulk-read undo', () => {
  it('marks only the requested reminders and snapshots their previous state', () => {
    const transition = markReminderIdsRead(
      {
        readIds: ['already-read', 'outside'],
        snoozedUntil: {
          snoozed: '2026-08-14T01:00:00.000Z',
          outside: '2026-08-15T01:00:00.000Z'
        }
      },
      ['already-read', 'snoozed', 'new', 'new']
    );

    expect(transition.state.readIds).toEqual([
      'already-read',
      'outside',
      'snoozed',
      'new'
    ]);
    expect(transition.state.snoozedUntil).toEqual({
      outside: '2026-08-15T01:00:00.000Z'
    });
    expect(transition.snapshot).toEqual({
      reminderIds: ['already-read', 'snoozed', 'new'],
      previousReadIds: ['already-read'],
      previousSnoozedUntil: {
        snoozed: '2026-08-14T01:00:00.000Z'
      }
    });
  });

  it('restores affected reminders without overwriting unrelated later changes', () => {
    const initial = {
      readIds: ['already-read', 'outside'],
      snoozedUntil: { snoozed: '2026-08-14T01:00:00.000Z' }
    };
    const transition = markReminderIdsRead(initial, ['already-read', 'snoozed', 'new']);
    const restored = restoreMarkedReminderIds(
      {
        readIds: [...transition.state.readIds, 'later-read'],
        snoozedUntil: {
          ...transition.state.snoozedUntil,
          'later-snooze': '2026-08-20T01:00:00.000Z'
        }
      },
      transition.snapshot
    );

    expect(restored.readIds).toEqual(['outside', 'later-read', 'already-read']);
    expect(restored.snoozedUntil).toEqual({
      'later-snooze': '2026-08-20T01:00:00.000Z',
      snoozed: '2026-08-14T01:00:00.000Z'
    });
  });
});
