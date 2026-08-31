import { describe, expect, it } from 'vitest';
import {
  createWorkbenchSaveCoordinator,
  mergeWorkbenchState,
  type WorkbenchMentorContact,
  type WorkbenchState
} from '../lib/workbench-state';

const emptyState: WorkbenchState = {
  completedTodoIds: [],
  customTodos: [],
  contacts: []
};

function createContact(
  patch: Partial<WorkbenchMentorContact> = {}
): WorkbenchMentorContact {
  return {
    id: 'contact-1',
    schoolName: '清华大学',
    departmentName: '计算机系',
    mentorName: '王老师',
    mentorTitle: '教授',
    schoolRange: 'C9',
    email: 'mentor@example.com',
    researchDirection: '人工智能',
    homepage: '',
    photoCacheKey: '',
    photoSourceUrl: '',
    photoPageUrl: '',
    photoUpdatedAt: '',
    deliveryStatus: '未投递',
    feedbackStatus: '未联系',
    contactChannel: '邮件',
    lastContactDate: '',
    nextFollowUpDate: '',
    contactNotes: '',
    notes: '',
    privacyNotice: '仅用于个人申请跟进。',
    updatedAt: '2026-08-02T07:00:00.000Z',
    ...patch
  };
}

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

  it('preserves schedule category and priority while merging and defaults legacy records', () => {
    const merged = mergeWorkbenchState(
      {
        ...emptyState,
        customTodos: [
          {
            id: 'todo-1',
            text: '完成课程作业',
            category: '作业',
            priority: '重要且紧急',
            updatedAt: '2026-08-02T08:00:00.000Z'
          }
        ]
      },
      {
        customTodos: [
          {
            id: 'todo-1',
            text: '完成课程作业',
            category: '学习',
            priority: '重要不紧急',
            updatedAt: '2026-08-02T07:00:00.000Z'
          },
          {
            id: 'todo-legacy',
            text: '旧版申请事项',
            updatedAt: '2026-08-01T07:00:00.000Z'
          }
        ]
      }
    );

    expect(merged.customTodos).toContainEqual(
      expect.objectContaining({
        id: 'todo-1',
        category: '作业',
        priority: '重要且紧急'
      })
    );
    expect(merged.customTodos).toContainEqual(
      expect.objectContaining({
        id: 'todo-legacy',
        category: '申请',
        priority: '重要不紧急'
      })
    );
  });

  it('lets a newer explicit incomplete state override a legacy completed union', () => {
    const merged = mergeWorkbenchState(
      {
        ...emptyState,
        completedTodoIds: [],
        customTodos: [
          {
            id: 'todo-1',
            text: '准备推荐信',
            completed: false,
            updatedAt: '2026-08-02T08:00:00.000Z'
          }
        ]
      },
      {
        completedTodoIds: ['todo-1'],
        customTodos: [
          {
            id: 'todo-1',
            text: '准备推荐信',
            completed: true,
            updatedAt: '2026-08-02T07:00:00.000Z'
          }
        ]
      }
    );

    expect(merged.completedTodoIds).not.toContain('todo-1');
    expect(merged.customTodos).toContainEqual(
      expect.objectContaining({ id: 'todo-1', completed: false })
    );
  });

  it('keeps a newer deletion tombstone so another device cannot resurrect an item', () => {
    const merged = mergeWorkbenchState(
      {
        ...emptyState,
        customTodos: [
          {
            id: 'todo-1',
            text: '已删除事项',
            deletedAt: '2026-08-02T08:00:00.000Z',
            updatedAt: '2026-08-02T08:00:00.000Z'
          }
        ]
      },
      {
        customTodos: [
          {
            id: 'todo-1',
            text: '旧设备上的事项',
            updatedAt: '2026-08-02T07:00:00.000Z'
          }
        ]
      }
    );

    expect(merged.customTodos).toContainEqual(
      expect.objectContaining({
        id: 'todo-1',
        deletedAt: '2026-08-02T08:00:00.000Z'
      })
    );
  });

  it('keeps a contact deletion tombstone even when a stale device edits its live copy later', () => {
    const merged = mergeWorkbenchState(
      {
        ...emptyState,
        contacts: [
          createContact({
            deletedAt: '2026-08-02T08:00:00.000Z',
            updatedAt: '2026-08-02T08:00:00.000Z'
          })
        ]
      },
      {
        contacts: [
          createContact({
            mentorName: '旧设备编辑的名字',
            updatedAt: '2026-08-02T09:00:00.000Z'
          })
        ]
      }
    );

    expect(merged.contacts).toContainEqual(
      expect.objectContaining({
        id: 'contact-1',
        deletedAt: '2026-08-02T08:00:00.000Z'
      })
    );
  });

  it('keeps a remote contact tombstone over a newer local live copy', () => {
    const merged = mergeWorkbenchState(
      {
        ...emptyState,
        contacts: [createContact({ updatedAt: '2026-08-02T09:00:00.000Z' })]
      },
      {
        contacts: [
          createContact({
            deletedAt: '2026-08-02T08:00:00.000Z',
            updatedAt: '2026-08-02T08:00:00.000Z'
          })
        ]
      }
    );

    expect(merged.contacts[0]).toEqual(
      expect.objectContaining({ deletedAt: '2026-08-02T08:00:00.000Z' })
    );
  });
  it('preserves validated mentor photo metadata through the JSONB merge path', () => {
    const photoCacheKey = `${'a'.repeat(64)}.jpg`;
    const merged = mergeWorkbenchState(
      {
        ...emptyState,
        contacts: [createContact({
          photoCacheKey,
          photoSourceUrl: 'https://faculty.example.edu/images/mentor.jpg',
          photoPageUrl: 'https://faculty.example.edu/mentor',
          photoUpdatedAt: '2026-08-24T02:00:00.000Z',
          updatedAt: '2026-08-24T02:00:00.000Z'
        })]
      },
      { contacts: [] }
    );

    expect(merged.contacts[0]).toEqual(expect.objectContaining({
      photoCacheKey,
      photoSourceUrl: 'https://faculty.example.edu/images/mentor.jpg',
      photoPageUrl: 'https://faculty.example.edu/mentor',
      photoUpdatedAt: '2026-08-24T02:00:00.000Z'
    }));
  });

  it('clears unsafe or malformed mentor photo metadata while hydrating JSON', () => {
    const merged = mergeWorkbenchState(
      { ...emptyState, contacts: [] },
      {
        contacts: [createContact({
          photoCacheKey: '../mentor.jpg',
          photoSourceUrl: 'javascript:alert(1)',
          photoPageUrl: 'data:text/html,unsafe',
          updatedAt: '2026-08-24T02:00:00.000Z'
        })]
      }
    );

    expect(merged.contacts[0]).toEqual(expect.objectContaining({
      photoCacheKey: '',
      photoSourceUrl: '',
      photoPageUrl: ''
    }));
  });
});

describe('workbench save coordinator', () => {
  it('serializes writes and only marks the latest revision as current', async () => {
    const writes: string[] = [];
    let releaseFirstWrite: (() => void) | undefined;
    const firstWriteGate = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    const coordinator = createWorkbenchSaveCoordinator(async (_userId, state) => {
      const text = state.customTodos[0]?.text || '';
      writes.push(text);
      if (text === '旧编辑') {
        await firstWriteGate;
      }
    });

    const first = coordinator.enqueue('user-1', {
      ...emptyState,
      customTodos: [{ id: 'todo-1', text: '旧编辑' }]
    });
    const second = coordinator.enqueue('user-1', {
      ...emptyState,
      customTodos: [{ id: 'todo-1', text: '新编辑' }]
    });

    await Promise.resolve();
    expect(writes).toEqual(['旧编辑']);
    releaseFirstWrite?.();

    await expect(first).resolves.toMatchObject({ ok: true, isLatest: false, revision: 1 });
    await expect(second).resolves.toMatchObject({ ok: true, isLatest: true, revision: 2 });
    expect(writes).toEqual(['旧编辑', '新编辑']);
  });

  it('continues with the newest write after an earlier request fails', async () => {
    const writes: string[] = [];
    const coordinator = createWorkbenchSaveCoordinator(async (_userId, state) => {
      const text = state.customTodos[0]?.text || '';
      writes.push(text);
      if (text === '会失败') {
        throw new Error('network unavailable');
      }
    });

    const first = coordinator.enqueue('user-1', {
      ...emptyState,
      customTodos: [{ id: 'todo-1', text: '会失败' }]
    });
    const second = coordinator.enqueue('user-1', {
      ...emptyState,
      customTodos: [{ id: 'todo-1', text: '最新编辑' }]
    });

    await expect(first).resolves.toMatchObject({ ok: false, isLatest: false });
    await expect(second).resolves.toMatchObject({ ok: true, isLatest: true });
    expect(writes).toEqual(['会失败', '最新编辑']);
  });
});
