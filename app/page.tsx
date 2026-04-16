'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BellRing, BookMarked, BriefcaseBusiness, ShieldAlert } from 'lucide-react';
import { DeadlineBadge } from '@/components/status-badge';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { SiteShell } from '@/components/site-shell';
import { fetchPublicNotices } from '@/lib/cloudbase-data';
import { buildNoticeDetailHref } from '@/lib/notice-links';
import { collegeDirectory } from '@/lib/college-directory';
import { offerFeedItems, officialResourceSections } from '@/lib/portal-data';
import type { PublicNoticeProject } from '@/lib/mock-data';

const warningOrder: Array<PublicNoticeProject['deadlineLevel']> = ['today', 'within3days', 'within7days'];

function warningLabel(level: PublicNoticeProject['deadlineLevel']) {
  if (level === 'today') return '今日截止';
  if (level === 'within3days') return '3 天内截止';
  return '7 天内截止';
}

export default function HomePage() {
  const [projects, setProjects] = useState<PublicNoticeProject[]>([]);

  useEffect(() => {
    let active = true;

    fetchPublicNotices().then((rows) => {
      if (active) {
        setProjects(rows);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const latestProjects = useMemo(
    () => [...projects].sort((left, right) => right.publishDate.localeCompare(left.publishDate)).slice(0, 5),
    [projects]
  );

  const warningGroups = useMemo(
    () =>
      warningOrder.map((level) => ({
        level,
        label: warningLabel(level),
        items: projects
          .filter((item) => item.deadlineLevel === level)
          .sort((left, right) => left.deadlineDate.localeCompare(right.deadlineDate))
          .slice(0, 3)
      })),
    [projects]
  );

  const resourcePreview = officialResourceSections.flatMap((section) => section.links).slice(0, 4);
  const offerPreview = [...offerFeedItems].sort((left, right) => right.heat - left.heat).slice(0, 4);
  const collegePreview = collegeDirectory.slice(0, 6);

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-[1240px] space-y-6">
        <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
          <div className="surface-card rounded-[34px] p-8 lg:p-10">
            <div className="eyebrow">Seekoffer Product</div>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-ink md:text-5xl">
              把分散的保研信息，整理成清晰的申请路径
            </h1>
            <p className="mt-5 max-w-3xl text-[15px] leading-8 text-slate-600">
              Seekoffer 聚合院校通知、梳理关键时间节点、沉淀申请过程，帮助你从“到处找信息”走向“有节奏地准备申请”。
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/notices"
                className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white"
              >
                进入通知库
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/me"
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700"
              >
                打开工作台
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                ['通知不再四处找', '集中整理夏令营、预推免和招生动态，减少信息遗漏。'],
                ['申请进度一目了然', '把截止时间、申请状态和材料准备收进同一套流程。'],
                ['从焦虑刷信息，到从容做决定', '不仅看到新通知，也知道哪些节点该优先处理。']
              ].map(([title, description]) => (
                <div key={title} className="rounded-[26px] bg-slate-50 px-5 py-5">
                  <div className="text-lg font-semibold text-ink">{title}</div>
                  <p className="mt-3 text-sm leading-7 text-slate-500">{description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[30px] bg-brand p-6 text-white shadow-hero">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-white/85">
                <ShieldAlert className="h-4 w-4" />
                智能防漏预警
              </div>
              <h2 className="mt-4 text-2xl font-semibold">先把今天和本周最危险的节点捞出来。</h2>
              <p className="mt-3 text-sm leading-7 text-white/75">
                今日截止、3 天内截止和 7 天内截止会单独抬高，帮助你优先处理最不能漏掉的项目。
              </p>
            </div>

            {warningGroups.map((group) => (
              <div key={group.level} className="surface-card rounded-[28px] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-semibold text-ink">{group.label}</div>
                  <span className="rounded-full bg-brand-cream px-3 py-1 text-xs font-semibold text-brand">
                    {group.items.length} 项
                  </span>
                </div>

                <div className="mt-4 grid gap-3">
                  {group.items.length ? (
                    group.items.map((project) => (
                      <Link
                        key={project.id}
                        href={buildNoticeDetailHref(project.id)}
                        className="rounded-2xl bg-slate-50 px-4 py-4 transition hover:bg-slate-100"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-ink">{project.schoolName}</div>
                            <div className="mt-1 truncate text-xs text-slate-500">{project.projectName}</div>
                          </div>
                          <DeadlineBadge level={project.deadlineLevel} />
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-black/10 px-4 py-4 text-sm text-slate-500">
                      当前没有 {group.label} 的项目。
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <div className="surface-card rounded-[34px] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                  <BellRing className="h-4 w-4" />
                  最新通知
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-500">先看最近同步的重要项目，按发布时间倒序排列。</p>
              </div>
              <Link href="/notices" className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                查看全部
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5 grid gap-4">
              {latestProjects.map((project) => (
                <Link
                  key={project.id}
                  href={buildNoticeDetailHref(project.id)}
                  className="rounded-[26px] bg-slate-50 px-5 py-5 transition hover:bg-slate-100"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <DeadlineBadge level={project.deadlineLevel} />
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
                      {project.publishDate}
                    </span>
                    <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                      {project.projectType}
                    </span>
                  </div>
                  <div className="mt-4 text-lg font-semibold text-ink">{project.schoolName}</div>
                  <div className="mt-2 text-sm leading-7 text-slate-600">{project.projectName}</div>
                  <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-500">
                    <span>{project.departmentName}</span>
                    <span>截止：{project.deadlineDate}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="surface-card rounded-[30px] p-6">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                <BriefcaseBusiness className="h-4 w-4" />
                工作台入口
              </div>
              <h3 className="mt-4 text-2xl font-semibold text-ink">把申请状态、材料进度和待办收进同一处。</h3>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                进入工作台后，可以继续管理我的申请表、行动清单、材料状态和个人申请节奏。
              </p>
              <Link
                href="/me"
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white"
              >
                打开工作台
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="surface-card rounded-[30px] p-6">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                <BookMarked className="h-4 w-4" />
                资源速览
              </div>
              <div className="mt-5 grid gap-3">
                {resourcePreview.map((item) => (
                  <a
                    key={item.title}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-4 transition hover:bg-slate-100"
                  >
                    <ExternalSiteMark source={item.href} label={item.title} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink">{item.title}</div>
                      <div className="mt-1 truncate text-xs text-slate-500">{item.badge}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid items-start gap-6 xl:grid-cols-2">
          <div className="surface-card rounded-[34px] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">院校库预览</div>
                <p className="mt-2 text-sm leading-7 text-slate-500">官方直达始终是核验原始信息最稳的一层。</p>
              </div>
              <Link href="/colleges" className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                去院校库
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {collegePreview.map((item) => (
                <a
                  key={item.name}
                  href={item.website}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-[26px] bg-slate-50 p-5 transition hover:bg-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <ExternalSiteMark source={item.website} label={item.name} size="md" rounded="full" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink">{item.name}</div>
                      <div className="mt-1 truncate text-xs text-slate-500">{item.groups.slice(0, 2).join(' / ')}</div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className="surface-card rounded-[34px] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">Offer 池热度</div>
                <p className="mt-2 text-sm leading-7 text-slate-500">先看高热讨论，快速判断补录窗口与志愿流向。</p>
              </div>
              <Link href="/offers" className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                去 Offer 池
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5 grid gap-3">
              {offerPreview.map((item) => (
                <div key={item.id} className="rounded-[24px] bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-ink">{item.school}</div>
                    <span className="rounded-full bg-brand-cream px-3 py-1 text-xs font-semibold text-brand">
                      热度 {item.heat}
                    </span>
                  </div>
                  <div className="mt-2 text-sm leading-7 text-slate-600">{item.message}</div>
                  <div className="mt-3 text-xs text-slate-400">
                    {item.giveUp} → {item.goTo}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
