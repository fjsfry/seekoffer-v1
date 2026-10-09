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
  MessageCircle,
  ShieldCheck
} from 'lucide-react';
import { ApplicationActionButton } from '@/components/application-action-button';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { DeadlineBadge, StatusBadge } from '@/components/status-badge';
import { QQ_GROUP_NUMBER, QQ_GROUP_URL } from '@/lib/contact';
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
    .replace(/录入基础项目字段。?/, '完成基础字段整理。');
}

export function NoticeDetailView({ project, returnHref = '/notices' }: NoticeDetailViewProps) {
  const departmentName = getDisplayNoticeDepartment(project);
  const schoolName = getDisplaySchoolName(project.schoolName);
  const title = normalizeNoticeTitle(project.projectName, 92);
  const originalLink = getNoticeOriginalLink(project);
  const applicationLink = getNoticeApplicationLink(project);
  const tags = getDisplayTags(project.tags).slice(0, 4);
  const materialItems = getMaterialItems(project);
  const requirementText = getDetailText(
    project.requirements,
    '这条通知暂未拆出单独的申请条件。建议先关注学院、项目阶段和截止时间，并在工作台里补充个人判断。',
    project
  );
  const examText = getDetailText(
    project.examInterviewInfo,
    '暂未整理出明确的笔试 / 面试安排。后续如有考核、入营或复试通知，可以在工作台继续补充。',
    project
  );
  const contactText = getDetailText(
    project.contactInfo,
    '通知中暂未整理出明确联系方式。建议通过学院公开联系方式或报名系统进一步确认。',
    project
  );
  const remarksText = getDetailText(
    project.remarks,
    '建议收藏到工作台后，按自己的申请节奏补充材料状态、备注和后续动作。',
    project
  );

  return (
    <div className="space-y-7">
      <Link href={returnHref} className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
        <ArrowLeft className="h-4 w-4" />
        返回通知库
      </Link>

      <section className="page-hero min-h-0 px-6 py-8 md:px-8 lg:px-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand shadow-sm">
              通知详情
            </div>
            <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-tight tracking-tight text-ink md:text-5xl">
              {schoolName} · {title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
              已整理学校、学院、项目阶段、截止时间、材料清单和后续入口，适合直接加入工作台继续推进。
            </p>
          </div>
          <div className="grid min-w-[260px] grid-cols-2 gap-3">
            <HeroStat icon={Clock3} label="截止倒计时" value={getCountdownLabel(project.deadlineDate)} tone="strong" />
            <HeroStat icon={FileText} label="项目阶段" value={getDisplayProjectType(project.projectType)} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="grid gap-6">
          <section className="rounded-[30px] border border-black/5 bg-white p-6 shadow-soft md:p-7">
            <div className="mb-5 flex flex-wrap items-center gap-4">
              <ExternalSiteMark
                source={resolveNoticeLogoSource(project)}
                label={schoolName}
                size="xl"
                rounded="full"
              />
              <div>
                <div className="text-sm font-semibold text-slate-500">{departmentName}</div>
                <div className="mt-1 text-2xl font-semibold text-ink">{schoolName}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <DeadlineBadge level={getDeadlineLevelFromDate(project.deadlineDate)} />
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

            <div className="mt-6 grid gap-4 md:grid-cols-2">
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
            <div className="grid gap-3 md:grid-cols-2">
              {materialItems.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-slate-700">
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
            <div className="grid gap-4 md:grid-cols-2">
              <InfoItem label="联系方式" value={contactText} />
              <InfoItem label="备注" value={remarksText} />
            </div>
          </ContentCard>

          <ContentCard icon={History} title="历史记录参考">
            <div className="grid gap-3">
              {project.historyRecords.length ? (
                project.historyRecords.map((item) => (
                  <div key={`${project.id}-${item.year}`} className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    <div className="font-semibold text-ink">{item.year} 年</div>
                    <div className="mt-2">发布时间：{formatNoticeDateOnly(item.publishDate)}</div>
                    <div className="mt-1">截止时间：{formatNoticeDate(item.deadlineDate)}</div>
                    <div className="mt-2 leading-7">{publicCopy(item.summary)}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
                  暂无结构化往年记录。后续会逐步补齐同院校、同学院的时间线，帮助判断发布节奏。
                </div>
              )}
            </div>
          </ContentCard>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
            <div className="text-lg font-semibold text-ink">下一步</div>
            <div className="mt-4 grid gap-3">
              <ApplicationActionButton projectId={project.id} label="加入工作台" />
              {originalLink ? (
                <a
                  href={originalLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  查看完整通知
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              ) : null}
              {applicationLink ? (
                <a
                  href={applicationLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-brand shadow-sm"
                >
                  打开报名入口
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              ) : null}
              <Link
                href="/deadlines"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
              >
                查看截止提醒
              </Link>
            </div>
          </section>

          <section className="rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <ShieldCheck className="h-4 w-4" />
              寻鹿整理说明
            </div>
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <InfoItem label="整理状态" value={project.isVerified ? '关键字段已整理' : '持续补充中'} />
              <InfoItem label="收录时间" value={formatNoticeDate(project.collectedAt)} />
              <InfoItem label="最近更新" value={formatNoticeDate(project.updatedAt || project.lastCheckedAt)} />
            </div>
            <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500">
              本页由寻鹿整理为申请视图，重点提取院校、学院、时间、材料和操作入口。正式提交前，请再次核对学校页面与报名系统。
            </p>
            <a
              href={QQ_GROUP_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800"
            >
              加 QQ 群反馈
            </a>
          </section>

          <section className="rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
            <div className="text-lg font-semibold text-ink">更新记录</div>
            <div className="mt-4 space-y-3">
              {project.changeLog.length ? (
                project.changeLog.slice(0, 4).map((item) => (
                  <div key={`${item.date}-${item.field}`} className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    <div className="font-semibold text-ink">
                      {formatNoticeDate(item.date)} · {publicCopy(item.field)}
                    </div>
                    <div className="mt-2 leading-7">{cleanChangeText(item.change)}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
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
    <div className="rounded-2xl bg-slate-50 px-4 py-4">
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
    <section className="rounded-[30px] border border-black/5 bg-white p-6 text-sm leading-7 text-slate-600 shadow-soft md:p-7">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-mint text-brand">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}
