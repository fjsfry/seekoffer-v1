'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  BookMarked,
  BriefcaseBusiness,
  Compass,
  GraduationCap,
  HeartHandshake,
  ShieldCheck
} from 'lucide-react';
import { DeadlineBadge } from '@/components/status-badge';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { SiteShell } from '@/components/site-shell';
import { fetchPublicNotices } from '@/lib/cloudbase-data';
import { buildNoticeDetailHref } from '@/lib/notice-links';
import { collegeDirectory } from '@/lib/college-directory';
import { offerFeedItems, officialResourceSections } from '@/lib/portal-data';
import type { PublicNoticeProject } from '@/lib/mock-data';

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
    () => [...projects].sort((left, right) => right.publishDate.localeCompare(left.publishDate)).slice(0, 6),
    [projects]
  );

  const riskProjects = useMemo(
    () =>
      projects
        .filter((item) => ['today', 'within3days', 'within7days'].includes(item.deadlineLevel))
        .sort((left, right) => left.deadlineDate.localeCompare(right.deadlineDate))
        .slice(0, 5),
    [projects]
  );

  const resourcePreview = officialResourceSections.flatMap((section) => section.links).slice(0, 4);
  const collegePreview = collegeDirectory.slice(0, 4);
  const offerPreview = [...offerFeedItems].sort((left, right) => right.heat - left.heat).slice(0, 4);

  const heroMetrics = [
    { label: '通知覆盖', value: projects.length ? `${projects.length}+` : '--', hint: '持续同步中' },
    { label: '重点院校', value: `${collegeDirectory.length}`, hint: '院校官网直达' },
    { label: '工具入口', value: `${officialResourceSections.flatMap((item) => item.links).length}`, hint: '资源库沉淀' },
    { label: '高危提醒', value: `${riskProjects.length}`, hint: '本周优先处理' }
  ];

  const valueCards = [
    {
      title: '通知不再四处找',
      description: '集中同步夏令营、预推免和招生动态，减少反复搜索和群里蹲消息。',
      icon: BellRing
    },
    {
      title: '申请进度更清楚',
      description: '把项目、截止时间、材料状态和动作沉淀到同一条申请路径里。',
      icon: ShieldCheck
    },
    {
      title: '资源与官网稳定可回访',
      description: '资源库和院校库优先服务“随时回去核对官方信息”这件事。',
      icon: Compass
    }
  ];

  return (
    <SiteShell>
      <div className="grid w-full gap-8">
        <section className="surface-card rounded-[38px] p-7 lg:p-10">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_400px]">
            <div className="space-y-7">
              <div className="eyebrow">Seekoffer Product</div>

              <div className="space-y-4">
                <h1 className="max-w-5xl text-4xl font-semibold tracking-tight text-ink md:text-5xl xl:text-6xl">
                  把分散的保研信息，整理成清晰的申请路径
                </h1>
                <p className="max-w-4xl text-[15px] leading-8 text-slate-600">
                  Seekoffer 聚合院校通知、梳理关键时间节点、沉淀申请过程，帮助你从“到处找信息”走向“有节奏地准备申请”。
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
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

              <div className="grid gap-4 lg:grid-cols-3">
                {valueCards.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div key={item.title} className="rounded-[28px] bg-slate-50 px-5 py-5">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="mt-4 text-lg font-semibold text-ink">{item.title}</div>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[30px] bg-brand px-6 py-6 text-white shadow-hero">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-white/80">
                  <BriefcaseBusiness className="h-4 w-4" />
                  产品定位
                </div>
                <div className="mt-4 text-2xl font-semibold leading-tight">先找到值得关注的通知，再把申请节奏稳稳接住。</div>
                <div className="mt-5 grid gap-3 text-sm leading-7 text-white/80">
                  <div className="rounded-[22px] bg-white/10 px-4 py-3">通知库负责发现机会，工作台负责管理项目、材料和行动。</div>
                  <div className="rounded-[22px] bg-white/10 px-4 py-3">资源库和院校库负责长期回访官方入口，不再重复搜索。</div>
                </div>
              </div>

              <div className="surface-card rounded-[30px] p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  {heroMetrics.map((item) => (
                    <div key={item.label} className="rounded-[24px] bg-slate-50 px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{item.label}</div>
                      <div className="mt-3 text-3xl font-semibold text-ink">{item.value}</div>
                      <div className="mt-2 text-sm text-slate-500">{item.hint}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_400px]">
          <div className="surface-card rounded-[34px] p-6 lg:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                  <BellRing className="h-4 w-4" />
                  最新通知
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-500">优先把标题和关键时间看清楚，再进入详情页核对原文。</p>
              </div>
              <Link href="/notices" className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                查看全部
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5 grid gap-4">
              {latestProjects.length ? (
                latestProjects.map((project) => (
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
                    <div className="mt-4 text-base font-semibold text-ink">{project.schoolName}</div>
                    <div className="mt-2 text-lg font-semibold leading-8 text-ink">{project.projectName}</div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                      <span>{project.departmentName}</span>
                      <span>截止：{project.deadlineDate}</span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-[26px] border border-dashed border-black/10 px-5 py-12 text-center text-sm text-slate-500">
                  正在同步最新通知，请稍后刷新页面查看。
                </div>
              )}
            </div>
          </div>

          <div className="surface-card rounded-[34px] p-6 lg:p-7">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand">
              <AlertTriangle className="h-4 w-4" />
              高危提醒
            </div>
            <div className="mt-2 text-sm leading-7 text-slate-500">先处理今天、3 天内和 7 天内截止的项目，避免真正重要的节点被错过。</div>

            <div className="mt-5 grid gap-3">
              {riskProjects.length ? (
                riskProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={buildNoticeDetailHref(project.id)}
                    className="rounded-[24px] bg-slate-50 px-4 py-4 transition hover:bg-slate-100"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate text-sm font-semibold text-ink">{project.schoolName}</div>
                      <DeadlineBadge level={project.deadlineLevel} />
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-600">{project.projectName}</div>
                    <div className="mt-3 text-xs text-slate-400">截止：{project.deadlineDate}</div>
                  </Link>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-black/10 px-4 py-10 text-sm text-slate-500">
                  当前没有高危项目，等新的截止节点同步后，这里会优先提醒。
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-4">
          <div className="surface-card rounded-[34px] p-6">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <BriefcaseBusiness className="h-4 w-4" />
              工作台
            </div>
            <div className="mt-3 text-2xl font-semibold text-ink">把项目、材料和动作放到一条线里。</div>
            <div className="mt-4 grid gap-3 text-sm leading-7 text-slate-600">
              <div className="rounded-[22px] bg-slate-50 px-4 py-3">管理申请表、待办和材料进度。</div>
              <div className="rounded-[22px] bg-slate-50 px-4 py-3">通知加入后，工作台会持续接住后续动作。</div>
            </div>
            <Link
              href="/me"
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white"
            >
              打开工作台
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="surface-card rounded-[34px] p-6">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <BookMarked className="h-4 w-4" />
              资源库
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
                  <ExternalSiteMark source={item.href} label={item.title} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">{item.title}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">{item.badge}</div>
                  </div>
                </a>
              ))}
            </div>
            <Link href="/resources" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand">
              去资源库
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="surface-card rounded-[34px] p-6">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <GraduationCap className="h-4 w-4" />
              院校库
            </div>
            <div className="mt-5 grid gap-3">
              {collegePreview.map((item) => (
                <a
                  key={item.name}
                  href={item.website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-4 transition hover:bg-slate-100"
                >
                  <ExternalSiteMark source={item.website} label={item.name} size="lg" rounded="full" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">{item.name}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">{item.city}</div>
                  </div>
                </a>
              ))}
            </div>
            <Link href="/colleges" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand">
              去院校库
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="surface-card rounded-[34px] p-6">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <HeartHandshake className="h-4 w-4" />
              Offer 池
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
                </div>
              ))}
            </div>
            <Link href="/offers" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand">
              去 Offer 池
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
