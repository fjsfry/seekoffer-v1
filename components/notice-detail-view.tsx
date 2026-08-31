'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  History,
  MessageCircle
} from 'lucide-react';
import { ApplicationActionButton } from '@/components/application-action-button';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { DeadlineBadge, StatusBadge } from '@/components/status-badge';
import { QQ_GROUP_NUMBER } from '@/lib/contact';
import { getCountdownLabel, getDeadlineLevelFromDate } from '@/lib/deadline-display';
import type { PublicNoticeProject } from '@/lib/mock-data';
import {
  formatNoticeDate,
  formatNoticeDateOnly,
  getDisplayDiscipline,
  getDisplayNoticeDepartment,
  getDisplayProjectType,
  getDisplaySchoolName,
  getDisplayTags,
  isWeakNoticeValue,
  normalizeNoticeTitle
} from '@/lib/notice-display';
import { getNoticeApplicationLink, getNoticeOriginalLink } from '@/lib/notice-links';
import { resolveNoticeLogoSource } from '@/lib/school-mark-source';

type NoticeDetailViewProps = {
  project: PublicNoticeProject;
  returnHref?: string;
};

const SOURCE_COPY_PATTERN = /(保研通知网|保研信息网|原文通知|原通知|官网原文|原文|来源说明|来源链接)/g;
const WEAK_PLACEHOLDER_PATTERN = /^(以.*为准|见.*通知|待补充|暂无|无|未提及|待确认)$/;
const INTERNAL_CHANGE_ID_PATTERN = /\b[a-z][a-z0-9_-]*-\d{3,}\b/gi;
const INTERNAL_CHANGE_ENUM_PATTERN = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/gi;

const PUBLIC_CHANGE_FIELD_LABELS: Record<string, string> = {
  初次录入: '通知收录',
  材料要求: '材料要求更新',
  申请条件: '申请条件更新',
  备注: '备注更新',
  人工校验: '信息校验',
  状态: '报名状态更新',
  duplicate_merge: '重复通知合并',
  deadline_date: '截止时间更新',
  publish_date: '发布时间更新',
  project_name: '通知标题更新',
  materials_required: '材料要求更新',
  requirements: '申请条件更新',
  status: '报名状态更新',
  contact_info: '联系方式更新',
  exam_interview_info: '考核安排更新',
  remarks: '备注更新',
  source_link: '通知入口更新',
  apply_link: '报名入口更新'
};

type PublicChangeRecord = {
  date: string;
  label: string;
  change: string;
};

function compactText(value: string | undefined | null) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function publicCopy(value: string | undefined | null) {
  return compactText(value)
    .replace(/保研通知网|保研信息网/g, '公开通知')
    .replace(/原文通知|原通知|官网原文|原文/g, '完整通知')
    .replace(/来源说明|来源链接/g, '整理说明');
}

function isWeakDetailText(value: string | undefined | null, project?: PublicNoticeProject) {
  const text = publicCopy(value);
  if (!text || isWeakNoticeValue(text) || WEAK_PLACEHOLDER_PATTERN.test(text)) {
    return true;
  }

  if (project) {
    const title = normalizeNoticeTitle(project.projectName, 120);
    const normalizedText = text.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '');
    const normalizedTitle = title.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '');
    if (normalizedText && normalizedTitle && normalizedText === normalizedTitle) {
      return true;
    }
  }

  return false;
}

function getDetailText(value: string | undefined | null, fallback: string, project?: PublicNoticeProject) {
  return isWeakDetailText(value, project) ? fallback : publicCopy(value);
}

function getMaterialItems(project: PublicNoticeProject) {
  const items = (project.materialsRequired || [])
    .map((item) => publicCopy(item))
    .filter((item) => item && !WEAK_PLACEHOLDER_PATTERN.test(item) && !SOURCE_COPY_PATTERN.test(item));

  return items.length ? items : ['简历', '成绩单 / 排名证明', '个人陈述', '推荐信或导师推荐材料'];
}

function formatEventRange(start: string, end: string) {
  const startText = formatNoticeDate(start, '');
  const endText = formatNoticeDate(end, '');

  if (startText && endText) {
    return `${startText} 至 ${endText}`;
  }

  return startText || endText || '待学院后续安排';
}

function cleanChangeText(value: string) {
  return publicCopy(value)
    .replace(/从公开通知录入基础项目字段。?/, '完成基础字段整理。')
    .replace(/录入基础项目字段。?/, '完成基础字段整理。')
    .replace(INTERNAL_CHANGE_ID_PATTERN, '')
    .replace(INTERNAL_CHANGE_ENUM_PATTERN, '')
    .replace(/\s+([，。；：])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/[，、；：]\s*$/g, '')
    .trim();
}

function toPublicChangeRecord(item: { date: string; field: string; change: string }): PublicChangeRecord | null {
  const fieldKey = compactText(item.field).toLowerCase();
  const label = PUBLIC_CHANGE_FIELD_LABELS[fieldKey];
  if (!label) return null;

  const change = cleanChangeText(item.change);
  if (!change) return null;

  return {
    date: item.date,
    label,
    change
  };
}

export function NoticeDetailView({ project, returnHref = '/notices' }: NoticeDetailViewProps) {
  const departmentName = getDisplayNoticeDepartment(project);
  const schoolName = getDisplaySchoolName(project.schoolName);
  const title = normalizeNoticeTitle(project.projectName, 92);
  const originalLink = getNoticeOriginalLink(project);
  const applicationLink = getNoticeApplicationLink(project);
  const deadlineLevel = getDeadlineLevelFromDate(project.deadlineDate);
  const isExpired = deadlineLevel === 'expired';
  const tags = getDisplayTags(project.tags).slice(0, 4);
  const materialItems = getMaterialItems(project);
  const publicChangeLog = project.changeLog
    .map(toPublicChangeRecord)
    .filter((item): item is PublicChangeRecord => Boolean(item));
  const requirementText = getDetailText(
    project.requirements,
    '这条通知暂未拆出单独的申请条件。建议先关注学院、项目阶段和截止时间，并在全部申请中补充个人判断。',
    project
  );
  const examText = getDetailText(
    project.examInterviewInfo,
    '暂未整理出明确的笔试 / 面试安排。后续如有考核、入营或复试通知，可以在全部申请中继续补充。',
    project
  );
  const contactText = getDetailText(
    project.contactInfo,
    '通知中暂未整理出明确联系方式。建议通过学院公开联系方式或报名系统进一步确认。',
    project
  );
  const remarksText = getDetailText(
    project.remarks,
    '建议加入申请后，按自己的申请节奏补充材料状态、备注和后续动作。',
    project
  );

  return (
    <div className="desktop-notice-detail-page space-y-7">
      <Link
        href={returnHref}
        className="desktop-notice-detail-back inline-flex items-center gap-2 text-sm font-semibold text-brand"
      >
        <ArrowLeft className="h-4 w-4" />
        返回通知库
      </Link>

      <section className="desktop-notice-detail-header page-hero min-h-0 px-6 py-8 md:px-8 lg:px-10">
        <div className="desktop-notice-detail-header-row flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="desktop-notice-detail-heading max-w-3xl">
            <div className="desktop-notice-detail-eyebrow inline-flex rounded-full bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand shadow-sm">
              通知详情
            </div>
            <h1 className="desktop-notice-detail-title mt-4 max-w-4xl text-3xl font-semibold leading-tight tracking-tight text-ink md:text-5xl">
              {schoolName} · {title}
            </h1>
            <p className="desktop-notice-detail-subtitle mt-4 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
              {isExpired
                ? '已整理学校、学院、项目阶段、截止时间与材料清单，可作为后续申请的历史参考。'
                : '已整理学校、学院、项目阶段、截止时间、材料清单和后续入口，适合直接加入申请继续推进。'}
            </p>
          </div>
          <div className="desktop-notice-detail-hero-stats grid min-w-[260px] grid-cols-2 gap-3">
            <HeroStat icon={Clock3} label="截止倒计时" value={getCountdownLabel(project.deadlineDate)} tone="strong" />
            <HeroStat icon={FileText} label="项目阶段" value={getDisplayProjectType(project.projectType)} />
          </div>
        </div>
      </section>

      <section className="desktop-notice-detail-layout grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="desktop-notice-detail-reading grid gap-6">
          <section className="desktop-notice-detail-section desktop-notice-detail-overview rounded-[30px] border border-black/5 bg-white p-6 shadow-soft md:p-7">
            <div className="desktop-notice-detail-identity mb-5 flex flex-wrap items-center gap-4">
              <ExternalSiteMark
                source={resolveNoticeLogoSource(project)}
                label={schoolName}
                size="xl"
                rounded="full"
              />
              <div className="desktop-notice-detail-identity-copy">
                <div className="desktop-notice-detail-department text-sm font-semibold text-slate-500">{departmentName}</div>
                <div className="desktop-notice-detail-school mt-1 text-2xl font-semibold text-ink">{schoolName}</div>
              </div>
            </div>

            <div className="desktop-notice-detail-badges flex flex-wrap items-center gap-2">
              <DeadlineBadge level={deadlineLevel} />
              <StatusBadge status={project.status} />
              <span className="rounded-full bg-brand-cream px-3 py-1 text-xs font-semibold text-slate-700">
                {getDisplayProjectType(project.projectType)}
              </span>
              {tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                  {tag}
                </span>
              ))}
            </div>

            <div className="desktop-notice-detail-info-grid mt-6 grid gap-4 md:grid-cols-2">
              <InfoItem label="学校" value={schoolName} />
              <InfoItem label="学院 / 系" value={departmentName} />
              <InfoItem label="学科方向" value={getDisplayDiscipline(project.discipline)} />
              <InfoItem label="发布时间" value={formatNoticeDateOnly(project.publishDate)} />
              <InfoItem label="截止时间" value={formatNoticeDate(project.deadlineDate)} />
              <InfoItem label="活动时间" value={formatEventRange(project.eventStartDate, project.eventEndDate)} />
            </div>
          </section>

          <ContentCard icon={CheckCircle2} title="申请条件">
            <p>{requirementText}</p>
          </ContentCard>

          <ContentCard icon={FileCheck2} title="材料清单">
            <div className="desktop-notice-detail-material-list grid gap-3 md:grid-cols-2">
              {materialItems.map((item) => (
                <div
                  key={item}
                  className="desktop-notice-detail-material-row flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-slate-700"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </ContentCard>

          <ContentCard icon={CalendarDays} title="笔试 / 面试说明">
            <p>{examText}</p>
          </ContentCard>

          <ContentCard icon={MessageCircle} title="联系方式与备注">
            <div className="desktop-notice-detail-contact-grid grid gap-4 md:grid-cols-2">
              <InfoItem label="联系方式" value={contactText} />
              <InfoItem label="备注" value={remarksText} />
            </div>
          </ContentCard>

          <ContentCard icon={History} title="历史记录参考">
            <div className="desktop-notice-detail-history-list grid gap-3">
              {project.historyRecords.length ? (
                project.historyRecords.map((item) => (
                  <div
                    key={`${project.id}-${item.year}`}
                    className="desktop-notice-detail-history-row rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600"
                  >
                    <div className="font-semibold text-ink">{item.year} 年</div>
                    <div className="mt-2">发布时间：{formatNoticeDateOnly(item.publishDate)}</div>
                    <div className="mt-1">截止时间：{formatNoticeDate(item.deadlineDate)}</div>
                    <div className="mt-2 leading-7">{publicCopy(item.summary)}</div>
                  </div>
                ))
              ) : (
                <div className="desktop-notice-detail-history-row desktop-notice-detail-empty-row rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
                  暂无结构化往年记录。后续会逐步补齐同院校、同学院的时间线，帮助判断发布节奏。
                </div>
              )}
            </div>
          </ContentCard>
        </div>

        <aside className="desktop-notice-detail-sidebar space-y-6">
          <section className="desktop-notice-detail-action-panel rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
            <div className="desktop-notice-detail-sidebar-title text-lg font-semibold text-ink">下一步</div>
            <div className="desktop-notice-detail-actions mt-4 grid gap-3">
              {!isExpired ? (
                <ApplicationActionButton projectId={project.id} label="加入申请" />
              ) : (
                <div className="desktop-notice-detail-expired-note" role="status">
                  项目已截止，可查看完整通知并留作历史参考。
                </div>
              )}
              {originalLink ? (
                <a
                  href={originalLink}
                  target="_blank"
                  rel="noreferrer"
                  className="desktop-notice-detail-action inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  查看完整通知
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              ) : null}
              {applicationLink && !isExpired ? (
                <a
                  href={applicationLink}
                  target="_blank"
                  rel="noreferrer"
                  className="desktop-notice-detail-action inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-brand shadow-sm"
                >
                  打开报名入口
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              ) : null}
              <Link
                href="/deadlines"
                className="desktop-notice-detail-action inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
              >
                查看截止提醒
              </Link>
            </div>
          </section>

          <section className="desktop-notice-detail-update-panel rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
            <div className="desktop-notice-detail-sidebar-title text-lg font-semibold text-ink">更新记录</div>
            <div className="desktop-notice-detail-update-list mt-4 space-y-3">
              {publicChangeLog.length ? (
                publicChangeLog.slice(0, 4).map((item) => (
                  <div
                    key={`${item.date}-${item.label}`}
                    className="desktop-notice-detail-update-row rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600"
                  >
                    <div className="font-semibold text-ink">
                      {formatNoticeDate(item.date)} · {item.label}
                    </div>
                    <div className="mt-2 leading-7">{item.change}</div>
                  </div>
                ))
              ) : (
                <div className="desktop-notice-detail-update-row desktop-notice-detail-empty-row rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
                  暂无公开更新记录。若你发现截止时间、入口或材料要求变化，可以加入 QQ 群 {QQ_GROUP_NUMBER} 告诉我们。
                </div>
              )}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}

function HeroStat({
  icon: Icon,
  label,
  value,
  tone = 'default'
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  tone?: 'default' | 'strong';
}) {
  return (
    <div className={tone === 'strong' ? 'rounded-3xl bg-brand px-4 py-4 text-white shadow-soft' : 'rounded-3xl bg-white/85 px-4 py-4 text-ink shadow-soft'}>
      <div className="flex items-center gap-3">
        <span className={tone === 'strong' ? 'rounded-2xl bg-white/15 p-2' : 'rounded-2xl bg-brand-mint p-2 text-brand'}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <div className={tone === 'strong' ? 'text-xs text-white/75' : 'text-xs text-slate-500'}>{label}</div>
          <div className="mt-1 text-lg font-semibold">{value}</div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="desktop-notice-detail-info-row rounded-2xl bg-slate-50 px-4 py-4">
      <div className="text-sm font-semibold text-ink">{label}</div>
      <div className="mt-2 text-sm leading-7 text-slate-600">{value || '待补充'}</div>
    </div>
  );
}

function ContentCard({
  icon: Icon,
  title,
  children
}: {
  icon: typeof FileText;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="desktop-notice-detail-section rounded-[30px] border border-black/5 bg-white p-6 text-sm leading-7 text-slate-600 shadow-soft md:p-7">
      <div className="desktop-notice-detail-section-heading mb-4 flex items-center gap-3">
        <span className="desktop-notice-detail-section-icon inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-mint text-brand">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}
