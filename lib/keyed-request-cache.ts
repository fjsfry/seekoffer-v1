export type KeyedCacheEntry<T> = {
  value: T;
  syncedAt: number;
};

type PendingRequest<T> = {
  requestId: number;
  promise: Promise<T>;
};

export function createKeyedRequestCache<T>(ttlMs: number) {
  const cache = new Map<string, KeyedCacheEntry<T>>();
  const pendingRequests = new Map<string, PendingRequest<T>>();
  const latestRequestIds = new Map<string, number>();
  let nextRequestId = 0;

  function get(key: string) {
    return key ? cache.get(key) : undefined;
  }

  function set(key: string, value: T, syncedAt = Date.now()) {
    if (!key) return;
    cache.set(key, { value, syncedAt });
  }

  function isFresh(key: string, now = Date.now()) {
    const entry = get(key);
    return Boolean(entry && now - entry.syncedAt < ttlMs);
  }

  function request(
    key: string,
    fetcher: (requestKey: string) => Promise<T>,
    options: { force?: boolean } = {}
  ) {
    if (!key) {
      return Promise.reject(new Error('A non-empty cache key is required.'));
    }

    const pending = pendingRequests.get(key);
    if (pending && !options.force) {
      return pending.promise;
    }

    const requestId = ++nextRequestId;
    latestRequestIds.set(key, requestId);
    const promise = Promise.resolve()
      .then(() => fetcher(key))
      .then((value) => {
        // A forced refresh can supersede an older in-flight request. Only the
        // newest request for this key is allowed to replace its cache entry.
        if (latestRequestIds.get(key) === requestId) {
          set(key, value);
        }
        return value;
      })
      .finally(() => {
        if (pendingRequests.get(key)?.requestId === requestId) {
          pendingRequests.delete(key);
        }
      });

    pendingRequests.set(key, { requestId, promise });
    return promise;
  }

  return {
    get,
    set,
    isFresh,
    request
  };
}
