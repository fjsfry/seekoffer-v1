import type { PublicNoticeProject } from './mock-data';

const SOURCE_SITE_PATTERN = /保研通知网|保研信息网/g;
const ORIGINAL_NOTICE_PATTERN = /原文通知|原通知|官网原文|原文/g;

export function publicNoticeCopy(value: string | undefined | null) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(SOURCE_SITE_PATTERN, '公开通知')
    .replace(ORIGINAL_NOTICE_PATTERN, '完整通知')
    .replace(/来源说明|来源链接/g, '整理说明')
    .replace(/该项目由公开通知同步，?/g, '')
    .replace(/从公开通知录入基础项目字段。?/g, '完成基础字段整理。')
    .replace(/建议结合完整通知再次确认/g, '建议提交前再次确认')
    .trim();
}

export function sanitizeNoticeForPublicView(project: PublicNoticeProject): PublicNoticeProject {
  return {
    ...project,
    requirements: publicNoticeCopy(project.requirements),
    examInterviewInfo: publicNoticeCopy(project.examInterviewInfo),
    contactInfo: publicNoticeCopy(project.contactInfo),
    remarks: publicNoticeCopy(project.remarks),
    materialsRequired: project.materialsRequired.map((item) => publicNoticeCopy(item)).filter(Boolean),
    sourceSite: '寻鹿整理',
    changeLog: project.changeLog.map((item) => ({
      ...item,
      field: publicNoticeCopy(item.field),
      change: publicNoticeCopy(item.change)
    })),
    historyRecords: project.historyRecords.map((item) => ({
      ...item,
      summary: publicNoticeCopy(item.summary)
    }))
  };
}
