import { describe, expect, it } from 'vitest';
import {
  databaseRetryDelayMs,
  isTransientDatabaseError,
  retryDatabaseOperation
} from '../supabase/functions/ingest-notices/database-retry';

describe('database retry policy', () => {
  it('recognizes temporary PostgREST and connection failures', () => {
    expect(isTransientDatabaseError({ code: 'PGRST000', message: 'Database connection failed' })).toBe(true);
    expect(
      isTransientDatabaseError({
        message: 'upstream connect error or disconnect/reset before headers: delayed connect error: 111'
      })
    ).toBe(true);
    expect(isTransientDatabaseError({ code: '42703', message: 'column does not exist' })).toBe(false);
  });

  it('retries transient failures and returns the eventual result', async () => {
    let calls = 0;
    const delays: number[] = [];
    const result = await retryDatabaseOperation(
      async () => {
        calls += 1;
        return calls < 3
          ? { data: null, error: { code: 'PGRST000', message: 'connection failed' } }
          : { data: [{ id: 'ok' }], error: null };
      },
      {
        baseDelayMs: 100,
        maxAttempts: 3,
        random: () => 0,
        sleep: async (delayMs) => {
          delays.push(delayMs);
        }
      }
    );

    expect(result.error).toBeNull();
    expect(result.attempts).toBe(3);
    expect(result.result?.data).toEqual([{ id: 'ok' }]);
    expect(delays).toEqual([100, 200]);
  });

  it('does not retry deterministic query errors', async () => {
    let calls = 0;
    const result = await retryDatabaseOperation(
      async () => {
        calls += 1;
        return { data: null, error: { code: '42703', message: 'column does not exist' } };
      },
      { maxAttempts: 3, sleep: async () => undefined }
    );

    expect(calls).toBe(1);
    expect(result.attempts).toBe(1);
    expect(result.error).toMatchObject({ code: '42703' });
  });

  it('caps exponential delays', () => {
    expect(databaseRetryDelayMs(1, 750, 4000, 0)).toBe(750);
    expect(databaseRetryDelayMs(8, 750, 4000, 1)).toBe(4000);
  });
});
