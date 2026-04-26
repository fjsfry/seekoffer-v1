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
  ShieldCheck,
  Target,
  TrendingUp
} from 'lucide-react';
import { DeadlineBadge } from '@/components/status-badge';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { ProductHeroVisual } from '@/components/product-hero-visual';
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
import { resolveNoticeLogoSource } from '@/lib/school-mark-source';
import type { PublicNoticeProject } from '@/lib/mock-data';

function getDeadlineTimestamp(project: PublicNoticeProject) {
  const date = project.deadlineDate || '9999-12-31 23:59';
  const timestamp = new Date(`${date.replace(' ', 'T')}:00+08:00`).getTime();
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

function getDeadlineHint(project: PublicNoticeProject) {
  const timestamp = getDeadlineTimestamp(project);
  if (timestamp === Number.MAX_SAFE_INTEGER) {
    return '时间待补充';
  }

  const diffDays = Math.max(0, Math.ceil((timestamp - Date.now()) / (1000 * 60 * 60 * 24)));
  if (project.deadlineLevel === 'today') {
    return '今日截止';
  }

  return diffDays <= 0 ? '已截止' : `${diffDays}天后`;
}

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
    () =>
      [...projects]
        .filter((item) => item.deadlineLevel !== 'expired')
        .sort((left, right) => right.publishDate.localeCompare(left.publishDate))
        .slice(0, 5),
    [projects]
  );

  const riskBuckets = useMemo(() => {
    const sortedProjects = [...projects].sort((left, right) => getDeadlineTimestamp(left) - getDeadlineTimestamp(right));
    const pickByLevel = (level: PublicNoticeProject['deadlineLevel']) =>
      sortedProjects.filter((item) => item.deadlineLevel === level);

    return [
      {
        key: 'today',
        title: '今日截止',
        count: pickByLevel('today').length,
        items: pickByLevel('today').slice(0, 2)
      },
      {
        key: 'within3days',
        title: '3天内截止',
        count: pickByLevel('within3days').length,
        items: pickByLevel('within3days').slice(0, 3)
      },
      {
        key: 'within7days',
        title: '7天内截止',
        count: pickByLevel('within7days').length,
        items: pickByLevel('within7days').slice(0, 3)
      }
    ];
  }, [projects]);

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

  const valuePromises = [
    {
      title: '怕错过通知',
      description: '关注目标院校和专业方向，最新通知、关键变更和临近截止都会优先浮到你眼前。',
      icon: BellRing
    },
    {
      title: '怕材料漏交',
      description: '每个项目都会被拆成材料清单、提交状态和下一步行动，减少临近截止时的混乱。',
      icon: ClipboardList
    },
    {
      title: '怕不知道值不值得申',
      description: '把机会分成优先处理、持续关注和历史参考，让你把精力放在最值得推进的项目上。',
      icon: Target
    }
  ];

  const priorityActions = useMemo(
    () =>
      [...projects]
        .filter((item) => item.deadlineLevel !== 'expired')
        .sort((left, right) => {
          const urgentRank = { today: 0, within3days: 1, within7days: 2, future: 3, expired: 4 } as const;
          return urgentRank[left.deadlineLevel] - urgentRank[right.deadlineLevel] || right.publishDate.localeCompare(left.publishDate);
        })
        .slice(0, 3),
    [projects]
  );

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
            不只是收集通知，而是帮你判断机会、追踪截止、管理材料、减少漏申，让保研从信息焦虑变成有节奏的行动计划。
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

        <ProductHeroVisual variant="dashboard" />
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

      <section className="grid gap-5 lg:grid-cols-3">
        {valuePromises.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.title} className="product-card rounded-[24px] p-6">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/8 text-brand">
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-xl font-semibold text-ink">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-500">{item.description}</p>
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

      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="product-card rounded-[28px] p-7">
          <div className="eyebrow">Personal Decision Desk</div>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-ink">今天先处理什么，工作台会直接告诉你。</h2>
          <p className="mt-4 text-sm leading-8 text-slate-600">
            从通知库加入申请表后，Seekoffer 会把截止时间、材料缺口和申请状态转成行动清单。你不需要每天重新整理一遍 Excel。
          </p>

          <div className="mt-6 grid gap-3">
            {priorityActions.map((project, index) => (
              <Link
                key={project.id}
                href={buildNoticeDetailHref(project.id)}
                className="group rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/20"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink">{getDisplaySchoolName(project.schoolName)}</span>
                      <DeadlineBadge level={project.deadlineLevel} />
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500 group-hover:text-brand">
                      {normalizeNoticeTitle(project.projectName, 60)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <Link
            href="/me"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-float transition hover:bg-brand-deep"
          >
            查看我的工作台
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-brand/10 bg-gradient-to-br from-white via-emerald-50/70 to-white p-7 shadow-soft">
          <div className="absolute right-8 top-8 h-32 w-32 rounded-full bg-brand/10 blur-2xl" />
          <div className="relative">
            <div className="flex flex-wrap gap-4">
              {[
                { label: '申请中', value: '2', icon: FileText },
                { label: '待办', value: '4', icon: CheckCircle2 },
                { label: '7天截止', value: '1', icon: BellRing }
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.label} className="flex-1 rounded-2xl bg-white/86 px-5 py-5 shadow-sm">
                    <Icon className="h-5 w-5 text-brand" />
                    <div className="mt-4 text-3xl font-semibold text-ink">{item.value}</div>
                    <div className="mt-1 text-sm text-slate-500">{item.label}</div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 grid gap-3">
              {[
                { school: '复旦大学', status: '材料待补充', tone: 'amber' },
                { school: '中国科学技术大学', status: '3天内截止', tone: 'rose' },
                { school: '清华大学', status: '待确认导师', tone: 'emerald' }
              ].map((item) => (
                <div key={item.school} className="flex items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-brand" />
                    <span className="font-semibold text-ink">{item.school}</span>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      item.tone === 'amber'
                        ? 'bg-amber-50 text-amber-700'
                        : item.tone === 'rose'
                          ? 'bg-rose-50 text-rose-600'
                          : 'bg-emerald-50 text-brand'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-brand/20 bg-white/70 px-5 py-4 text-sm leading-7 text-slate-600">
              Demo 工作流：加入通知、自动拆材料、生成待办、临近截止提醒。正式保存和多端同步需要登录。
            </div>
          </div>
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
                  source={resolveNoticeLogoSource(project)}
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

          <div className="mt-6 grid gap-5">
            {riskBuckets.map((bucket) => (
              <div key={bucket.key} className="rounded-2xl bg-slate-50/70 p-3">
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="font-semibold text-ink">{bucket.title}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 shadow-sm">
                    {bucket.count}
                  </span>
                </div>
                <div className="grid gap-2">
                  {bucket.items.length ? (
                    bucket.items.map((project) => (
                      <Link
                        key={project.id}
                        href={buildNoticeDetailHref(project.id)}
                        className="grid grid-cols-[minmax(0,1fr)_78px] items-center gap-3 rounded-xl bg-white px-3 py-3 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-slate-700">
                            {normalizeNoticeTitle(getDisplaySchoolName(project.schoolName), 18)}
                          </span>
                          <span className="mt-1 block truncate text-xs text-slate-400">
                            {normalizeNoticeTitle(project.projectName, 24)}
                          </span>
                        </span>
                        <span className="text-right">
                          <span
                            className={`block text-xs font-semibold ${
                              bucket.key === 'today' ? 'text-rose-500' : 'text-brand'
                            }`}
                          >
                            {formatNoticeDateOnly(project.deadlineDate)}
                          </span>
                          <span className="mt-1 block text-[11px] text-slate-400">{getDeadlineHint(project)}</span>
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
