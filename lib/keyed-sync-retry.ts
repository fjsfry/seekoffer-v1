export type KeyedSyncRetryState = {
  attempt: number;
  exhausted: boolean;
  inFlight: boolean;
  revision: number;
  timerScheduled: boolean;
};

type TimerHandle = ReturnType<typeof setTimeout>;

type KeyedSyncRetryJob = {
  attempt: number;
  exhausted: boolean;
  inFlight: boolean;
  revision: number;
  timer: TimerHandle | null;
  wakeRequested: boolean;
};

export type KeyedSyncRetryOptions = {
  execute: (key: string) => Promise<void>;
  isEligible: (key: string) => boolean;
  retryDelaysMs?: readonly number[];
  exhaustedRetryDelayMs?: number;
  onError?: (key: string, error: unknown, attempt: number) => void;
  onSuccess?: (key: string) => void;
  setTimer?: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimer?: (timer: TimerHandle) => void;
};

export type KeyedSyncRetryCoordinator = {
  cancel: (key: string) => void;
  getState: (key: string) => KeyedSyncRetryState | null;
  notifyOnline: () => void;
  request: (key: string) => void;
};

const DEFAULT_RETRY_DELAYS_MS = [2_000, 10_000, 30_000, 120_000] as const;

/**
 * Runs account-scoped background work with one in-flight request per key.
 *
 * `request` is intentionally fire-and-forget. A newer request arriving while
 * the current attempt is running increments the revision so the durable source
 * is read again before the job can be considered complete. Timed retries are
 * finite; a later `online` event starts a fresh retry cycle for pending jobs.
 */
export function createKeyedSyncRetryCoordinator(
  options: KeyedSyncRetryOptions
): KeyedSyncRetryCoordinator {
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const setTimer = options.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs));
  const clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer));
  const jobs = new Map<string, KeyedSyncRetryJob>();

  const cancelTimer = (job: KeyedSyncRetryJob) => {
    if (job.timer !== null) {
      clearTimer(job.timer);
      job.timer = null;
    }
  };

  const cancel = (key: string) => {
    const job = jobs.get(key);
    if (!job) return;

    cancelTimer(job);
    jobs.delete(key);
  };

  const schedule = (key: string, delayMs: number) => {
    const job = jobs.get(key);
    if (!job || job.inFlight) return;

    cancelTimer(job);
    job.timer = setTimer(() => {
      job.timer = null;
      void run(key);
    }, delayMs);
  };

  const completeIfCurrent = (key: string, job: KeyedSyncRetryJob, startedRevision: number) => {
    if (job.revision !== startedRevision) {
      job.attempt = 0;
      job.exhausted = false;
      schedule(key, 0);
      return;
    }

    jobs.delete(key);
    options.onSuccess?.(key);
  };

  const run = async (key: string) => {
    const job = jobs.get(key);
    if (!job || job.inFlight) return;

    if (!options.isEligible(key)) {
      cancel(key);
      return;
    }

    cancelTimer(job);
    const startedRevision = job.revision;
    job.inFlight = true;
    job.wakeRequested = false;

    try {
      await options.execute(key);
      job.inFlight = false;

      if (!options.isEligible(key)) {
        cancel(key);
        return;
      }

      completeIfCurrent(key, job, startedRevision);
    } catch (error) {
      job.inFlight = false;

      if (!options.isEligible(key)) {
        cancel(key);
        return;
      }

      options.onError?.(key, error, job.attempt + 1);

      if (job.revision !== startedRevision || job.wakeRequested) {
        job.attempt = 0;
        job.exhausted = false;
        schedule(key, 0);
        return;
      }

      const retryDelay = retryDelaysMs[job.attempt];
      job.attempt += 1;
      if (retryDelay === undefined) {
        job.exhausted = true;
        if (
          typeof options.exhaustedRetryDelayMs === 'number' &&
          options.exhaustedRetryDelayMs >= 0
        ) {
          cancelTimer(job);
          job.timer = setTimer(() => {
            job.timer = null;
            job.attempt = 0;
            job.exhausted = false;
            void run(key);
          }, options.exhaustedRetryDelayMs);
        }
        return;
      }

      schedule(key, retryDelay);
    }
  };

  const request = (key: string) => {
    const normalizedKey = key.trim();
    if (!normalizedKey || !options.isEligible(normalizedKey)) return;

    const existing = jobs.get(normalizedKey);
    if (existing) {
      existing.revision += 1;
      existing.attempt = 0;
      existing.exhausted = false;

      if (!existing.inFlight) {
        schedule(normalizedKey, 0);
      }
      return;
    }

    jobs.set(normalizedKey, {
      attempt: 0,
      exhausted: false,
      inFlight: false,
      revision: 1,
      timer: null,
      wakeRequested: false
    });
    schedule(normalizedKey, 0);
  };

  const notifyOnline = () => {
    for (const [key, job] of jobs) {
      if (!options.isEligible(key)) {
        cancel(key);
        continue;
      }

      job.attempt = 0;
      job.exhausted = false;
      if (job.inFlight) {
        job.wakeRequested = true;
      } else {
        schedule(key, 0);
      }
    }
  };

  return {
    cancel,
    getState(key) {
      const job = jobs.get(key);
      if (!job) return null;

      return {
        attempt: job.attempt,
        exhausted: job.exhausted,
        inFlight: job.inFlight,
        revision: job.revision,
        timerScheduled: job.timer !== null
      };
    },
    notifyOnline,
    request
  };
}
