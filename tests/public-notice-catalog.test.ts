import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'eq', 'is', 'order']) {
    query[method] = vi.fn(() => query);
  }
  query.range = vi.fn();
  query.maybeSingle = vi.fn();

  return {
    query,
    createClient: vi.fn(() => ({
      from: vi.fn(() => query)
    }))
  };
});

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
  unstable_cache: (loader: (...args: unknown[]) => unknown) => loader
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient
}));

import {
  getCachedNoticeById,
  getPublicNoticeCatalog
} from '@/lib/server/public-notice-catalog';

describe('cached public notice catalog', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-anon-key');
    mocks.createClient.mockClear();
    Object.values(mocks.query).forEach((mock) => mock.mockClear());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('treats a successful empty remote catalog as authoritative', async () => {
    mocks.query.range.mockResolvedValueOnce({ data: [], error: null });

    const result = await getPublicNoticeCatalog();

    expect(result).toEqual({ items: [], source: 'supabase' });
    expect(mocks.query.select).toHaveBeenCalledTimes(1);
    expect(mocks.query.range).toHaveBeenCalledWith(0, 499);
  });

  it('splits the shared catalog into bounded cache pages', async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({
      id: `notice-${index}`,
      school_name: '北京大学',
      department_name: '计算机学院',
      project_name: `2026年推免通知 ${index}`,
      project_type: '预推免',
      discipline: '计算机科学与技术',
      publish_date: '2026-09-02',
      deadline_date: '2026-09-20',
      source_link: `https://example.com/${index}`,
      year: 2026
    }));
    mocks.query.range
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const result = await getPublicNoticeCatalog();

    expect(result.source).toBe('supabase');
    expect(result.items).toHaveLength(500);
    expect(mocks.query.range).toHaveBeenNthCalledWith(1, 0, 499);
    expect(mocks.query.range).toHaveBeenNthCalledWith(2, 500, 999);
  });

  it('uses the bundled catalog only when the remote query fails', async () => {
    mocks.query.range.mockResolvedValueOnce({
      data: null,
      error: new Error('temporary upstream failure')
    });

    const result = await getPublicNoticeCatalog();

    expect(result.source).toBe('bundled');
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('supports a fail-safe rollout switch without restoring browser Supabase reads', async () => {
    vi.stubEnv('NEXT_PUBLIC_NOTICE_API_V2', 'false');

    const result = await getPublicNoticeCatalog();

    expect(result.source).toBe('bundled');
    expect(result.items.length).toBeGreaterThan(0);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('does not resurrect a bundled detail after an authoritative remote miss', async () => {
    mocks.query.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(getCachedNoticeById('baoyantongzhi-127479')).resolves.toBeNull();
    expect(mocks.query.eq).toHaveBeenCalledWith('id', 'baoyantongzhi-127479');
  });
});
