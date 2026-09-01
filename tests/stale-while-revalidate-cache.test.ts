import { describe, expect, it, vi } from 'vitest';
import { createStaleWhileRevalidateCache } from '@/lib/stale-while-revalidate-cache';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

describe('stale-while-revalidate cache', () => {
  it('returns fallback immediately, then keeps a successful remote snapshot fresh for the TTL', async () => {
    let now = 1_000;
    const cache = createStaleWhileRevalidateCache({
      ttlMs: 300_000,
      retryAfterMs: 15_000,
      fallback: () => ['seed'],
      now: () => now
    });
    const fetcher = vi.fn(async () => ['remote']);

    expect(cache.getSnapshot()).toMatchObject({
      value: ['seed'],
      source: 'fallback',
      shouldRevalidate: true
    });
    await expect(cache.request(fetcher)).resolves.toMatchObject({
      value: ['remote'],
      source: 'remote',
      syncedAt: 1_000,
      isFresh: true,
      revalidated: true
    });

    now += 299_999;
    await cache.request(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);

    now += 1;
    await cache.request(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('deduplicates normal and forced consumers onto one in-flight request', async () => {
    const cache = createStaleWhileRevalidateCache({
      ttlMs: 300_000,
      retryAfterMs: 15_000,
      fallback: () => ['seed']
    });
    const response = deferred<string[]>();
    const fetcher = vi.fn(() => response.promise);

    const first = cache.request(fetcher);
    const forced = cache.request(fetcher, { force: true });
    const third = cache.request(fetcher);
    expect(first).toBe(forced);
    expect(first).toBe(third);
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(1);

    response.resolve(['remote']);
    await expect(Promise.all([first, forced, third])).resolves.toHaveLength(3);
  });

  it('keeps the last remote snapshot when a refresh fails', async () => {
    let now = 10_000;
    const cache = createStaleWhileRevalidateCache({
      ttlMs: 300_000,
      retryAfterMs: 15_000,
      fallback: () => ['seed'],
      now: () => now
    });
    await cache.request(async () => ['remote']);

    now += 1_000;
    const failure = new Error('offline');
    const result = await cache.request(async () => Promise.reject(failure), { force: true });
    expect(result).toMatchObject({
      value: ['remote'],
      source: 'stale',
      syncedAt: 10_000,
      error: failure,
      isFresh: false,
      shouldRevalidate: false
    });
  });

  it('throttles fallback retries without mistaking fallback for remote success', async () => {
    let now = 50_000;
    const cache = createStaleWhileRevalidateCache({
      ttlMs: 300_000,
      retryAfterMs: 15_000,
      fallback: () => ['seed'],
      now: () => now
    });
    const fetcher = vi.fn(async () => Promise.reject(new Error('offline')));

    const first = await cache.request(fetcher);
    expect(first).toMatchObject({ value: ['seed'], source: 'fallback', syncedAt: null });
    await cache.request(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);

    now += 15_000;
    await cache.request(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('accepts an empty remote array as an authoritative success', async () => {
    const cache = createStaleWhileRevalidateCache<string[]>({
      ttlMs: 300_000,
      retryAfterMs: 15_000,
      fallback: () => ['seed']
    });

    await expect(cache.request(async () => [])).resolves.toMatchObject({
      value: [],
      source: 'remote',
      isFresh: true
    });
  });

  it('rejects invalid cache durations', () => {
    expect(() => createStaleWhileRevalidateCache({
      ttlMs: 0,
      retryAfterMs: 15_000,
      fallback: () => []
    })).toThrow('ttlMs');
    expect(() => createStaleWhileRevalidateCache({
      ttlMs: 300_000,
      retryAfterMs: Number.NaN,
      fallback: () => []
    })).toThrow('retryAfterMs');
  });
});
