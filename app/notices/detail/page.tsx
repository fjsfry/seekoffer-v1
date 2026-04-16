'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight, Clock3, History, ShieldCheck } from 'lucide-react';
import { NoticeWorkbenchPanel } from '@/components/notice-workbench-panel';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { DeadlineBadge, StatusBadge } from '@/components/status-badge';
import { fetchNoticeById } from '@/lib/cloudbase-data';
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

  return `距截止约 ${hours} 小时`;
}

function NoticeDetailQueryContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') || '';
  const [project, setProject] = useState<PublicNoticeProject | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!id) {
        if (active) {
          setProject(null);
          setReady(true);
        }
        return;
      }

      const detail = await fetchNoticeById(id);
      if (active) {
        setProject(detail);
        setReady(true);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [id]);

  if (!ready) {
    return (
      <SiteShell>
        <PageSectionTitle eyebrow="Notice Detail" title="通知详情" subtitle="正在加载项目详情，请稍等。" />
      </SiteShell>
    );
  }

  if (!project) {
    return (
      <SiteShell>
        <PageSectionTitle
          eyebrow="Notice Detail"
          title="未找到这条通知"
          subtitle="这条通知可能尚未同步完成，或者链接中的项目编号不正确。"
        />
        <section className="surface-card rounded-[34px] p-8 text-center">
          <Link href="/notices" className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white">
            返回通知库
          </Link>
        </section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <PageSectionTitle
        eyebrow="Project Detail"
        title={`${project.schoolName} · ${project.projectName}`}
        subtitle="不仅看通知本身，也把材料、提醒、备注和工作台动作直接接在这一页。"
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-6">
          <section className="surface-card rounded-[34px] p-6">
            <div className="flex flex-wrap items-center gap-2">
              <DeadlineBadge level={project.deadlineLevel} />
              <StatusBadge status={project.status} />
              <span className="rounded-full bg-brand-cream px-3 py-1 text-xs font-semibold text-brand">
                {project.projectType}
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <InfoItem label="学校" value={project.schoolName} />
              <InfoItem label="学院 / 系" value={project.departmentName} />
              <InfoItem label="学科方向" value={project.discipline} />
              <InfoItem label="发布时间" value={project.publishDate} />
              <InfoItem label="截止时间" value={project.deadlineDate} />
              <InfoItem label="活动时间" value={`${project.eventStartDate} 至 ${project.eventEndDate}`} />
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
              {project.materialsRequired.map((item) => (
                <li key={item} className="rounded-2xl bg-slate-50 px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </ContentCard>

          <ContentCard title="笔试 / 面试说明">
            <p>{project.examInterviewInfo}</p>
          </ContentCard>

          <ContentCard title="联系方式与备注">
            <div className="grid gap-4 md:grid-cols-2">
              <InfoItem label="联系方式" value={project.contactInfo} />
              <InfoItem label="备注" value={project.remarks} />
            </div>
          </ContentCard>

          {project.historyRecords.length ? (
            <ContentCard title="历史记录参考">
              <div className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-brand">
                <History className="h-4 w-4" />
                往年规律
              </div>
              <div className="grid gap-3">
                {project.historyRecords.map((item) => (
                  <div key={`${project.id}-${item.year}`} className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    <div className="font-semibold text-ink">{item.year} 年</div>
                    <div className="mt-2">发布时间：{item.publishDate}</div>
                    <div className="mt-1">截止时间：{item.deadlineDate}</div>
                    <div className="mt-2 leading-7">{item.summary}</div>
                  </div>
                ))}
              </div>
            </ContentCard>
          ) : null}
        </div>

        <aside className="space-y-6">
          <NoticeWorkbenchPanel projectId={project.id} />

          <section className="surface-card rounded-[32px] p-6">
            <div className="text-lg font-semibold text-ink">官方入口</div>
            <div className="mt-4 grid gap-3">
              <a
                href={project.applyLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white"
              >
                打开报名入口
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <a
                href={project.sourceLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                查看原文详情
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </section>

          <section className="surface-card rounded-[32px] p-6">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <ShieldCheck className="h-4 w-4" />
              数据来源标识
            </div>
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <InfoItem label="来源网站" value={project.sourceSite} />
              <InfoItem label="平台录入时间" value={project.collectedAt} />
              <InfoItem label="最近更新时间" value={project.updatedAt} />
              <InfoItem label="最近核验时间" value={project.lastCheckedAt} />
              <InfoItem label="人工校验" value={project.isVerified ? '已校验' : '待校验'} />
            </div>
          </section>
        </aside>
      </section>
    </SiteShell>
  );
}

export default function NoticeDetailQueryPage() {
  return (
    <Suspense
      fallback={
        <SiteShell>
          <PageSectionTitle eyebrow="Notice Detail" title="通知详情" subtitle="正在加载项目详情，请稍等。" />
        </SiteShell>
      }
    >
      <NoticeDetailQueryContent />
    </Suspense>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-4">
      <div className="text-sm font-semibold text-ink">{label}</div>
      <div className="mt-2 text-sm leading-7 text-slate-600">{value}</div>
    </div>
  );
}

function ContentCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface-card rounded-[34px] p-6 text-sm leading-7 text-slate-600">
      <div className="mb-4 text-lg font-semibold text-ink">{title}</div>
      {children}
    </section>
  );
}
