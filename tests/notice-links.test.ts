import { describe, expect, it } from 'vitest';
import { baseNoticeProjects } from '../lib/notice-source';
import {
  buildNoticeDetailHref,
  getNoticeApplicationLink,
  getNoticeOriginalLink,
  isLikelyApplicationOnlyLink
} from '../lib/notice-links';

describe('notice links', () => {
  it('uses a crawlable static route for notices included in the build snapshot', () => {
    const notice = baseNoticeProjects[0];
    expect(notice).toBeDefined();
    expect(buildNoticeDetailHref(notice.id, '/notices?type=夏令营')).toBe(
      `/notices/${encodeURIComponent(notice.id)}?returnTo=%2Fnotices%3Ftype%3D%E5%A4%8F%E4%BB%A4%E8%90%A5`
    );
  });

  it('keeps a compatibility route for newly synced notices before the next rebuild', () => {
    expect(buildNoticeDetailHref('remote-only-notice')).toBe('/notices/detail?id=remote-only-notice');
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
