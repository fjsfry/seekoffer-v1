import { describe, expect, it } from 'vitest';
import {
  areLikelyDuplicateNotices,
  extractDeadlineFromText,
  getXingkePublishTimestamp,
  inferProjectType,
  isRetryableIngestStatus
} from '../scripts/notice-sync-core.mjs';

function project(overrides = {}) {
  return {
    school_name: '浙江大学',
    department_name: '管理学院',
    project_name: '浙江大学管理学院2026年接收推荐免试研究生通知',
    project_type: '正式推免',
    deadline_date: '2026-09-10 23:59',
    source_link: '',
    ...overrides
  };
}

describe('notice deadline extraction', () => {
  it('infers the year for a month-day-only application deadline', () => {
    expect(extractDeadlineFromText('报名时间：8月1日至8月18日晚上11点59分。', '2026-08-07')).toBe(
      '2026-08-18 23:59'
    );
  });

  it('uses the end of an application date range', () => {
    expect(extractDeadlineFromText('申请时间为2026年7月20日—2026年8月10日17:00。', '2026-07-18')).toBe(
      '2026-08-10 17:00'
    );
  });

  it('does not mistake an event date for an application deadline', () => {
    expect(extractDeadlineFromText('活动将于2026年8月20日举行，具体安排另行通知。', '2026-08-01')).toBe('');
  });

  it('does not treat a material count after the date as a time', () => {
    expect(extractDeadlineFromText('申请材料请于8月18日提交2份纸质版。', '2026-08-07')).toBe(
      '2026-08-18 23:59'
    );
  });
});

describe('notice stage classification', () => {
  it('does not default an unclassified recommendation notice to summer camp', () => {
    expect(inferProjectType('2026年接收推荐免试研究生招生通知')).toBe('正式推免');
    expect(inferProjectType('2026年推免招生政策发布')).toBe('推免');
  });

  it('classifies result and presentation notices before their recruitment stage', () => {
    expect(inferProjectType('2026年夏令营优秀营员名单')).toBe('入营名单');
    expect(inferProjectType('2026年推免招生线上宣讲会')).toBe('宣讲会');
    expect(inferProjectType('pre_recommendation', '2027级推免生报名通知')).toBe('预推免');
  });
});

describe('source publish-date normalization', () => {
  it('uses the immutable Xingke creation time for freshness checks', () => {
    expect(
      getXingkePublishTimestamp({
        created_at: '2026-08-12T23:50:10',
        updated_at: '2026-08-13T00:32:41',
        signup_start: '2026-08-13'
      })
    ).toBe('2026-08-12T23:50:10');
  });

  it('falls back to the Xingke update time when creation time is unavailable', () => {
    expect(
      getXingkePublishTimestamp({
        updated_at: '2026-08-13T00:32:41',
        signup_start: '2026-08-15'
      })
    ).toBe('2026-08-13T00:32:41');
  });
});

describe('ingest retry policy', () => {
  it('retries transient gateway, rate-limit and server failures', () => {
    expect(isRetryableIngestStatus(408)).toBe(true);
    expect(isRetryableIngestStatus(429)).toBe(true);
    expect(isRetryableIngestStatus(500)).toBe(true);
    expect(isRetryableIngestStatus(503)).toBe(true);
  });

  it('does not retry invalid payloads or authorization failures', () => {
    expect(isRetryableIngestStatus(400)).toBe(false);
    expect(isRetryableIngestStatus(401)).toBe(false);
    expect(isRetryableIngestStatus(403)).toBe(false);
  });
});

describe('high-confidence notice deduplication', () => {
  it('keeps masters and direct-PhD projects from the same department and deadline separate', () => {
    const masters = project({ project_name: '浙江大学管理学院2026年推免硕士研究生招生通知' });
    const directPhd = project({ project_name: '浙江大学管理学院2026年推免直博生招生通知' });
    expect(areLikelyDuplicateNotices(masters, directPhd)).toBe(false);
  });

  it('keeps school-wide direct-PhD and joint-training projects separate', () => {
    const schoolWide = project({
      school_name: '西湖大学',
      department_name: '全校类',
      project_name: '西湖大学2026年校级直博生项目通知'
    });
    const joint = project({
      school_name: '西湖大学',
      department_name: '全校类',
      project_name: '西湖大学2026年联合培养项目通知'
    });
    expect(areLikelyDuplicateNotices(schoolWide, joint)).toBe(false);
  });

  it('merges the same official notice discovered through different sources', () => {
    const first = project({
      source_link: 'https://example.edu.cn/news/123?utm_source=feed',
      project_name: '浙江大学管理学院2026年接收推荐免试研究生通知'
    });
    const second = project({
      source_link: 'https://example.edu.cn/news/123',
      project_name: '浙江大学管理学院2026接收推免生通知'
    });
    expect(areLikelyDuplicateNotices(first, second)).toBe(true);
  });
});
