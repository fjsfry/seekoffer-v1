import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/functions/analytics-api/index.ts'),
  'utf8'
);

describe('public analytics ingestion validation', () => {
  it('rejects missing origins and unknown event types', () => {
    expect(source).toContain("const origin = request.headers.get('origin') || ''");
    expect(source).toContain('return Boolean(origin) && getAllowedOrigins().includes(origin)');
    expect(source).toContain("body.eventType !== 'pageview' && body.eventType !== 'heartbeat'");
    expect(source).not.toContain("body.eventType === 'heartbeat' ? 'heartbeat' : 'pageview'");
  });

  it('enforces the payload limit even when content-length is absent', () => {
    expect(source).toContain('const rawBody = await request.text()');
    expect(source).toContain('new TextEncoder().encode(rawBody).byteLength > 8192');
    expect(source).toContain('JSON.parse(rawBody)');
  });
});
