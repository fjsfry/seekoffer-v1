import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const nextConfig = readFileSync(resolve(root, 'next.config.mjs'), 'utf8');
const listRoute = readFileSync(
  resolve(root, 'app/api/public/notices/route.ts'),
  'utf8'
);

describe('Next.js runtime required by the notice API', () => {
  it('uses the Vercel server runtime rather than static export', () => {
    expect(nextConfig).not.toMatch(/output\s*:\s*['"]export['"]/);
    expect(listRoute).toContain("export const runtime = 'nodejs'");
    expect(listRoute).toContain("export const dynamic = 'force-dynamic'");
  });

  it('keeps the documented list defaults when numeric query params are omitted', () => {
    expect(listRoute).toContain("if (value === null || value.trim() === '')");
    expect(listRoute).toContain("pageSize: parseNumber(searchParams.get('pageSize'), 16)");
  });
});
