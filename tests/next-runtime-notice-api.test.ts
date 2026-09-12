import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach,describe, expect, it,vi } from 'vitest';

const queries=vi.hoisted(()=>({catalog:vi.fn(async()=>({version:'synthetic'})),respond:vi.fn(async()=>Response.json({ok:true}))}));
vi.mock('@/lib/server/public-notice-catalog',()=>({getPublicNoticeCatalog:queries.catalog}));
vi.mock('@/lib/server/notice-search-result-cache',()=>({publicNoticeSearchResponse:queries.respond}));
import {GET} from '../app/api/public/notices/route';
beforeEach(()=>vi.clearAllMocks());

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

  it('uses page 1 and 16 summaries when pagination is omitted', async () => {
    expect((await GET(new Request('https://fixture.invalid/api/public/notices/'))).status).toBe(200);
    expect(queries.respond).toHaveBeenCalledWith({version:'synthetic'},expect.any(Object),{page:1,pageSize:16});
  });
  it('accepts 40 items and passes complete filters to the query layer',async()=>{
    expect((await GET(new Request('https://fixture.invalid/api/public/notices/?page=2&pageSize=40&q=北京&region=北京'))).status).toBe(200);
    expect(queries.respond).toHaveBeenCalledWith({version:'synthetic'},expect.objectContaining({keyword:'北京',region:'北京'}),{page:2,pageSize:40});
  });
  it.each(['pageSize=41','page=0','page=1.5','sort=unknown','page=1&page=2','q='+('长'.repeat(81))])('rejects malformed input before any catalog read: %s',async query=>{
    expect((await GET(new Request('https://fixture.invalid/api/public/notices/?'+query))).status).toBe(400);expect(queries.catalog).not.toHaveBeenCalled();expect(queries.respond).not.toHaveBeenCalled();
  });
});
