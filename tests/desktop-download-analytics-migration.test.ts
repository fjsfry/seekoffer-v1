import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260903024640_desktop_download_analytics.sql'),
  'utf8'
).toLowerCase();

describe('desktop download analytics migration', () => {
  it('stores private, append-only and idempotent download-start attempts', () => {
    expect(migration).toContain('create table if not exists public.desktop_download_attempts');
    expect(migration).toContain('attempt_id uuid not null');
    expect(migration).toContain('unique (attempt_id)');
    expect(migration).toContain('on conflict (attempt_id) do nothing');
    expect(migration).toContain("platform = 'windows_x86_64'");
    expect(migration).toContain("source = 'website_download_page'");
    expect(migration).toContain('desktop_download_attempts_created_at_idx');
    expect(migration).toContain('desktop_download_attempts_release_created_at_idx');
  });

  it('enforces RLS and a service-role-only table boundary', () => {
    expect(migration).toContain(
      'alter table public.desktop_download_attempts enable row level security'
    );
    expect(migration).toContain(
      'alter table public.desktop_download_attempts force row level security'
    );
    expect(migration).toContain(
      'revoke all on table public.desktop_download_attempts from public, anon, authenticated, service_role'
    );
    expect(migration).toContain(
      'grant select, insert on table public.desktop_download_attempts to service_role'
    );
    expect(migration).not.toMatch(/create policy[\s\S]+desktop_download_attempts/);
  });

  it('exposes only service-role invoker RPCs with an empty search path', () => {
    expect(migration).toContain('seekoffer_record_desktop_download_attempt');
    expect(migration).toContain('seekoffer_get_desktop_download_metrics');
    expect(migration.match(/security invoker/g)).toHaveLength(2);
    expect(migration.match(/set search_path = ''/g)).toHaveLength(2);
    expect(migration).toContain(
      'grant execute on function public.seekoffer_record_desktop_download_attempt(uuid, text, text, text)\n  to service_role'
    );
    expect(migration).toContain(
      'grant execute on function public.seekoffer_get_desktop_download_metrics()\n  to service_role'
    );
  });

  it('aggregates total, Beijing today and the current seven Beijing calendar days', () => {
    expect(migration).toContain('returns table (');
    expect(migration).toContain('total bigint');
    expect(migration).toContain('today bigint');
    expect(migration).toContain('seven_days bigint');
    expect(migration).toContain("timezone('asia/shanghai', now())");
    expect(migration).toContain("at time zone 'asia/shanghai'");
    expect(migration).toContain("interval '6 days'");
    expect(migration).toContain("'2026-09-03 00:00:00+08'::timestamptz");
  });
});
