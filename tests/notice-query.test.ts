import { describe, expect, it } from 'vitest';
import { filterAndSortNotices, type NoticeSearchFilters } from '@/lib/notice-query';
import type { PublicNoticeProject } from '@/lib/mock-data';

const now = new Date('2026-09-02T00:00:00+08:00');

function notice(
  id: string,
  patch: Partial<PublicNoticeProject> = {}
): PublicNoticeProject {
  return {
    id,
    schoolName: '测试大学',
    departmentName: '计算机学院',
    projectName: '2026年推荐免试研究生预报名通知',
    projectType: '预推免',
    discipline: '计算机科学与技术',
    publishDate: '2026-09-01',
    deadlineDate: '2026-09-05 23:59',
    eventStartDate: '',
    eventEndDate: '',
    applyLink: 'https://example.edu/apply',
    sourceLink: 'https://example.edu/notice',
    requirements: '面向计算机相关专业学生',
    materialsRequired: [],
    examInterviewInfo: '',
    contactInfo: '',
    remarks: '',
    tags: ['北京', '985', '双一流'],
    status: '报名中',
    year: 2026,
    deadlineLevel: 'within7days',
    sourceSite: '测试来源',
    collectedAt: '2026-09-01T10:00:00+08:00',
    updatedAt: '2026-09-01T10:00:00+08:00',
    lastCheckedAt: '2026-09-01T10:00:00+08:00',
    isVerified: true,
    changeLog: [],
    historyRecords: [],
    ...patch
  };
}

const defaults: NoticeSearchFilters = {
  keyword: '',
  schoolName: '',
  region: '全部',
  majorKeyword: '',
  category: '全部',
  discipline: '全部',
  schoolRange: '全部',
  progress: '全部',
  deadlineQuick: '全部',
  fresh: '全部',
  publishDate: '',
  projectType: '全部',
  noticeKind: '全部',
  year: '2026',
  sortBy: 'publish'
};

const fixtures = [
  notice('alpha', { schoolName: '北京大学', publishDate: '2026-09-02' }),
  notice('beta', {
    schoolName: '上海科技大学',
    departmentName: '生命科学与技术学院',
    discipline: '生物医学',
    projectName: '2026年夏令营优秀营员入营名单',
    projectType: '夏令营',
    publishDate: '2026-08-30',
    deadlineDate: '2026-09-10 23:59',
    tags: ['上海', '双一流']
  }),
  notice('gamma', {
    schoolName: '普通大学',
    departmentName: '经济管理学院',
    discipline: '金融学',
    projectName: '2026年招生宣讲会通知',
    projectType: '宣讲会',
    publishDate: '2026-08-20',
    deadlineDate: '2026-08-31 23:59',
    tags: ['广东'],
    status: '已结束'
  })
];

describe('shared public notice filtering', () => {
  it.each([
    [{ keyword: '北京大学' }, ['alpha']],
    [{ majorKeyword: '生物' }, ['beta']],
    [{ region: '上海' }, ['beta']],
    [{ category: '经管' }, ['gamma']],
    [{ schoolRange: '985' }, ['alpha']],
    [{ noticeKind: '宣讲会' }, ['gamma']],
    [{ noticeKind: '入营名单' }, ['beta']],
    [{ progress: '已结束' }, ['gamma']],
    [{ fresh: 'today' }, ['alpha']]
  ] as Array<[Partial<NoticeSearchFilters>, string[]]>) (
    'keeps the existing rule result for %o',
    (patch, expectedIds) => {
      const result = filterAndSortNotices(fixtures, { ...defaults, ...patch }, now);
      expect(result.map((item) => item.id)).toEqual(expectedIds);
    }
  );

  it('supports combined filtering, sorting, and stable input immutability', () => {
    const input = [...fixtures];
    const result = filterAndSortNotices(
      input,
      {
        ...defaults,
        region: '北京',
        projectType: '预推免',
        deadlineQuick: 'within7days',
        sortBy: 'deadline'
      },
      now
    );

    expect(result.map((item) => item.id)).toEqual(['alpha']);
    expect(input).toEqual(fixtures);
  });
});
