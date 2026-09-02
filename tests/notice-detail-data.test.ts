import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const detailPage = readFileSync(resolve(root, 'app/notices/[id]/page.tsx'), 'utf8');
const catalog = readFileSync(resolve(root, 'lib/server/public-notice-catalog.ts'), 'utf8');

describe('public notice detail data path', () => {
  it('resolves one canonical ID through the cached server repository', () => {
    expect(detailPage).toContain('await getCachedNoticeById(id)');
    expect(detailPage).not.toContain('baseNoticeProjects');
    expect(detailPage).not.toContain('generateStaticParams');
    expect(detailPage).toContain('getSafeNoticeReturnHref');
  });

  it('uses an explicit detail projection and an ID-scoped cache tag', () => {
    expect(catalog).toContain(".select(NOTICE_DETAIL_COLUMNS)");
    expect(catalog).toContain(".eq('id', id)");
    expect(catalog).toContain('.maybeSingle()');
    expect(catalog).toContain('publicNoticeCacheTag(normalizedId)');
    expect(catalog).not.toContain(".select('*')");
  });
});
