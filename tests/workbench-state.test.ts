import { describe, expect, it } from 'vitest';
import { mergeWorkbenchState, type WorkbenchState } from '../lib/workbench-state';

const emptyState: WorkbenchState = {
  completedTodoIds: [],
  customTodos: [],
  contacts: []
};

describe('workbench state merge', () => {
  it('keeps completed tasks from both local and cloud state', () => {
    const merged = mergeWorkbenchState(
      { ...emptyState, completedTodoIds: ['local-task'] },
      { completedTodoIds: ['cloud-task', 'local-task'] }
    );

    expect(merged.completedTodoIds.sort()).toEqual(['cloud-task', 'local-task']);
  });

  it('keeps the most recently edited local or cloud item', () => {
    const merged = mergeWorkbenchState(
      {
        ...emptyState,
        customTodos: [
          { id: 'todo-1', text: '本地新版本', updatedAt: '2026-07-11T02:00:00.000Z' }
        ]
      },
      {
        customTodos: [
          { id: 'todo-1', text: '云端旧版本', updatedAt: '2026-07-11T01:00:00.000Z' },
          { id: 'todo-2', text: '云端独有事项', updatedAt: '2026-07-11T01:30:00.000Z' }
        ]
      }
    );

    expect(merged.customTodos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'todo-1', text: '本地新版本' }),
        expect.objectContaining({ id: 'todo-2', text: '云端独有事项' })
      ])
    );
  });
});
