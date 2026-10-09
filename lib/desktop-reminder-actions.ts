export type DesktopReminderReadState = {
  readIds: string[];
  snoozedUntil: Record<string, string>;
};

export type MarkAllReadSnapshot = {
  reminderIds: string[];
  previousReadIds: string[];
  previousSnoozedUntil: Record<string, string>;
};

export function markReminderIdsRead(
  current: DesktopReminderReadState,
  reminderIds: string[]
) {
  const uniqueReminderIds = Array.from(new Set(reminderIds));
  const reminderIdSet = new Set(uniqueReminderIds);
  const snapshot: MarkAllReadSnapshot = {
    reminderIds: uniqueReminderIds,
    previousReadIds: current.readIds.filter((id) => reminderIdSet.has(id)),
    previousSnoozedUntil: Object.fromEntries(
      Object.entries(current.snoozedUntil).filter(([id]) => reminderIdSet.has(id))
    )
  };

  return {
    snapshot,
    state: {
      readIds: Array.from(new Set([...current.readIds, ...uniqueReminderIds])),
      snoozedUntil: Object.fromEntries(
        Object.entries(current.snoozedUntil).filter(([id]) => !reminderIdSet.has(id))
      )
    } satisfies DesktopReminderReadState
  };
}

export function restoreMarkedReminderIds(
  current: DesktopReminderReadState,
  snapshot: MarkAllReadSnapshot
): DesktopReminderReadState {
  const reminderIdSet = new Set(snapshot.reminderIds);
  return {
    readIds: Array.from(
      new Set([
        ...current.readIds.filter((id) => !reminderIdSet.has(id)),
        ...snapshot.previousReadIds
      ])
    ),
    snoozedUntil: {
      ...Object.fromEntries(
        Object.entries(current.snoozedUntil).filter(([id]) => !reminderIdSet.has(id))
      ),
      ...snapshot.previousSnoozedUntil
    }
  };
}
