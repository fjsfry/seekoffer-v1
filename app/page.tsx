'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  BellRing,
  BookOpen,
  Brain,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  Monitor,
  Search,
  ShieldCheck,
  Target,
  UserRound
} from 'lucide-react';
import { DeadlineBadge } from '@/components/status-badge';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { SiteShell } from '@/components/site-shell';
import { fetchPublicNotices } from '@/lib/cloudbase-data';
import { getDeadlineDistanceLabel, getDeadlineLevelFromDate, getDeadlineTimestamp } from '@/lib/deadline-display';
import {
  formatNoticeDateOnly,
  getDisplayNoticeDepartment,
  getDisplayProjectType,
  getDisplaySchoolName,
  normalizeNoticeTitle
} from '@/lib/notice-display';
import { buildNoticeDetailHref } from '@/lib/notice-links';
import { collegeDirectory } from '@/lib/college-directory';
import { filterMainNoticeProjects } from '@/lib/notice-quality';
import { baseNoticeProjects } from '@/lib/notice-source';
import { officialResourceSections } from '@/lib/portal-data';
import { fetchPublicOffers } from '@/lib/offers';
import { resolveNoticeLogoSource } from '@/lib/school-mark-source';
import type { PublicNoticeProject } from '@/lib/mock-data';

const urgentRank = { today: 0, within3days: 1, within7days: 2, future: 3, expired: 4 } as const;

export default function HomePage() {
  const [projects, setProjects] = useState<PublicNoticeProject[]>(() =>
    filterMainNoticeProjects(baseNoticeProjects).filter((item) => String(item.year) === '2026')
  );
  const [noticesLoading, setNoticesLoading] = useState(true);
  const [offerCount, setOfferCount] = useState(0);
  const [offersLoading, setOffersLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetchPublicNotices()
      .then((rows) => {
        if (active) {
          setProjects(rows.filter((item) => String(item.year) === '2026'));
        }
      })
      .catch(() => {
        if (active) {
          setProjects(filterMainNoticeProjects(baseNoticeProjects).filter((item) => String(item.year) === '2026'));
        }
      })
      .finally(() => {
        if (active) {
          setNoticesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    fetchPublicOffers()
      .then((rows) => {
        if (active) {
          setOfferCount(rows.length);
        }
      })
      .catch(() => {
        if (active) {
          setOfferCount(0);
        }
      })
      .finally(() => {
        if (active) {
          setOffersLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const liveProjects = useMemo(
    () => projects.filter((item) => getDeadlineLevelFromDate(item.deadlineDate) !== 'expired'),
    [projects]
  );

  const latestProjects = useMemo(
    () => [...liveProjects].sort((left, right) => right.publishDate.localeCompare(left.publishDate)).slice(0, 5),
    [liveProjects]
  );

  const deadlineProjects = useMemo(
    () =>
      [...liveProjects]
        .sort(
          (left, right) =>
            urgentRank[getDeadlineLevelFromDate(left.deadlineDate)] - urgentRank[getDeadlineLevelFromDate(right.deadlineDate)] ||
            getDeadlineTimestamp(left.deadlineDate) - getDeadlineTimestamp(right.deadlineDate)
        )
        .slice(0, 5),
    [liveProjects]
  );

  const priorityActions = useMemo(() => deadlineProjects.slice(0, 3), [deadlineProjects]);
  const totalResourceLinks = officialResourceSections.flatMap((item) => item.links).length;

  const heroMetrics = [
    {
      label: '2026 通知',
      value: `${projects.length}+`,
      hint: noticesLoading ? '正在同步最新通知' : '持续更新中',
      icon: BellRing,
      href: '/notices'
    },
    {
      label: '院校入口',
      value: `${collegeDirectory.length}`,
      hint: '覆盖高校院所',
      icon: Building2,
      href: '/colleges'
    },
    {
      label: '资源工具',
      value: `${totalResourceLinks}`,
      hint: '高效助力申请',
      icon: FolderOpen,
      href: '/resources'
    },
    {
      label: 'Offer 动态',
      value: offerCount ? `${offerCount}` : '开放中',
      hint: offersLoading ? '正在同步审核动态' : '审核后展示',
      icon: CalendarDays,
      href: '/offers'
    }
  ];

  const featureCards = [
    { title: '不错过通知', description: '全网实时新增通知，重点院校及时提醒', icon: BellRing },
    { title: '材料管理', description: '材料清单和时间线，进度透明不遗漏', icon: FolderOpen },
    { title: '申请决策', description: '多维筛选院校，科学定位更高效', icon: Target },
    { title: '截止提醒', description: '关键节点提前预警，重要截止不再错过', icon: CalendarDays },
    { title: 'AI 辅助定位', description: '智能分析匹配院校，提升申请成功率', icon: Brain },
    { title: '工作台跟进', description: '一站式管理进度，让申请事务不再杂乱', icon: Monitor }
  ];

  const stepCards = [
    {
      index: '1',
      title: '找通知',
      description: '发现院校最新通知，不再遗漏重要机会',
      icon: Search
    },
    {
      index: '2',
      title: '建申请表 / 加入工作台',
      description: '整理材料，统一管理所有申请',
      icon: FileText
    },
    {
      index: '3',
      title: '跟进截止与材料',
      description: '关注截止提醒，推进每一个申请进度',
      icon: ClipboardList
    }
  ];

  return (
    <SiteShell>
      <section className="relative overflow-hidden rounded-[42px] px-3 pb-8 pt-8 sm:px-8 lg:px-14 lg:pb-12 lg:pt-14">
        <div className="pointer-events-none absolute inset-x-[-10%] bottom-[-4.5rem] h-72 rounded-[50%] bg-brand/10 blur-3xl" />
        <div className="pointer-events-none absolute left-[46%] top-[46%] h-3 w-3 rounded-full bg-brand/25" />
        <div className="pointer-events-none absolute left-[50%] top-[58%] h-4 w-4 rounded-full bg-brand/20" />
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_620px] xl:grid-cols-[minmax(0,1fr)_660px]">
          <div className="relative z-10">
            <h1 className="title-balance max-w-4xl text-[2.7rem] font-semibold leading-[1.12] tracking-tight text-ink md:text-5xl lg:text-[3.35rem] xl:text-[3.6rem]">
              把分散的保研信息，
              <br />
              整理成清晰的申请路径
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 lg:text-lg">
              不再担心错过通知，自动帮你收集院校、追踪截止、管理材料，减少漏申，让保研从信息焦虑变成有节奏的行动计划。
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                href="/notices"
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-float transition hover:-translate-y-0.5 hover:bg-brand-deep"
              >
                探索寻鹿的功能
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/me"
                className="inline-flex items-center gap-2 rounded-xl border border-brand/25 bg-white/90 px-6 py-3.5 text-sm font-semibold text-brand shadow-sm transition hover:-translate-y-0.5 hover:border-brand"
              >
                免费创建申请表
              </Link>
            </div>
          </div>

          <HomeHeroPreview />
        </div>
      </section>

      <section className="grid gap-5 px-1 sm:grid-cols-2 lg:grid-cols-4 lg:px-16">
        {heroMetrics.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-label={`查看${item.label}`}
              className="product-card group rounded-[24px] bg-white/90 p-6 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15"
            >
              <div className="flex items-start gap-4">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/8 text-brand shadow-[inset_0_0_0_1px_rgba(23,73,77,0.04)] transition group-hover:bg-brand group-hover:text-white">
                  <Icon className="h-7 w-7" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-600">{item.label}</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-brand">{item.value}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-500">{item.hint}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="px-1 lg:px-12">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-ink">为什么选择寻鹿</h2>
        <div className="product-card mt-5 grid overflow-hidden rounded-[26px] bg-white/[0.88] backdrop-blur sm:grid-cols-2 lg:grid-cols-6">
          {featureCards.map((item, index) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className={`px-5 py-7 text-center ${index ? 'border-t border-slate-100 sm:border-l sm:border-t-0' : ''}`}
              >
                <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-brand/8 text-brand">
                  <Icon className="h-7 w-7" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">{item.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="px-1 lg:px-12">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-ink">三步开始，轻松管理保研申请</h2>
        <div className="product-card mt-5 grid gap-4 rounded-[26px] bg-white/[0.88] p-5 backdrop-blur lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-center">
          {stepCards.map((item, index) => {
            const Icon = item.icon;

            return (
              <div key={item.title} className="contents">
                <div className="flex items-center gap-4 rounded-2xl bg-white/95 p-4 shadow-[inset_0_0_0_1px_rgba(18,32,38,0.035)]">
                  <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand/8 text-brand">
                    <Icon className="h-7 w-7" />
                  </span>
                  <div>
                    <div className="text-base font-semibold text-ink">
                      {item.index} {item.title}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                  </div>
                </div>
                {index < stepCards.length - 1 ? <ArrowRight className="hidden h-6 w-6 text-slate-300 lg:block" /> : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="product-card grid min-h-[285px] overflow-hidden rounded-[30px] bg-white/90 backdrop-blur lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="p-7 lg:p-8">
            <h2 className="text-[1.35rem] font-semibold leading-snug tracking-tight text-ink xl:text-2xl">
              今天先处理什么，工作台会直接告诉你
            </h2>
            <p className="mt-4 text-sm leading-8 text-slate-600">
              待办、进度、材料完成度、截止提醒，一目了然，帮你聚焦最重要的下一步。
            </p>
            <Link
              href="/me"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-float transition hover:bg-brand-deep"
            >
              进入工作台
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <MiniWorkbenchPanel projects={priorityActions} />
        </div>

        <div className="product-card grid min-h-[285px] overflow-hidden rounded-[30px] bg-white/90 backdrop-blur lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="p-7 lg:p-8">
            <h2 className="text-[1.35rem] font-semibold leading-snug tracking-tight text-ink xl:text-2xl">
              最新通知与截止，一手掌握
            </h2>
            <p className="mt-4 text-sm leading-8 text-slate-600">
              实时更新的院校通知与截止提醒，重要信息清晰呈现，助你抢占先机。
            </p>
            <Link
              href="/notices"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-float transition hover:bg-brand-deep"
            >
              查看通知库
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <NoticeIllustration />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.72fr)]">
        <LatestNoticeList projects={latestProjects} />
        <DeadlineReminderList projects={deadlineProjects} />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <HomeActionCard
          title="院校库"
          description="覆盖高校与科研院所，支持按层次、城市与标签快速对比，帮你识别适合自己的目标院校。"
          href="/colleges"
          action="进入院校库"
          icon={Building2}
        />
        <HomeActionCard
          title="资源库"
          description="汇聚复试经验、夏令营信息、面试真题等优质资源，助你高效准备保研。"
          href="/resources"
          action="进入资源库"
          icon={BookOpen}
        />
      </section>
    </SiteShell>
  );
}

function SeekofferMiniMark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-brand/10 bg-white shadow-sm ${className}`}>
      <Image src="/logo.png" alt="寻鹿 Seekoffer" width={56} height={56} className="h-full w-full object-cover" />
    </span>
  );
}

function HomeHeroPreview() {
  const todos = [
    ['补充 华东师范大学 材料', '去处理'],
    ['关注 3 所院校 截止临近', '去查看'],
    ['更新 中国科学技术大学 申请表', '去更新']
  ];
  const materialProgress = [
    ['基本信息', '100%'],
    ['个人陈述', '70%'],
    ['推荐信', '40%']
  ];
  const deadlines = [
    ['中国科学技术大学', '2天后截止'],
    ['复旦大学', '3天后截止'],
    ['上海交通大学', '5天后截止']
  ];

  return (
    <div className="relative z-10 mx-auto w-full max-w-[660px]">
      <div className="pointer-events-none absolute -left-8 top-20 h-36 w-36 rounded-full bg-brand/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-8 bottom-8 h-40 w-40 rounded-full bg-cyan-100/70 blur-3xl" />

      <div className="relative rounded-[32px] border border-white/80 bg-white/[0.88] p-4 shadow-[0_34px_92px_rgba(18,32,38,0.13)] backdrop-blur-2xl">
        <div className="mb-4 flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <SeekofferMiniMark className="h-9 w-9" />
            <div className="text-sm font-semibold text-ink">我的申请工作台</div>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            {[ShieldCheck, UserRound, CalendarDays].map((Icon, index) => (
              <span key={index} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-50">
                <Icon className="h-3.5 w-3.5" />
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[52px_minmax(0,1fr)]">
          <div className="hidden rounded-[20px] bg-brand/[0.06] p-2 lg:block">
            {[LayoutDashboard, UserRound, ClipboardList, CalendarDays].map((Icon, index) => (
              <div
                key={index}
                className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl transition ${
                  index === 0 ? 'bg-brand text-white shadow-sm' : 'bg-white/80 text-slate-400'
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
            ))}
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_190px]">
              <div className="rounded-[22px] border border-slate-100 bg-white/75 p-4 shadow-sm">
                <div className="mb-3 text-xs font-semibold text-slate-500">今日待办</div>
                {todos.map(([item, action]) => (
                  <div key={item} className="mb-2 flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-xs text-slate-600 shadow-[0_8px_24px_rgba(18,32,38,0.04)]">
                    <span className="h-2.5 w-2.5 rounded-full border border-brand/50" />
                    <span className="min-w-0 flex-1 truncate">{item}</span>
                    <span className="rounded-lg bg-brand/8 px-2 py-1 text-[11px] font-semibold text-brand">{action}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-[22px] border border-slate-100 bg-white/75 p-4 text-center shadow-sm">
                <div className="text-xs font-semibold text-slate-500">申请进度</div>
                <div
                  className="mx-auto mt-4 flex h-28 w-28 items-center justify-center rounded-full shadow-[inset_0_0_0_1px_rgba(23,73,77,0.06)]"
                  style={{ background: 'conic-gradient(#17494d 0 67%, #dfecea 67% 100%)' }}
                >
                  <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white shadow-sm">
                    <div className="text-xl font-semibold text-ink">8 / 12</div>
                    <div className="text-[11px] text-slate-500">已提交</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-1 text-[11px] text-slate-500">
                  <span>
                    <b className="block text-ink">3</b>草稿
                  </span>
                  <span>
                    <b className="block text-ink">1</b>进行中
                  </span>
                  <span>
                    <b className="block text-ink">8</b>已提交
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[22px] border border-slate-100 bg-white/85 p-4 shadow-sm">
                <div className="mb-3 text-xs font-semibold text-slate-500">材料完成度</div>
                {materialProgress.map(([label, value]) => (
                  <div key={label} className="mb-3">
                    <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                      <span>{label}</span>
                      <span>{value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand" style={{ width: value }} />
                    </div>
                  </div>
                ))}
                <div className="text-xs font-semibold text-brand">去完善材料 →</div>
              </div>

              <div className="rounded-[22px] border border-slate-100 bg-white/85 p-4 shadow-sm">
                <div className="mb-3 text-xs font-semibold text-slate-500">截止提醒（近7天）</div>
                {deadlines.map(([school, tag]) => (
                  <div key={school} className="mb-2 flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-slate-600">{school}</span>
                    <span className="shrink-0 font-semibold text-rose-500">{tag}</span>
                  </div>
                ))}
                <div className="mt-3 text-xs font-semibold text-brand">查看全部提醒 →</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniWorkbenchPanel({ projects }: { projects: PublicNoticeProject[] }) {
  return (
    <div className="relative min-h-[260px] overflow-hidden bg-gradient-to-br from-emerald-50/80 to-white p-5 sm:p-6">
      <div className="absolute right-[-2rem] top-[-2rem] h-32 w-32 rounded-full bg-brand/10 blur-2xl" />
      <div className="relative rounded-2xl bg-white/85 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>今日待办</span>
          <span>×</span>
        </div>
        {(projects.length ? projects : []).slice(0, 3).map((project, index) => (
          <div key={project.id} className="mb-2 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full border border-brand/50" />
            <span className="min-w-0 flex-1 truncate">
              {index === 0 ? '补充' : index === 1 ? '关注' : '更新'} {getDisplaySchoolName(project.schoolName)}
            </span>
            <span className="shrink-0 rounded-lg bg-brand/8 px-2 py-1 font-semibold text-brand">
              {index === 0 ? '去处理' : index === 1 ? '去查看' : '去更新'}
            </span>
          </div>
        ))}
      </div>

      <div className="relative mt-4 grid grid-cols-4 gap-2 sm:gap-3">
        {[
          ['12', '全部申请'],
          ['8', '已提交'],
          ['3', '进行中'],
          ['1', '待确认']
        ].map(([value, label]) => (
          <div key={label} className="min-w-0 rounded-2xl bg-white/90 px-2 py-4 text-center shadow-sm ring-1 ring-white/70">
            <div className="text-2xl font-semibold leading-none text-brand">{value}</div>
            <div className="mt-2 whitespace-nowrap text-[10px] font-medium leading-none text-slate-500 sm:text-[11px]">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NoticeIllustration() {
  return (
    <div className="relative min-h-[260px] overflow-hidden bg-gradient-to-br from-white via-emerald-50/80 to-white p-8">
      <div className="absolute left-8 top-10 h-36 w-36 rounded-full bg-brand/8" />
      <div className="absolute right-8 top-8 h-20 w-20 rounded-full bg-amber-50 shadow-sm" />
      <div className="absolute bottom-8 left-16 flex h-20 w-20 items-center justify-center rounded-[26px] bg-white text-sky-500 shadow-soft">
        <GraduationCap className="h-10 w-10" />
      </div>
      <div className="absolute right-20 top-14 flex h-20 w-20 items-center justify-center rounded-[26px] bg-white text-amber-400 shadow-soft">
        <BellRing className="h-10 w-10" />
      </div>
      <div className="absolute bottom-12 right-24 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-rose-400 shadow-soft">
        <ShieldCheck className="h-7 w-7" />
      </div>
      <div className="absolute bottom-28 right-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand shadow-soft">
        <Target className="h-6 w-6" />
      </div>
    </div>
  );
}

function LatestNoticeList({ projects }: { projects: PublicNoticeProject[] }) {
  return (
    <section className="product-card rounded-[24px] p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-ink">最新通知</h2>
        <Link href="/notices" className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
          查看全部
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-5 divide-y divide-slate-100">
        {projects.map((project) => (
          <Link
            key={project.id}
            href={buildNoticeDetailHref(project.id)}
            className="group grid gap-3 py-4 transition hover:bg-slate-50/70 sm:grid-cols-[48px_minmax(0,1fr)_150px_96px] sm:items-center"
          >
            <ExternalSiteMark
              source={resolveNoticeLogoSource(project)}
              label={getDisplaySchoolName(project.schoolName)}
              size="md"
              rounded="full"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">{getDisplaySchoolName(project.schoolName)}</span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-brand">
                  {getDisplayProjectType(project.projectType)}
                </span>
              </div>
              <div className="mt-1 line-clamp-1 text-sm text-slate-600 group-hover:text-brand">
                {normalizeNoticeTitle(project.projectName, 64)}
              </div>
            </div>
            <div className="text-xs leading-5 text-slate-500 sm:text-right">
              <div>来源：{getDisplayNoticeDepartment(project)}</div>
              <div>{formatNoticeDateOnly(project.publishDate)}</div>
            </div>
            <div className="sm:text-right">
              <DeadlineBadge level={getDeadlineLevelFromDate(project.deadlineDate)} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function DeadlineReminderList({ projects }: { projects: PublicNoticeProject[] }) {
  return (
    <aside className="product-card rounded-[24px] p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-ink">截止提醒（近7天）</h2>
        <Link href="/notices" className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
          查看全部
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-5 divide-y divide-slate-100">
        {projects.map((project, index) => (
          <Link
            key={project.id}
            href={buildNoticeDetailHref(project.id)}
            className="grid grid-cols-[44px_minmax(0,1fr)_88px] items-center gap-3 py-4 transition hover:bg-slate-50/70"
          >
            <ExternalSiteMark
              source={resolveNoticeLogoSource(project)}
              label={getDisplaySchoolName(project.schoolName)}
              size="sm"
              rounded="full"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-semibold text-ink">{getDisplaySchoolName(project.schoolName)}</span>
                <span className="text-xs text-slate-400">({getDisplayProjectType(project.projectType)})</span>
              </div>
              <div className="mt-1 truncate text-sm text-slate-500">{getDisplayNoticeDepartment(project)}</div>
            </div>
            <div className="text-right">
              <div className={index < 2 ? 'font-semibold text-rose-500' : 'font-semibold text-orange-500'}>
                {getDeadlineDistanceLabel(project.deadlineDate)}
              </div>
              <div className="mt-1 text-xs text-slate-500">{formatNoticeDateOnly(project.deadlineDate)}</div>
            </div>
          </Link>
        ))}
      </div>
    </aside>
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
      className="product-card group relative min-h-[170px] overflow-hidden rounded-[24px] p-7 transition hover:-translate-y-0.5 hover:shadow-soft"
    >
      <div className="relative z-10 max-w-md">
        <div className="text-2xl font-semibold text-ink">{title}</div>
        <p className="mt-3 text-sm leading-7 text-slate-500">{description}</p>
        <span className="mt-6 inline-flex items-center gap-2 rounded-xl border border-brand/25 bg-white px-4 py-2.5 text-sm font-semibold text-brand">
          {action}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
      <div className="absolute bottom-[-2rem] right-8 flex h-36 w-36 items-center justify-center rounded-[38px] bg-brand/8 text-brand">
        <Icon className="h-16 w-16" />
      </div>
    </Link>
  );
}
