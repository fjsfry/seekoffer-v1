import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const trackerSource = readFileSync(resolve(root, 'components/visitor-presence-tracker.tsx'), 'utf8');

describe('visitor presence heartbeat policy', () => {
  it('keeps deduplicated pageviews and disables optional heartbeat', () => {
    expect(trackerSource).toContain("sendPresence('pageview', pathname)");
    expect(trackerSource).toContain('seenPageviews');
    expect(trackerSource).not.toContain('visibilitychange');
    expect(trackerSource).not.toContain('window.setInterval');
    expect(trackerSource).not.toContain('45_000');
    expect(trackerSource).not.toContain('pagehide');
  });

  it('preserves existing pageview transport', () => {
    expect(trackerSource.match(/text\/plain;charset=UTF-8/g)).toHaveLength(1);
    expect(trackerSource).not.toContain('sendBeacon');
    expect(trackerSource).toContain("headers: { 'Content-Type': 'text/plain;charset=UTF-8' }");
  });

  it('keeps stable in-memory IDs when browser storage is unavailable', () => {
    expect(trackerSource).toContain("let inMemoryVisitorId = ''");
    expect(trackerSource).toContain("let inMemorySessionId = ''");
    expect(trackerSource).toContain("inMemoryVisitorId ||= randomId('v')");
    expect(trackerSource).toContain("inMemorySessionId ||= randomId('s')");
  });
});
