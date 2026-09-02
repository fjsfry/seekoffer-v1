import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const nextConfig = readFileSync(resolve(root, 'next.config.mjs'), 'utf8');
const prepareHosting = readFileSync(resolve(root, 'scripts/prepare-hosting.mjs'), 'utf8');

describe('server-runtime deployment guard', () => {
  it('fails closed instead of publishing an incomplete static bundle', () => {
    expect(nextConfig).not.toMatch(/output\s*:\s*['"]export['"]/);
    expect(prepareHosting).toContain("await access(path.join(exportDir, 'index.html'))");
    expect(prepareHosting).toContain('CloudBase static hosting is disabled');
    expect(prepareHosting.indexOf("await access(path.join(exportDir, 'index.html'))"))
      .toBeLessThan(prepareHosting.indexOf('await rm(targetDir'));
  });
});
