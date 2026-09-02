import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const compatibilityPageSource = readFileSync(resolve(root, 'app/notices/detail/page.tsx'), 'utf8');

describe('legacy notice detail compatibility route', () => {
  it('uses a server redirect without loading notice collections', () => {
    expect(compatibilityPageSource).not.toContain("'use client'");
    expect(compatibilityPageSource).toContain("import { redirect } from 'next/navigation'");
    expect(compatibilityPageSource).toContain('buildLegacyNoticeDetailRedirect(await searchParams)');
    expect(compatibilityPageSource).not.toContain('baseNoticeProjects');
    expect(compatibilityPageSource).not.toContain('fetchPublicNotices');
    expect(compatibilityPageSource).not.toContain('useSearchParams');
  });
});
