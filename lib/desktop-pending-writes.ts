export const DESKTOP_PENDING_WRITES_EVENT = 'seekoffer:desktop-pending-writes';

export type DesktopPendingWriteSnapshot = {
  count: number;
  source: string;
  phase: 'begin' | 'finish';
};

type PendingWriteChangeListener = (snapshot: DesktopPendingWriteSnapshot) => void;

/**
 * Tracks every write independently. The finish callback is deliberately
 * idempotent so promise cleanup, component teardown and retry paths can never
 * decrement another operation's count.
 */
export function createDesktopPendingWriteTracker(onChange?: PendingWriteChangeListener) {
  let nextToken = 0;
  const pendingTokens = new Set<number>();

  function publish(source: string, phase: DesktopPendingWriteSnapshot['phase']) {
    onChange?.({ count: pendingTokens.size, source, phase });
  }

  function begin(source = 'desktop-write') {
    const token = ++nextToken;
    pendingTokens.add(token);
    publish(source, 'begin');

    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      pendingTokens.delete(token);
      publish(source, 'finish');
    };
  }

  async function track<T>(source: string, operation: () => Promise<T> | T): Promise<T> {
    const finish = begin(source);
    try {
      return await operation();
    } finally {
      finish();
    }
  }

  return {
    begin,
    track,
    getCount: () => pendingTokens.size
  };
}

const desktopPendingWrites = createDesktopPendingWriteTracker((snapshot) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<DesktopPendingWriteSnapshot>(DESKTOP_PENDING_WRITES_EVENT, {
      detail: snapshot
    })
  );
});

export function beginDesktopPendingWrite(source?: string) {
  return desktopPendingWrites.begin(source);
}

export function trackDesktopPendingWrite<T>(
  source: string,
  operation: () => Promise<T> | T
): Promise<T> {
  return desktopPendingWrites.track(source, operation);
}

export function getDesktopPendingWriteCount() {
  return desktopPendingWrites.getCount();
}

export function hasDesktopPendingWrites() {
  return getDesktopPendingWriteCount() > 0;
}
