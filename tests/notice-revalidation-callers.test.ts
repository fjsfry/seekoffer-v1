import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const workflow = readFileSync(resolve(root, '.github/workflows/sync-notices.yml'), 'utf8');
const adminApi = readFileSync(resolve(root, 'supabase/functions/admin-api/index.ts'), 'utf8');

describe('public notice cache revalidation callers', () => {
  it('uses the atomic D1 ingestion path without a second rebuild or global refresh', () => {
    expect(workflow).toContain('SEEKOFFER_INGEST_BACKEND: d1');
    expect(workflow).toContain('SEEKOFFER_INGEST_SECRET: ${{ secrets.SEEKOFFER_INGEST_SECRET }}');
    expect(workflow).toContain('cancel-in-progress: false');
    expect(workflow).not.toContain('NOTICE_REVALIDATE_URL:');
    expect(workflow).not.toContain('NOTICE_REVALIDATE_TOKEN:');
    expect(workflow).not.toContain('VERCEL_DEPLOY_HOOK');
    expect(workflow).not.toContain('npm run build');
  });

  it('revalidates affected IDs after admin notice mutations without exposing the token', () => {
    expect(adminApi).toContain("Deno.env.get('NOTICE_REVALIDATE_URL')");
    expect(adminApi).toContain("Deno.env.get('NOTICE_REVALIDATE_TOKEN')");
    expect(adminApi).toContain("configuredUrl.replace(/\\/+$/, '')");
    expect(adminApi).not.toContain('NEXT_PUBLIC_NOTICE_REVALIDATE_TOKEN');
    expect(adminApi).toContain("'x-seekoffer-revalidate-token': token");
    expect(adminApi).toContain('const controller = new AbortController()');
    expect(adminApi).toContain('signal: controller.signal');
    expect(adminApi).toContain('clearTimeout(timeout)');
    expect(adminApi).toContain('await revalidatePublicNotices(validIds)');
    expect(adminApi).toContain('await revalidatePublicNotices([payload.id])');
  });
});
