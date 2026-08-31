import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  quota: (() => Promise.resolve({ allowed: true, freeLimit: 5 })) as (
    currentCount: number
  ) => Promise<{ allowed: boolean; freeLimit: number }>,
  session: null as Record<string, unknown> | null,
  upsertTables: [] as string[]
}));

vi.mock('@/lib/billing-api', () => ({
  canCreateMoreApplications: (currentCount: number) => mocked.quota(currentCount)
}));

vi.mock('@/lib/user-session', () => ({
  getUserSession: () => mocked.session,
  updateUserProfile: vi.fn()
}));

vi.mock('@/lib/supabase-browser', () => ({
  getSupabaseBrowserClient: () => ({
    from: (table: string) => ({
      upsert: async () => {
        mocked.upsertTables.push(table);
        return { error: null };
      }
    })
  })
}));

import { createManualApplicationEntry } from '@/lib/cloudbase-data';

type MemoryStorage = Storage & {
  failNextSetFor: (keyFragment: string) => void;
  snapshot: () => Map<string, string>;
};

function createMemoryStorage(): MemoryStorage {
  const values = new Map<string, string>();
  let failureFragment = '';

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    failNextSetFor(keyFragment: string) {
      failureFragment = keyFragment;
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      if (failureFragment && key.includes(failureFragment)) {
        failureFragment = '';
        throw new Error('storage quota exceeded');
      }
      values.set(key, value);
    },
    snapshot() {
      return new Map(values);
    }
  };
}

function memberSession(userId: string) {
  return {
    loggedIn: true,
    authProvider: 'email',
    userId,
    profile: {}
  };
}

const input = {
  schoolName: '清华大学',
  departmentName: '计算机系',
  projectName: '2027 年预推免',
  projectType: '预推免' as const,
  discipline: '人工智能',
  deadlineDate: '2026-09-01 18:00'
};

beforeEach(() => {
  vi.useFakeTimers();
  mocked.quota = () => Promise.resolve({ allowed: true, freeLimit: 5 });
  mocked.session = memberSession(`member-${Math.random()}`);
  mocked.upsertTables.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('manual application local-first persistence', () => {
  it('returns after the scoped local transaction without waiting for Supabase', async () => {
    const storage = createMemoryStorage();
    const dispatched: string[] = [];
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      dispatchEvent: (event: Event) => {
        dispatched.push(event.type);
        return true;
      },
      localStorage: storage
    });

    const userId = String(mocked.session?.userId);
    const result = await createManualApplicationEntry(input, userId);

    expect(result).toMatchObject({
      ownerUserId: userId,
      synced: false,
      syncPending: true
    });
    expect(mocked.upsertTables).toEqual([]);
    expect(dispatched).toEqual(['seekoffer-applications-updated']);

    const keys = Array.from(storage.snapshot().keys());
    expect(keys).toContain(`seekoffer-manual-projects:${userId}`);
    expect(keys).toContain(`seekoffer-my-application-table:${userId}`);
  });

  it('revalidates the member after quota resolves and never writes across accounts', async () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      localStorage: storage
    });

    let resolveQuota!: (value: { allowed: boolean; freeLimit: number }) => void;
    mocked.quota = () =>
      new Promise((resolve) => {
        resolveQuota = resolve;
      });
    mocked.session = memberSession('member-a');

    const pending = createManualApplicationEntry(input, 'member-a');
    mocked.session = memberSession('member-b');
    resolveQuota({ allowed: true, freeLimit: 5 });

    await expect(pending).rejects.toThrow('登录账号已发生变化');
    expect(storage.snapshot().size).toBe(0);
    expect(mocked.upsertTables).toEqual([]);
  });

  it('restores both exact local payloads when the second storage write fails', async () => {
    const storage = createMemoryStorage();
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      dispatchEvent,
      localStorage: storage
    });
    mocked.session = memberSession('member-rollback');
    const owner = { kind: 'member', userId: 'member-rollback' } as const;
    storage.setItem(
      'seekoffer-manual-projects:member-rollback',
      JSON.stringify({ version: 2, owner, updatedAt: 'previous-manual', items: [] })
    );
    storage.setItem(
      'seekoffer-my-application-table:member-rollback',
      JSON.stringify({ version: 2, owner, updatedAt: 'previous-records', items: [] })
    );
    const before = storage.snapshot();
    storage.failNextSetFor('seekoffer-my-application-table:member-rollback');

    await expect(
      createManualApplicationEntry(input, 'member-rollback')
    ).rejects.toThrow('storage quota exceeded');

    expect(storage.snapshot()).toEqual(before);
    expect(dispatchEvent).not.toHaveBeenCalled();
    expect(mocked.upsertTables).toEqual([]);
  });
});
