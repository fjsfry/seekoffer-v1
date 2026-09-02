import { statSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const footerSource = readFileSync(resolve(root, 'components/site-footer.tsx'), 'utf8');

describe('public website footer QR entry points', () => {
  it('keeps the WeChat QR first and places the QQ group QR directly beside it', () => {
    const wechatIndex = footerSource.indexOf('src="/wechat-qr.jpg"');
    const qqIndex = footerSource.indexOf('src="/qq-group-qr-source.png"');

    expect(wechatIndex).toBeGreaterThan(-1);
    expect(qqIndex).toBeGreaterThan(wechatIndex);
    expect(footerSource).toContain('加入寻鹿保研交流群');
    expect(footerSource).toContain('QQ 群：1092490793');
    expect(footerSource).toContain('alt="寻鹿2026保研交流群二维码"');
    expect(statSync(resolve(root, 'public/qq-group-qr-source.png')).size).toBeGreaterThan(
      100_000
    );
  });

  it('keeps both QR entries in one responsive row without increasing footer height', () => {
    expect(footerSource).toContain('grid grid-cols-2 justify-items-center');
    expect(footerSource).not.toContain('lg:grid-cols-1');
    expect(footerSource).toContain('lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_184px]');
    expect(footerSource).toContain(
      'min-[1380px]:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_17rem]'
    );
    expect(footerSource).toContain("width: '139.3%'");
    expect(footerSource).toContain("height: '248.2%'");
  });
});
