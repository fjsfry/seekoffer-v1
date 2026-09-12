import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAvailabilityFetch } from '@/lib/service-availability';
import { fetchPublicNoticesByIds } from '@/lib/public-notice-api';

afterEach(() => vi.unstubAllGlobals());
describe('service restriction and bounded ID batches', () => {
  it('stops repeated 402 requests while keeping a different service available', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response('{}', { status: 402 }));
    const fetcher = createAvailabilityFetch(upstream);
    expect((await fetcher('https://public.example/read')).status).toBe(402);
    await expect(fetcher('https://public.example/read')).rejects.toMatchObject({ status: 402 });
    expect(upstream).toHaveBeenCalledTimes(1);
    await fetcher('https://account.example/read');
    expect(upstream).toHaveBeenCalledTimes(2);
  });
  it('keeps 205 requested IDs in sequential batches, with no request for an empty list', async () => {
    const sizes: number[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      const { ids } = JSON.parse(options.body); sizes.push(ids.length);
      return Response.json({ items: ids.map((id: string) => ({ id })), source: 'supabase' });
    }));
    expect((await fetchPublicNoticesByIds([])).items).toEqual([]);
    const ids = Array.from({ length: 205 }, (_, i) => 'id-' + i);
    const result = await fetchPublicNoticesByIds([...ids, 'id-0']);
    expect(result.items.map(i => i.id)).toEqual(ids);
    expect(sizes).toEqual([100, 100, 5]);
  });
});
