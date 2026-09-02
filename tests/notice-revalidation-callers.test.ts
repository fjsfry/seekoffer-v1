import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const workflow = readFileSync(resolve(root, '.github/workflows/sync-notices.yml'), 'utf8');
const adminApi = readFileSync(resolve(root, 'supabase/functions/admin-api/index.ts'), 'utf8');

describe('public notice cache revalidation callers', () => {
  it('revalidates the global cache after a successful GitHub notice sync', () => {
    expect(workflow).toContain('NOTICE_REVALIDATE_URL: ${{ secrets.NOTICE_REVALIDATE_URL }}');
    expect(workflow).toContain('NOTICE_REVALIDATE_TOKEN: ${{ secrets.NOTICE_REVALIDATE_TOKEN }}');
    expect(workflow).toContain('x-seekoffer-revalidate-token: $NOTICE_REVALIDATE_TOKEN');
    expect(workflow).toContain("--data '{\"ids\":[]}'");
    expect(workflow).toContain('--connect-timeout 5');
    expect(workflow).toContain('--max-time 10');
    expect(workflow).toContain('"${NOTICE_REVALIDATE_URL%/}/"');
    expect(workflow).toContain("if: ${{ env.DRY_RUN != 'true' }}");
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
