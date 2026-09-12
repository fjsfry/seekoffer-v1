type Store = Pick<Storage, 'getItem' | 'setItem'>;
const STOP = 'seekoffer.download-tracking.stop-until';
const LAST = 'seekoffer.download-tracking.last-attempt';

// Counts explicit download attempts, never completed installations. A quota or
// transport failure cannot block the link or schedule a retry loop.
export function createD1DownloadTracker(fetcher: typeof fetch, store: Store, now = Date.now, makeId = () => crypto.randomUUID()) {
  let inFlight = false, lastAttempt = 0, stopUntil = 0;
  const read = (key: string) => { try { return Number(store.getItem(key)) || 0; } catch { return 0; } };
  const write = (key: string, value: number) => { try { store.setItem(key, String(value)); } catch { /* A blocked local store must not block downloading. */ } };
  return () => {
    const stamp = now();
    if (inFlight || Math.max(stopUntil, read(STOP)) > stamp || Math.max(lastAttempt, read(LAST)) + 30_000 > stamp) return false;
    let id: string; try { id = makeId(); } catch { return false; }
    inFlight = true; lastAttempt = stamp; write(LAST, stamp);
    void (async () => {
      try {
        const response = await fetcher('https://migration.seekoffer.com.cn/v1/desktop-download-attempt', {
          method: 'POST', credentials: 'omit', redirect: 'error', keepalive: true,
          headers: {'Content-Type': 'text/plain;charset=UTF-8'}, body: JSON.stringify({attemptId: id}), signal: AbortSignal.timeout(8000)
        });
        if (response.status === 402) stopUntil = (Math.floor(stamp / 86400000) + 1) * 86400000;
        else if (!response.ok) stopUntil = stamp + 5 * 60_000;
      } catch { stopUntil = stamp + 5 * 60_000; }
      finally { if (stopUntil > stamp) write(STOP, stopUntil); inFlight = false; }
    })();
    return true;
  };
}
