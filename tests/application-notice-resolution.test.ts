import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const workspace = readFileSync(resolve(root, 'lib/cloudbase-data.ts'), 'utf8');
const repository = readFileSync(
  resolve(root, 'lib/server/public-notice-catalog.ts'),
  'utf8'
);
const apiClient = readFileSync(resolve(root, 'lib/public-notice-api.ts'), 'utf8');
const byIdsRoute = readFileSync(
  resolve(root, 'app/api/public/notices/by-ids/route.ts'),
  'utf8'
);

describe('application notice resolution', () => {
  it('queries only the unique project IDs present in the application table', () => {
    expect(workspace).toContain('const publicIds = Array.from');
    expect(workspace).toContain('new Set(');
    expect(workspace).toContain('fetchPublicNoticesByIdsFromApi(publicIds)');
    expect(workspace).not.toContain('getAllProjectsAsync');
    expect(workspace).not.toContain('readRemotePublicNotices');
  });

  it('preserves saved application rows when a public notice is unavailable', () => {
    expect(workspace).toContain('buildUnavailableNoticeProject');
    expect(workspace).toContain('noticeAvailable: Boolean(project)');
    expect(workspace).toContain("publicResult.source === 'supabase'");
    expect(workspace).toContain("'lookup-failed'");
    expect(workspace).toContain('project: project || buildUnavailableNoticeProject(item.projectId)');
    expect(workspace).not.toContain('const rows = records.reduce<ApplicationRow[]>');
  });

  it('resolves workbench rows from the shared cache instead of direct Supabase fan-out', () => {
    expect(repository).toContain('items: await loadRemotePublicNoticeCatalog(false)');
    expect(repository).toContain('.map(toNoticeListItem)');
    expect(repository).not.toContain(".in('id', chunk)");
    expect(apiClient).toContain('uniqueIds.slice(index * 100, (index + 1) * 100)');
  });

  it('bounds and validates the public by-ids request body', () => {
    expect(byIdsRoute).toContain('const MAX_IDS = 100');
    expect(byIdsRoute).toContain('const MAX_REQUEST_BODY_BYTES = 32 * 1024');
    expect(byIdsRoute).toContain('new TextEncoder().encode(rawBody).byteLength');
    expect(byIdsRoute).toContain("{ error: 'ids_must_be_an_array' }");
  });
});
