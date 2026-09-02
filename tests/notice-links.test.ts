import { describe, expect, it } from 'vitest';
import { baseNoticeProjects } from '../lib/notice-source';
import {
  buildLegacyNoticeDetailRedirect,
  buildNoticeDetailHref,
  getSafeNoticeReturnHref,
  getNoticeApplicationLink,
  getNoticeOriginalLink,
  isLikelyApplicationOnlyLink
} from '../lib/notice-links';

describe('notice links', () => {
  it('uses the encoded canonical detail route for every non-empty notice id', () => {
    const notice = baseNoticeProjects[0];
    expect(notice).toBeDefined();
    expect(buildNoticeDetailHref(notice.id, '/notices?type=夏令营')).toBe(
      `/notices/${encodeURIComponent(notice.id)}?returnTo=%2Fnotices%3Ftype%3D%E5%A4%8F%E4%BB%A4%E8%90%A5`
    );
    expect(buildNoticeDetailHref('remote only/通知?#1')).toBe(
      '/notices/remote%20only%2F%E9%80%9A%E7%9F%A5%3F%231'
    );
  });

  it('does not create an unsafe or empty path segment', () => {
    expect(buildNoticeDetailHref('')).toBe('/notices');
    expect(buildNoticeDetailHref('..')).toBe('/notices');
    expect(buildNoticeDetailHref('bad\nvalue')).toBe('/notices');
  });

  it('accepts only notice-list return paths', () => {
    expect(getSafeNoticeReturnHref('/notices?type=夏令营#results')).toBe('/notices?type=夏令营#results');
    expect(getSafeNoticeReturnHref('/notices/')).toBe('/notices/');
    expect(getSafeNoticeReturnHref('https://evil.example/notices')).toBeNull();
    expect(getSafeNoticeReturnHref('//evil.example/notices')).toBeNull();
    expect(getSafeNoticeReturnHref('/notices-archive')).toBeNull();
    expect(getSafeNoticeReturnHref('/notices\\evil.example')).toBeNull();
    expect(getSafeNoticeReturnHref('/notices?next=%0d%0aLocation%3Ahttps%3A%2F%2Fevil.example')).toBeNull();
    expect(getSafeNoticeReturnHref(['/notices'])).toBeNull();
  });

  it('redirects the legacy query route to the encoded canonical route', () => {
    expect(
      buildLegacyNoticeDetailRedirect({
        id: 'remote only/通知?#1',
        returnTo: '/notices?type=夏令营'
      })
    ).toBe(
      '/notices/remote%20only%2F%E9%80%9A%E7%9F%A5%3F%231?returnTo=%2Fnotices%3Ftype%3D%E5%A4%8F%E4%BB%A4%E8%90%A5'
    );

    expect(buildLegacyNoticeDetailRedirect({})).toBe('/notices');
    expect(buildLegacyNoticeDetailRedirect({ id: ['one', 'two'] })).toBe('/notices');
    expect(buildLegacyNoticeDetailRedirect({ id: 'notice-1', returnTo: '//evil.example' })).toBe('/notices');
  });

  it('separates an official notice page from an application form', () => {
    const notice = {
      sourceLink: 'https://example.edu.cn/admission/notice.html',
      applyLink: 'https://www.wjx.cn/vm/example.aspx'
    };
    expect(getNoticeOriginalLink(notice)).toBe(notice.sourceLink);
    expect(getNoticeApplicationLink(notice)).toBe(notice.applyLink);
    expect(isLikelyApplicationOnlyLink(notice.applyLink)).toBe(true);
  });
});
