import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const trackerSource = readFileSync(resolve(root, 'components/visitor-presence-tracker.tsx'), 'utf8');

describe('visitor presence heartbeat policy', () => {
  it('keeps page views while limiting heartbeats to visible five-minute intervals', () => {
    expect(trackerSource).toContain("sendPresence('pageview', pathname)");
    expect(trackerSource).toContain('const HEARTBEAT_INTERVAL_MS = 5 * 60_000');
    expect(trackerSource).toContain("document.visibilityState === 'visible'");
    expect(trackerSource).toContain('window.setInterval(sendHeartbeatWhenVisible, HEARTBEAT_INTERVAL_MS)');
    expect(trackerSource).not.toContain('45_000');
    expect(trackerSource).not.toContain('pagehide');
  });

  it('uses a CORS-simple text payload for fetch and beacon delivery', () => {
    expect(trackerSource.match(/text\/plain;charset=UTF-8/g)).toHaveLength(2);
    expect(trackerSource).toContain("new Blob([body], { type: 'text/plain;charset=UTF-8' })");
    expect(trackerSource).toContain("headers: { 'Content-Type': 'text/plain;charset=UTF-8' }");
  });

  it('keeps stable in-memory IDs when browser storage is unavailable', () => {
    expect(trackerSource).toContain("let inMemoryVisitorId = ''");
    expect(trackerSource).toContain("let inMemorySessionId = ''");
    expect(trackerSource).toContain("inMemoryVisitorId ||= randomId('v')");
    expect(trackerSource).toContain("inMemorySessionId ||= randomId('s')");
  });
});
