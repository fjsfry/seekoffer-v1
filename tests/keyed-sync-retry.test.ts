import { afterEach, describe, expect, it, vi } from 'vitest';
import { createKeyedSyncRetryCoordinator } from '@/lib/keyed-sync-retry';

afterEach(() => {
  vi.useRealTimers();
});

describe('keyed background sync retry coordinator', () => {
  it('keeps one request in flight and rereads the durable source after a newer write', async () => {
    vi.useFakeTimers();
    const resolvers: Array<() => void> = [];
    const execute = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvers.push(resolve);
        })
    );
    const onSuccess = vi.fn();
    const coordinator = createKeyedSyncRetryCoordinator({
      execute,
      isEligible: (key) => key === 'member-a',
      onSuccess,
      retryDelaysMs: [10]
    });

    coordinator.request('member-a');
    await vi.advanceTimersByTimeAsync(0);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(coordinator.getState('member-a')?.inFlight).toBe(true);

    coordinator.request('member-a');
    expect(execute).toHaveBeenCalledTimes(1);

    resolvers[0]();
    await vi.advanceTimersByTimeAsync(0);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(onSuccess).not.toHaveBeenCalled();

    resolvers[1]();
    await vi.runAllTimersAsync();
    expect(coordinator.getState('member-a')).toBeNull();
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('uses a finite retry schedule and lets an online event start a fresh cycle', async () => {
    vi.useFakeTimers();
    const execute = vi.fn().mockRejectedValue(new Error('offline'));
    const coordinator = createKeyedSyncRetryCoordinator({
      execute,
      isEligible: () => true,
      retryDelaysMs: [10, 20]
    });

    coordinator.request('member-a');
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(20);

    expect(execute).toHaveBeenCalledTimes(3);
    expect(coordinator.getState('member-a')).toMatchObject({
      attempt: 3,
      exhausted: true,
      inFlight: false,
      timerScheduled: false
    });

    coordinator.notifyOnline();
    await vi.advanceTimersByTimeAsync(0);
    expect(execute).toHaveBeenCalledTimes(4);
    expect(coordinator.getState('member-a')).toMatchObject({
      attempt: 1,
      exhausted: false,
      timerScheduled: true
    });
  });

  it('can keep a low-frequency recovery timer after the responsive retries are exhausted', async () => {
    vi.useFakeTimers();
    const execute = vi.fn().mockRejectedValue(new Error('service unavailable'));
    const coordinator = createKeyedSyncRetryCoordinator({
      execute,
      isEligible: () => true,
      retryDelaysMs: [10],
      exhaustedRetryDelayMs: 600
    });

    coordinator.request('member-a');
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(10);

    expect(execute).toHaveBeenCalledTimes(2);
    expect(coordinator.getState('member-a')).toMatchObject({
      exhausted: true,
      timerScheduled: true
    });

    await vi.advanceTimersByTimeAsync(600);
    expect(execute).toHaveBeenCalledTimes(3);
    expect(coordinator.getState('member-a')).toMatchObject({
      exhausted: false,
      timerScheduled: true
    });
  });

  it('drops pending work when its account is no longer active', async () => {
    vi.useFakeTimers();
    let activeUserId = 'member-a';
    const execute = vi.fn().mockRejectedValue(new Error('offline'));
    const coordinator = createKeyedSyncRetryCoordinator({
      execute,
      isEligible: (key) => key === activeUserId,
      retryDelaysMs: [10]
    });

    coordinator.request('member-a');
    await vi.advanceTimersByTimeAsync(0);
    expect(execute).toHaveBeenCalledOnce();

    activeUserId = 'member-b';
    await vi.advanceTimersByTimeAsync(10);
    expect(execute).toHaveBeenCalledOnce();
    expect(coordinator.getState('member-a')).toBeNull();
  });
});
