import { describe, expect, it } from 'vitest';
import type { PublicNoticeProject } from '../lib/mock-data';
import { getNoticeKindBucket, getNoticeTypeBucket } from '../lib/notice-analytics';

function notice(overrides: Partial<PublicNoticeProject>): PublicNoticeProject {
  return {
    id: 'fixture',
    schoolName: '示例大学',
    departmentName: '计算机学院',
    projectName: '招生通知',
    projectType: '夏令营',
    discipline: '工学',
    publishDate: '2026-05-10',
    deadlineDate: '2026-06-01',
    eventStartDate: '',
    eventEndDate: '',
    applyLink: '',
    sourceLink: 'https://example.edu.cn/notice',
    requirements: '',
    materialsRequired: [],
    examInterviewInfo: '',
    contactInfo: '',
    remarks: '',
    tags: [],
    status: '报名中',
    year: 2026,
    deadlineLevel: 'future',
    sourceSite: 'fixture',
    collectedAt: '2026-05-10',
    updatedAt: '2026-05-10',
    lastCheckedAt: '2026-05-10',
    isVerified: true,
    changeLog: [],
    historyRecords: [],
    ...overrides
  };
}

describe('notice taxonomy', () => {
  it('does not classify an early-season generic recommendation notice as autumn pre-admission', () => {
    expect(
      getNoticeTypeBucket(
        notice({
          projectName: '2026年接收推荐免试研究生工作通知',
          projectType: '正式推免',
          publishDate: '2026-05-10'
        })
      )
    ).toBe('夏令营');
  });

  it('keeps an explicitly named pre-admission notice in the pre-admission category', () => {
    expect(
      getNoticeTypeBucket(
        notice({
          projectName: '2026年推荐免试研究生预报名通知',
          projectType: '预推免',
          publishDate: '2026-08-12'
        })
      )
    ).toBe('预推免');
  });

  it('separates result lists and information sessions from application notices', () => {
    expect(getNoticeKindBucket(notice({ projectName: '2026年夏令营入营名单公示' }))).toBe('入营名单');
    expect(getNoticeKindBucket(notice({ projectName: '2026年研究生招生线上宣讲会' }))).toBe('宣讲会');
  });
});
