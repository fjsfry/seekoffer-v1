export type StaleWhileRevalidateSource = 'remote' | 'stale' | 'fallback';

export type StaleWhileRevalidateSnapshot<T> = {
  value: T;
  source: StaleWhileRevalidateSource;
  syncedAt: number | null;
  attemptedAt: number | null;
  errorAt: number | null;
  error: unknown | null;
  isFresh: boolean;
  isRevalidating: boolean;
  shouldRevalidate: boolean;
  revalidated: boolean;
};

type RemoteEntry<T> = {
  value: T;
  syncedAt: number;
};

type CacheOptions<T> = {
  ttlMs: number;
  retryAfterMs: number;
  fallback: () => T;
  now?: () => number;
};

function assertDuration(label: string, value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite duration.`);
  }
}

export function createStaleWhileRevalidateCache<T>({
  ttlMs,
  retryAfterMs,
  fallback,
  now = Date.now
}: CacheOptions<T>) {
  assertDuration('ttlMs', ttlMs);
  assertDuration('retryAfterMs', retryAfterMs);

  let remoteEntry: RemoteEntry<T> | null = null;
  let attemptedAt: number | null = null;
  let errorAt: number | null = null;
  let lastError: unknown | null = null;
  let inFlight: Promise<StaleWhileRevalidateSnapshot<T>> | null = null;

  function getSnapshot(currentTime = now()): StaleWhileRevalidateSnapshot<T> {
    const remoteAge = remoteEntry ? Math.max(0, currentTime - remoteEntry.syncedAt) : Infinity;
    const failedSinceSync = Boolean(
      lastError !== null && remoteEntry && errorAt !== null && errorAt >= remoteEntry.syncedAt
    );
    const retryWindowOpen = Boolean(
      lastError !== null && attemptedAt !== null && currentTime - attemptedAt < retryAfterMs
    );
    const isFresh = Boolean(remoteEntry && remoteAge < ttlMs && !failedSinceSync);
    const shouldRevalidate = inFlight
      ? false
      : remoteEntry
        ? failedSinceSync
          ? !retryWindowOpen
          : !isFresh
        : attemptedAt === null || !retryWindowOpen;

    return {
      value: remoteEntry?.value ?? fallback(),
      source: remoteEntry ? (isFresh ? 'remote' : 'stale') : 'fallback',
      syncedAt: remoteEntry?.syncedAt ?? null,
      attemptedAt,
      errorAt,
      error: lastError,
      isFresh,
      isRevalidating: Boolean(inFlight),
      shouldRevalidate,
      revalidated: false
    };
  }

  function request(
    fetcher: () => Promise<T>,
    options: { force?: boolean } = {}
  ): Promise<StaleWhileRevalidateSnapshot<T>> {
    // Even an explicit refresh joins the current sweep. Clearing an in-flight
    // request would create duplicate paginated queries and stale write races.
    if (inFlight) return inFlight;

    const current = getSnapshot();
    if (!options.force && !current.shouldRevalidate) {
      return Promise.resolve(current);
    }

    attemptedAt = now();
    const requestPromise = Promise.resolve()
      .then(fetcher)
      .then((value) => {
        remoteEntry = { value, syncedAt: now() };
        errorAt = null;
        lastError = null;
      })
      .catch((error: unknown) => {
        errorAt = now();
        lastError = error;
      })
      .finally(() => {
        inFlight = null;
      })
      .then(() => ({ ...getSnapshot(), revalidated: true }));

    inFlight = requestPromise;
    return requestPromise;
  }

  return {
    getSnapshot,
    request
  };
}
