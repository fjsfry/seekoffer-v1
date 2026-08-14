export type DatabaseErrorLike = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

type DatabaseOperationResult = {
  error?: unknown;
};

type RetryEvent = {
  attempt: number;
  delayMs: number;
  error: unknown;
  nextAttempt: number;
};

type RetryOptions = {
  baseDelayMs?: number;
  maxAttempts?: number;
  maxDelayMs?: number;
  onRetry?: (event: RetryEvent) => void;
  random?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
};

export type DatabaseRetryResult<T> = {
  attempts: number;
  error: unknown;
  result: T | null;
};

export function databaseErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== 'object') return String(error || 'unknown_database_error');

  const candidate = error as DatabaseErrorLike;
  return [candidate.message, candidate.details, candidate.hint].filter(Boolean).join(' ') || 'unknown_database_error';
}

export function isTransientDatabaseError(error: unknown) {
  if (!error) return false;

  const candidate = typeof error === 'object' ? (error as DatabaseErrorLike) : {};
  const code = String(candidate.code || '').toUpperCase();
  const message = `${databaseErrorMessage(error)} ${code}`;

  return (
    /^(?:PGRST00[0-3]|08|53|57P0)/.test(code) ||
    /upstream connect|disconnect|connection|connect error|connection refused|connection reset|fetch failed|network error|socket|timeout|timed out|temporar(?:y|ily)|transport failure|service unavailable|gateway/i.test(
      message
    )
  );
}

export function databaseRetryDelayMs(
  attempt: number,
  baseDelayMs = 750,
  maxDelayMs = 5_000,
  randomValue = Math.random()
) {
  const normalizedAttempt = Math.max(1, Math.floor(Number(attempt) || 1));
  const normalizedBase = Math.max(1, Number(baseDelayMs) || 750);
  const normalizedMax = Math.max(normalizedBase, Number(maxDelayMs) || 5_000);
  const exponential = Math.min(normalizedMax, normalizedBase * 2 ** (normalizedAttempt - 1));
  const jitter = Math.floor(exponential * 0.2 * Math.max(0, Math.min(1, Number(randomValue) || 0)));
  return Math.min(normalizedMax, exponential + jitter);
}

export async function retryDatabaseOperation<T extends DatabaseOperationResult>(
  operation: () => PromiseLike<T>,
  options: RetryOptions = {}
): Promise<DatabaseRetryResult<T>> {
  const maxAttempts = Math.max(1, Math.floor(Number(options.maxAttempts) || 3));
  const sleep = options.sleep || ((delayMs: number) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  const random = options.random || Math.random;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let result: T | null = null;
    let error: unknown = null;

    try {
      result = await operation();
      error = result?.error || null;
    } catch (caughtError) {
      error = caughtError;
    }

    if (!error) {
      return { attempts: attempt, error: null, result };
    }

    if (!isTransientDatabaseError(error) || attempt === maxAttempts) {
      return { attempts: attempt, error, result };
    }

    const delayMs = databaseRetryDelayMs(
      attempt,
      options.baseDelayMs,
      options.maxDelayMs,
      random()
    );
    options.onRetry?.({ attempt, delayMs, error, nextAttempt: attempt + 1 });
    await sleep(delayMs);
  }

  return { attempts: maxAttempts, error: new Error('database_retry_exhausted'), result: null };
}
