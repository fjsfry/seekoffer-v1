'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BellRing,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  FolderOpen,
  GraduationCap,
  Grid3X3,
  Search,
  TrendingUp
} from 'lucide-react';
import { DeadlineBadge } from '@/components/status-badge';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { SiteShell } from '@/components/site-shell';
import { fetchPublicNotices } from '@/lib/cloudbase-data';
import {
  formatNoticeDateOnly,
  getDisplayDepartmentName,
  getDisplayProjectType,
  getDisplaySchoolName,
  normalizeNoticeTitle
} from '@/lib/notice-display';
import { buildNoticeDetailHref } from '@/lib/notice-links';
import { collegeDirectory } from '@/lib/college-directory';
import { baseNoticeProjects } from '@/lib/notice-source';
import { offerFeedItems, officialResourceSections } from '@/lib/portal-data';
import type { PublicNoticeProject } from '@/lib/mock-data';

export default function HomePage() {
  const [projects, setProjects] = useState<PublicNoticeProject[]>(() =>
    baseNoticeProjects.filter((item) => String(item.year) === '2026')
  );

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

  const riskBuckets = useMemo(
    () => [
      {
        key: 'today',
        title: '今日截止',
        count: projects.filter((item) => item.deadlineLevel === 'today').length,
        items: projects.filter((item) => item.deadlineLevel === 'today').slice(0, 2)
      },
      {
        key: 'within3days',
        title: '3天内截止',
        count: projects.filter((item) => item.deadlineLevel === 'within3days').length,
        items: projects.filter((item) => item.deadlineLevel === 'within3days').slice(0, 3)
      },
      {
        key: 'within7days',
        title: '7天内截止',
        count: projects.filter((item) => item.deadlineLevel === 'within7days').length,
        items: projects.filter((item) => item.deadlineLevel === 'within7days').slice(0, 3)
      }
    ],
    [projects]
  );

  const heroMetrics = [
    {
      label: '2026 通知',
      value: `${projects.length}+`,
      hint: '持续同步中',
      icon: BellRing
    },
    {
      label: '院校入口',
      value: `${collegeDirectory.length}`,
      hint: '官网快速回访',
      icon: GraduationCap
    },
    {
      label: '资源工具',
      value: `${officialResourceSections.flatMap((item) => item.links).length}`,
      hint: '高频申请入口',
      icon: FileText
    },
    {
      label: 'Offer动态',
      value: `${offerFeedItems.length}`,
      hint: '内测演示中',
      icon: TrendingUp
    }
  ];

  const stepCards = [
    {
      index: '1',
      title: '找通知',
      description: '筛选感兴趣的院校与项目，不错过重要信息。',
      icon: Search
    },
    {
      index: '2',
      title: '建申请表',
      description: '整理个人背景与材料，快速生成申请表。',
      icon: ClipboardList
    },
    {
      index: '3',
      title: '管进度',
      description: '跟踪申请进度与截止时间，把握每个关键节点。',
      icon: CalendarDays
    }
  ];

  return (
    <SiteShell>
      <section className="grid items-center gap-10 py-6 lg:grid-cols-[minmax(0,1fr)_520px] lg:py-10">
        <div>
          <div className="eyebrow">公开内测中</div>
          <h1 className="title-balance mt-8 max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-ink md:text-5xl lg:text-[3.35rem]">
            把分散的保研信息
            <br />
            整理成清晰的申请路径
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600">
            通知、院校、资源、进度一站管理，让保研从信息焦虑变成有节奏的行动计划。
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <Link
              href="/notices"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-float transition hover:-translate-y-0.5 hover:bg-brand-deep"
            >
              <FileText className="h-4 w-4" />
              查看通知
            </Link>
            <Link
              href="/me"
              className="inline-flex items-center gap-2 rounded-xl border border-brand/30 bg-white px-6 py-3.5 text-sm font-semibold text-brand shadow-sm transition hover:-translate-y-0.5 hover:border-brand"
            >
              <Grid3X3 className="h-4 w-4" />
              进入工作台
            </Link>
          </div>
        </div>

        <HeroVisual />
      </section>

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {heroMetrics.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.label} className="product-card rounded-[22px] p-6">
              <div className="flex items-start gap-4">
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand/8 text-brand">
                  <Icon className="h-7 w-7" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-slate-600">{item.label}</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-brand">{item.value}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-500">{item.hint}</div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="product-card rounded-[24px] p-7">
        <div className="mb-6 inline-flex items-center gap-2 text-xl font-semibold text-ink">
          <Grid3X3 className="h-5 w-5 text-brand" />
          三步开始
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {stepCards.map((item, index) => {
            const Icon = item.icon;

            return (
              <div key={item.title} className="relative rounded-2xl border border-slate-100 bg-white p-5">
                <div className="flex items-center gap-4">
                  <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/8 text-brand">
                    <Icon className="h-7 w-7" />
                  </span>
                  <div>
                    <div className="text-base font-semibold text-ink">
                      {item.index} {item.title}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                  </div>
                </div>
                {index < stepCards.length - 1 ? (
                  <ArrowRight className="absolute -right-4 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-brand/60 lg:block" />
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="product-card rounded-[24px] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-ink">最新通知</h2>
              <p className="mt-2 text-sm text-slate-500">按发布时间同步，优先展示 2026 年公开院校通知。</p>
            </div>
            <Link href="/notices" className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              查看更多
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-6 grid gap-4">
            {latestProjects.map((project) => (
              <Link
                key={project.id}
                href={buildNoticeDetailHref(project.id)}
                className="group grid gap-4 rounded-2xl border border-slate-100 bg-white p-4 transition hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-soft sm:grid-cols-[64px_minmax(0,1fr)_150px]"
              >
                <ExternalSiteMark
                  source={project.sourceLink}
                  label={getDisplaySchoolName(project.schoolName)}
                  size="lg"
                  rounded="full"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{getDisplaySchoolName(project.schoolName)}</span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-brand">
                      {getDisplayProjectType(project.projectType)}
                    </span>
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-slate-700 group-hover:text-brand">
                    {normalizeNoticeTitle(project.projectName, 54)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>{getDisplayDepartmentName(project.departmentName)}</span>
                    <span>发布：{formatNoticeDateOnly(project.publishDate)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
                  <span className="text-xs text-slate-500">截止：{formatNoticeDateOnly(project.deadlineDate)}</span>
                  <DeadlineBadge level={project.deadlineLevel} />
                  <span className="rounded-xl border border-brand/20 px-3 py-2 text-xs font-semibold text-brand">查看详情</span>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-5 text-center">
            <Link href="/notices" className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              查看更多通知
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <aside className="product-card rounded-[24px] p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-ink">截止提醒</h2>
            <Link href="/notices" className="text-sm font-semibold text-slate-500 hover:text-brand">
              更多
            </Link>
          </div>

          <div className="mt-6 grid gap-6">
            {riskBuckets.map((bucket) => (
              <div key={bucket.key}>
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="font-semibold text-ink">{bucket.title}</span>
                  <span className="text-slate-500">{bucket.count}</span>
                </div>
                <div className="grid gap-2">
                  {bucket.items.length ? (
                    bucket.items.map((project) => (
                      <Link
                        key={project.id}
                        href={buildNoticeDetailHref(project.id)}
                        className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition hover:bg-slate-50"
                      >
                        <span className="min-w-0 truncate text-slate-600">{getDisplaySchoolName(project.schoolName)}</span>
                        <span className={bucket.key === 'today' ? 'shrink-0 font-semibold text-rose-500' : 'shrink-0 text-slate-500'}>
                          {formatNoticeDateOnly(project.deadlineDate)}
                        </span>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-400">
                      暂无项目
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Link
            href="/notices"
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand/30 bg-white px-4 py-3 text-sm font-semibold text-brand transition hover:border-brand"
          >
            <CalendarDays className="h-4 w-4" />
            查看全部截止日历
          </Link>
        </aside>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <HomeActionCard
          title="院校库"
          description="按地区、层次、专业快速查找目标院校。"
          href="/colleges"
          action="进入院校库"
          icon={Building2}
        />
        <HomeActionCard
          title="资源库"
          description="汇聚官方平台与实用工具，备战更高效。"
          href="/resources"
          action="进入资源库"
          icon={FolderOpen}
        />
      </section>
    </SiteShell>
  );
}

function HeroVisual() {
  return (
    <div className="relative hidden min-h-[390px] lg:block">
      <div className="absolute inset-x-8 top-8 h-64 rounded-[38px] bg-gradient-to-br from-brand/8 via-white to-brand/5 blur-sm" />
      <div className="absolute left-20 top-20 h-40 w-56 rotate-[-4deg] rounded-[24px] border border-brand/12 bg-white/70 shadow-soft backdrop-blur" />
      <div className="absolute left-32 top-6 h-44 w-60 rotate-[8deg] rounded-[28px] border border-brand/10 bg-white shadow-soft">
        <div className="m-5 h-24 rounded-[20px] bg-brand text-center text-white">
          <div className="pt-8 text-4xl">鹿</div>
        </div>
        <div className="mx-5 mt-4 grid gap-2">
          <div className="h-2 rounded-full bg-slate-100" />
          <div className="h-2 w-3/4 rounded-full bg-slate-100" />
        </div>
      </div>

      <div className="absolute right-8 top-16 w-44 rounded-[22px] border border-slate-100 bg-white p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full border-[8px] border-brand/25 border-t-brand" />
          <div className="grid flex-1 gap-2">
            <div className="h-2 rounded-full bg-slate-100" />
            <div className="h-2 w-2/3 rounded-full bg-slate-100" />
          </div>
        </div>
      </div>

      <div className="absolute bottom-12 right-16 w-64 rounded-[26px] border border-brand/10 bg-white/95 p-5 shadow-hero">
        {[0, 1, 2].map((item) => (
          <div key={item} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0">
            <CheckCircle2 className="h-5 w-5 text-brand" />
            <div className="grid flex-1 gap-2">
              <div className="h-2 rounded-full bg-slate-100" />
              <div className="h-2 w-2/3 rounded-full bg-slate-100" />
            </div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-6 left-14 rounded-[22px] bg-brand px-5 py-4 text-sm font-semibold text-white shadow-float">
        申请路径已整理
      </div>
    </div>
  );
}

function HomeActionCard({
  title,
  description,
  href,
  action,
  icon: Icon
}: {
  title: string;
  description: string;
  href: string;
  action: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="product-card group relative overflow-hidden rounded-[24px] p-7 transition hover:-translate-y-0.5 hover:shadow-soft"
    >
      <div className="relative z-10 max-w-sm">
        <div className="text-2xl font-semibold text-ink">{title}</div>
        <p className="mt-3 text-sm leading-7 text-slate-500">{description}</p>
        <span className="mt-7 inline-flex items-center gap-2 rounded-xl border border-brand/25 bg-white px-4 py-3 text-sm font-semibold text-brand">
          {action}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
      <div className="absolute right-8 top-1/2 flex h-28 w-28 -translate-y-1/2 items-center justify-center rounded-[30px] bg-brand/8 text-brand">
        <Icon className="h-14 w-14" />
      </div>
    </Link>
  );
}
