'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, ArrowUpRight, Clock3, History, LoaderCircle, ShieldCheck } from 'lucide-react';
import { ApplicationActionButton } from '@/components/application-action-button';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { DeadlineBadge, StatusBadge } from '@/components/status-badge';
import { fetchPublicNotices } from '@/lib/cloudbase-data';
import {
  buildNoticeFeedbackHref,
  formatNoticeDate,
  formatNoticeDateOnly,
  getDisplayDepartmentName,
  getDisplayDiscipline,
  getDisplayProjectType,
  getDisplaySchoolName,
  getDisplaySourceLabel,
  getDisplayTags,
  getVerificationLabel,
  normalizeNoticeTitle
} from '@/lib/notice-display';
import { baseNoticeProjects } from '@/lib/notice-source';
import { resolveNoticeLogoSource } from '@/lib/school-mark-source';
import type { PublicNoticeProject } from '@/lib/mock-data';

function getCountdown(deadlineDate: string) {
  const value = new Date(`${deadlineDate.replace(' ', 'T')}:00+08:00`);
  const now = new Date();
  const diff = value.getTime() - now.getTime();

  if (Number.isNaN(value.getTime())) {
    return '截止时间待补充';
  }

  if (diff <= 0) {
    return '项目已截止';
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days >= 1) {
    return `距截止约 ${days} 天`;
  }

  return `距截止约 ${Math.max(hours, 1)} 小时`;
}

function NoticeDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') || '';
  const initialProject = useMemo(() => baseNoticeProjects.find((item) => item.id === id) || null, [id]);
  const [remoteState, setRemoteState] = useState<{
    id: string;
    project: PublicNoticeProject | null;
    message: string;
  }>({
    id: '',
    project: null,
    message: ''
  });
  const remoteReady = remoteState.id === id;
  const project = initialProject || (remoteReady ? remoteState.project : null);
  const loading = Boolean(id && !initialProject && !remoteReady);
  const message = remoteReady ? remoteState.message : '';

  useEffect(() => {
    if (!id || initialProject) {
      return;
    }

    let active = true;

    fetchPublicNotices()
      .then((rows) => {
        if (!active) {
          return;
        }

        const matchedProject = rows.find((item) => item.id === id) || null;
        setRemoteState({
          id,
          project: matchedProject,
          message: matchedProject ? '' : '没有在当前通知库中找到这条记录，可能已被合并或下线。'
        });
      })
      .catch(() => {
        if (active) {
          setRemoteState({
            id,
            project: null,
            message: '通知详情加载失败，请返回通知库重新打开，或通过反馈入口告诉我们。'
          });
        }
      });

    return () => {
      active = false;
    };
  }, [id, initialProject]);

  if (!id) {
    return (
      <DetailShell title="没有找到通知编号" subtitle="当前链接缺少通知编号，请返回通知库重新选择一条通知。">
        <EmptyDetailState href="/notices" label="返回通知库" />
      </DetailShell>
    );
  }

  if (loading) {
    return (
      <DetailShell title="正在加载通知详情" subtitle="正在从最新通知库读取项目详情，请稍等。">
        <section className="surface-card rounded-[34px] p-8">
          <div className="flex flex-col items-center justify-center gap-5 text-center">
            <LoaderCircle className="h-8 w-8 animate-spin text-brand" />
            <p className="max-w-xl text-sm leading-7 text-slate-600">
              如果这条通知刚刚由爬虫同步，详情页会优先从 Supabase 实时兜底读取。
            </p>
          </div>
        </section>
      </DetailShell>
    );
  }

  if (!project) {
    return (
      <DetailShell title="通知详情暂不可用" subtitle={message || '这条通知暂时无法打开。'}>
        <EmptyDetailState href="/notices" label="返回通知库" />
      </DetailShell>
    );
  }

  return <NoticeDetail project={project} />;
}

function DetailShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <SiteShell>
      <PageSectionTitle eyebrow="Notice Detail" title={title} subtitle={subtitle} />
      {children}
    </SiteShell>
  );
}

function EmptyDetailState({ href, label }: { href: string; label: string }) {
  return (
    <section className="surface-card rounded-[34px] p-8">
      <div className="flex flex-col items-center justify-center gap-5 text-center">
        <p className="max-w-xl text-sm leading-7 text-slate-600">
          我们没有让页面一直转圈，而是把异常状态直接告诉你。你可以先回到通知库重新选择，也可以反馈给我们核查。
        </p>
        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-float transition hover:-translate-y-0.5 hover:bg-brand-deep"
        >
          {label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function NoticeDetail({ project }: { project: PublicNoticeProject }) {
  const sourceLabel = getDisplaySourceLabel(project.sourceSite);

  return (
    <SiteShell>
      <Link href="/notices" className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
        <ArrowLeft className="h-4 w-4" />
        返回通知库
      </Link>

      <PageSectionTitle
        eyebrow="Notice Detail"
        title={`${getDisplaySchoolName(project.schoolName)} · ${normalizeNoticeTitle(project.projectName, 80)}`}
        subtitle="查看项目详情、截止时间、材料要求与原文入口，并可一键加入我的申请表。"
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="grid gap-6">
          <section className="rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
            <div className="mb-5 flex flex-wrap items-center gap-4">
              <ExternalSiteMark
                source={resolveNoticeLogoSource(project)}
                label={getDisplaySchoolName(project.schoolName)}
                size="xl"
                rounded="full"
              />
              <div>
                <div className="text-sm font-semibold text-slate-500">{getDisplayDepartmentName(project.departmentName)}</div>
                <div className="mt-1 text-2xl font-semibold text-ink">{getDisplaySchoolName(project.schoolName)}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <DeadlineBadge level={project.deadlineLevel} />
              <StatusBadge status={project.status} />
              <span className="rounded-full bg-brand-cream px-3 py-1 text-xs font-semibold text-slate-700">
                {getDisplayProjectType(project.projectType)}
              </span>
              {getDisplayTags(project.tags).slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <InfoItem label="学校" value={getDisplaySchoolName(project.schoolName)} />
              <InfoItem label="学院 / 系" value={getDisplayDepartmentName(project.departmentName)} />
              <InfoItem label="学科方向" value={getDisplayDiscipline(project.discipline)} />
              <InfoItem label="发布时间" value={formatNoticeDateOnly(project.publishDate)} />
              <InfoItem label="截止时间" value={formatNoticeDate(project.deadlineDate)} />
              <InfoItem label="活动时间" value={formatEventRange(project.eventStartDate, project.eventEndDate)} />
            </div>

            <div className="mt-5 rounded-2xl bg-brand-cream px-4 py-4 text-sm text-slate-700">
              <div className="inline-flex items-center gap-2 font-semibold text-brand">
                <Clock3 className="h-4 w-4" />
                截止倒计时
              </div>
              <div className="mt-2 text-lg font-semibold text-ink">{getCountdown(project.deadlineDate)}</div>
            </div>
          </section>

          <ContentCard title="申请条件">
            <p>{project.requirements}</p>
          </ContentCard>

          <ContentCard title="材料要求">
            <ul className="space-y-2">
              {project.materialsRequired.length ? (
                project.materialsRequired.map((item) => (
                  <li key={item} className="rounded-2xl bg-slate-50 px-4 py-3">
                    {item}
                  </li>
                ))
              ) : (
                <li className="rounded-2xl bg-slate-50 px-4 py-3">材料要求待补充，请以原文通知为准。</li>
              )}
            </ul>
          </ContentCard>

          <ContentCard title="笔试 / 面试说明">
            <p>{project.examInterviewInfo || '考核安排待补充，请以原文通知为准。'}</p>
          </ContentCard>

          <ContentCard title="联系方式与备注">
            <div className="grid gap-4 md:grid-cols-2">
              <InfoItem label="联系方式" value={project.contactInfo} />
              <InfoItem label="备注" value={project.remarks} />
            </div>
          </ContentCard>

          <ContentCard title="历史记录参考">
            <div className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <History className="h-4 w-4" />
              往年规律
            </div>
            <div className="grid gap-3">
              {project.historyRecords.length ? (
                project.historyRecords.map((item) => (
                  <div key={`${project.id}-${item.year}`} className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    <div className="font-semibold text-ink">{item.year} 年</div>
                    <div className="mt-2">发布时间：{item.publishDate}</div>
                    <div className="mt-1">截止时间：{item.deadlineDate}</div>
                    <div className="mt-2 leading-7">{item.summary}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  暂无结构化历史记录，后续会逐步补齐同院校、同学院的往年时间线。
                </div>
              )}
            </div>
          </ContentCard>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
            <div className="text-lg font-semibold text-ink">操作</div>
            <div className="mt-4 grid gap-3">
              <ApplicationActionButton projectId={project.id} />
              <a
                href={project.applyLink || project.sourceLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                打开原文入口
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <a
                href={buildNoticeFeedbackHref(project)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800"
              >
                反馈通知错误
              </a>
              <Link
                href="/deadlines"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
              >
                去看截止提醒
              </Link>
            </div>
          </section>

          <section className="rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <ShieldCheck className="h-4 w-4" />
              数据可信度
            </div>
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <InfoItem label="来源说明" value={sourceLabel} />
              <InfoItem label="平台录入时间" value={project.collectedAt} />
              <InfoItem label="最近更新时间" value={project.updatedAt} />
              <InfoItem label="最近核验时间" value={project.lastCheckedAt} />
              <InfoItem label="核验状态" value={getVerificationLabel(project)} />
            </div>
            <div className="mt-4 grid gap-2 text-xs leading-6 text-slate-500">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">截止时间：系统提取后持续校验，异常可反馈。</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">材料要求：以院校官网原文为最终依据。</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">纠错闭环：收到反馈后会进入核验队列。</div>
            </div>
          </section>

          <section className="rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
            <div className="text-lg font-semibold text-ink">变更记录</div>
            <div className="mt-4 space-y-3">
              {project.changeLog.length ? (
                project.changeLog.map((item) => (
                  <div key={`${item.date}-${item.field}`} className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    <div className="font-semibold text-ink">
                      {item.date} · {item.field}
                    </div>
                    <div className="mt-2 leading-7">{item.change}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
                  暂无公开变更记录。若你发现截止时间、入口或材料要求变化，可以直接反馈。
                </div>
              )}
            </div>
          </section>
        </aside>
      </section>
    </SiteShell>
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

function formatEventRange(start: string, end: string) {
  const startText = formatNoticeDate(start, '');
  const endText = formatNoticeDate(end, '');

  if (startText && endText) {
    return `${startText} 至 ${endText}`;
  }

  return startText || endText || '以原文通知为准';
}

function ContentCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[30px] border border-black/5 bg-white p-6 text-sm leading-7 text-slate-600 shadow-soft">
      <h2 className="mb-4 text-xl font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export default function NoticeDetailQueryPage() {
  return (
    <Suspense
      fallback={
        <SiteShell>
          <PageSectionTitle eyebrow="Notice Detail" title="正在打开通知详情" subtitle="正在准备详情页，请稍等。" />
        </SiteShell>
      }
    >
      <NoticeDetailContent />
    </Suspense>
  );
}
