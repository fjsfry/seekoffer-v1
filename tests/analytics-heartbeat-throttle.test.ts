import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migration = readFileSync(
  resolve(root, 'supabase/migrations/20260902151058_analytics_heartbeat_throttle_v2.sql'),
  'utf8'
);
const adminApi = readFileSync(resolve(root, 'supabase/functions/admin-api/index.ts'), 'utf8');
const dashboard = readFileSync(resolve(root, 'app/admin/dashboard/page.tsx'), 'utf8');

describe('analytics heartbeat throttling', () => {
  it('throttles repeat heartbeat writes while preserving pageview updates', () => {
    expect(migration).toContain('create or replace function public.seekoffer_record_analytics');
    expect(migration).toMatch(
      /where\s+p_event_type\s*=\s*'pageview'\s+or\s+public\.site_visitors\.last_seen_at\s*<\s*now\(\)\s*-\s*interval\s*'2 minutes'/i
    );
    expect(migration).toContain("if should_count_pageview then");
    expect(migration).toContain("p_event_type not in ('pageview', 'heartbeat')");
  });

  it('counts a visitor session once instead of toggling on the last tab', () => {
    expect(migration).toContain('is_new_session boolean := false');
    expect(migration).toContain('session_event.session_id = p_session_id');
    expect(migration).toContain('when is_new_session then 1');
    expect(migration).not.toContain('last_session_id is distinct from excluded.last_session_id');
  });

  it('keeps the security-definer function private to the service role', () => {
    expect(migration).toContain("set search_path = ''");
    expect(migration).toMatch(/revoke all on function[\s\S]+from public, anon, authenticated/i);
    expect(migration).toMatch(/grant execute on function[\s\S]+to service_role/i);
  });

  it('uses a six-minute online window for five-minute heartbeats', () => {
    expect(adminApi).toContain('const activeWindowMinutes = 6');
    expect(dashboard).toContain('activeWindowMinutes: 6');
  });
});
