import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260902151003_public_notice_read_indexes_v2.sql'
);
const migration = readFileSync(migrationPath, 'utf8');

describe('public notice read indexes v2 migration', () => {
  it('adds only indexes exercised by the public runtime', () => {
    expect(migration.match(/create\s+index\s+if\s+not\s+exists/gi)).toHaveLength(2);
    expect(migration).not.toMatch(/drop\s+index|alter\s+index/i);
    expect(migration).not.toContain('notices_public_updated_v2_idx');
    expect(migration).not.toContain('notices_tags_gin_idx');
  });

  it.each([
    [
      'notices_public_feed_v2_idx',
      /on\s+public\.notices\s*\(year,\s*publish_date\s+desc,\s*id\s+asc\)/i
    ],
    [
      'notices_public_deadline_v2_idx',
      /on\s+public\.notices\s*\(year,\s*deadline_date\s+asc,\s*id\s+asc\)/i
    ]
  ])('adds the %s partial public index', (indexName, columnPattern) => {
    const statement = migration
      .split(';')
      .find((candidate) => candidate.includes(indexName));

    expect(statement).toBeDefined();
    expect(statement).toMatch(columnPattern);
    expect(statement).toMatch(/where\s+is_private\s*=\s*false/i);
    expect(statement).toMatch(/admin_status\s*=\s*'published'/i);
    expect(statement).toMatch(/admin_deleted_at\s+is\s+null/i);
  });
});
