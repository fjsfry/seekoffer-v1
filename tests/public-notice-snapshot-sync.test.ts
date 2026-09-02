import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'scripts/sync-public-notice-data.mjs'),
  'utf8'
);

describe('public notice snapshot sync', () => {
  it('uses an explicit public projection and stable pagination order', () => {
    expect(source).not.toContain("endpoint.searchParams.set('select', '*')");
    expect(source).toContain("endpoint.searchParams.set('order', 'publish_date.desc,id.asc')");
    expect(source).toContain("'history_records'");
    expect(source).not.toContain("'admin_review_note'");
    expect(source).not.toContain("'admin_reviewed_by'");
    expect(source).not.toContain("'created_by'");
  });

  it('treats a successful empty Supabase response as authoritative', () => {
    expect(source).toContain('if (supabaseResult.ok)');
    expect(source).toContain('supabaseRows.forEach((item) => merged.set(item.id, item))');
    expect(source).toContain('exportRows.forEach((item) => merged.set(item.id, item))');
    expect(source.indexOf('if (supabaseResult.ok)')).toBeLessThan(
      source.indexOf('exportRows.forEach((item) => merged.set(item.id, item))')
    );
  });
});
