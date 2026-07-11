import { describe, expect, it } from 'vitest';
import type { PublicNoticeProject } from '../lib/mock-data';
import { getDisplayNoticeDepartment } from '../lib/notice-display';
import { getNoticeQualityTier, shouldShowInMainNoticeFlow } from '../lib/notice-quality';

function notice(overrides: Partial<PublicNoticeProject>): PublicNoticeProject {
  return {
    id: 'fixture',
    schoolName: '示例大学',
    departmentName: '计算机学院',
    projectName: '2026年优秀大学生夏令营通知',
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

describe('notice public quality gate', () => {
  it('recovers a missing college from a structured title', () => {
    const project = notice({ departmentName: '', projectName: '【示例大学】——人工智能学院（第二批）' });
    expect(getDisplayNoticeDepartment(project)).toBe('人工智能学院');
    expect(shouldShowInMainNoticeFlow(project)).toBe(true);
  });

  it('labels a genuine school-wide notice without showing a placeholder', () => {
    const project = notice({ departmentName: '', projectName: '【示例大学】——全校通知' });
    expect(getDisplayNoticeDepartment(project)).toBe('全校通知');
    expect(shouldShowInMainNoticeFlow(project)).toBe(true);
  });

  it('removes notices whose college cannot be resolved', () => {
    const project = notice({ departmentName: '', projectName: '2026年优秀大学生招生通知' });
    expect(getNoticeQualityTier(project)).toBe('p0');
    expect(shouldShowInMainNoticeFlow(project)).toBe(false);
  });

  it('removes notices without a verifiable original link', () => {
    const project = notice({ sourceLink: '' });
    expect(getNoticeQualityTier(project)).toBe('p2');
    expect(shouldShowInMainNoticeFlow(project)).toBe(false);
  });
});
