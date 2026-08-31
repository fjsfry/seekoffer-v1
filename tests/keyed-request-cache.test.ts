import { describe, expect, it, vi } from 'vitest';
import { createKeyedRequestCache } from '@/lib/keyed-request-cache';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

describe('keyed request cache', () => {
  it('reuses an in-flight request and writes its result after the first consumer leaves', async () => {
    const coordinator = createKeyedRequestCache<string[]>(45_000);
    const response = deferred<string[]>();
    const fetcher = vi.fn(() => response.promise);

    const firstMountRequest = coordinator.request('user-a', fetcher);
    const remountRequest = coordinator.request('user-a', fetcher);

    expect(remountRequest).toBe(firstMountRequest);
    expect(fetcher).toHaveBeenCalledTimes(0);

    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('user-a');

    response.resolve(['application-a']);
    await expect(remountRequest).resolves.toEqual(['application-a']);
    expect(coordinator.get('user-a')?.value).toEqual(['application-a']);
    expect(coordinator.isFresh('user-a')).toBe(true);
  });

  it('keeps pending requests and cached values isolated by account', async () => {
    const coordinator = createKeyedRequestCache<string[]>(45_000);
    const userAResponse = deferred<string[]>();
    const userBResponse = deferred<string[]>();
    const fetchUserA = vi.fn(() => userAResponse.promise);
    const fetchUserB = vi.fn(() => userBResponse.promise);

    const userARequest = coordinator.request('user-a', fetchUserA);
    const userBRequest = coordinator.request('user-b', fetchUserB);
    await Promise.resolve();

    expect(fetchUserA).toHaveBeenCalledTimes(1);
    expect(fetchUserB).toHaveBeenCalledTimes(1);

    userBResponse.resolve(['application-b']);
    userAResponse.resolve(['application-a']);
    await Promise.all([userARequest, userBRequest]);

    expect(coordinator.get('user-a')?.value).toEqual(['application-a']);
    expect(coordinator.get('user-b')?.value).toEqual(['application-b']);
  });

  it('does not let an older request overwrite a newer forced refresh', async () => {
    const coordinator = createKeyedRequestCache<string[]>(45_000);
    const oldResponse = deferred<string[]>();
    const newResponse = deferred<string[]>();

    const oldRequest = coordinator.request('user-a', () => oldResponse.promise);
    const newRequest = coordinator.request('user-a', () => newResponse.promise, { force: true });
    await Promise.resolve();

    newResponse.resolve(['new']);
    await newRequest;
    oldResponse.resolve(['old']);
    await oldRequest;

    expect(coordinator.get('user-a')?.value).toEqual(['new']);
  });
});
