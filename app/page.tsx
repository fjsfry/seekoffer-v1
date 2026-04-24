'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  BellRing,
  BookOpenText,
  BriefcaseBusiness,
  GraduationCap,
  HeartHandshake,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { DeadlineBadge } from '@/components/status-badge';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { SiteShell } from '@/components/site-shell';
import { fetchPublicNotices } from '@/lib/cloudbase-data';
import {
  formatNoticeDate,
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
        items: projects.filter((item) => item.deadlineLevel === 'today').slice(0, 3)
      },
      {
        key: 'within3days',
        title: '3 天内截止',
        items: projects.filter((item) => item.deadlineLevel === 'within3days').slice(0, 3)
      },
      {
        key: 'within7days',
        title: '7 天内截止',
        items: projects.filter((item) => item.deadlineLevel === 'within7days').slice(0, 3)
      }
    ],
    [projects]
  );

  const resourcePreview = officialResourceSections.flatMap((section) => section.links).slice(0, 4);
  const collegePreview = collegeDirectory.slice(0, 4);
  const offerPreview = [...offerFeedItems].sort((left, right) => right.heat - left.heat).slice(0, 4);

  const heroMetrics = [
    { label: '通知覆盖', value: `${projects.length}+`, hint: '持续同步 2026 年公开通知' },
    { label: '院校官网', value: `${collegeDirectory.length}`, hint: '重点院校入口持续整理' },
    {
      label: '资源入口',
      value: `${officialResourceSections.flatMap((item) => item.links).length}`,
      hint: '资源库长期可回访'
    },
    { label: 'Offer 动态', value: `${offerFeedItems.length}`, hint: '公开内测演示，正式发布需审核' }
  ];

  const valueCards = [
    {
      title: '通知不再四处找',
      description: '把夏令营、预推免和招生动态集中整理，减少来回搜索和群里蹲消息。',
      icon: BellRing
    },
    {
      title: '申请节奏更清楚',
      description: '通知发现、官网核对、加入工作台、后续跟进，全部接在同一条路径里。',
      icon: BriefcaseBusiness
    },
    {
      title: '关键节点不容易漏',
      description: '把今日截止、3 天内和 7 天内的节点提到更前面，先处理真正重要的事。',
      icon: ShieldAlert
    }
  ];

  return (
    <SiteShell>
      <div className="grid gap-8">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_380px]">
          <div className="surface-card rounded-[38px] p-7 lg:p-10">
            <div className="eyebrow">Seekoffer Product</div>
            <div className="mt-5 max-w-5xl">
              <h1 className="title-balance text-4xl font-semibold tracking-tight text-ink md:text-5xl xl:text-[3.75rem] xl:leading-[1.08]">
                把分散的保研信息，整理成清晰的申请路径
              </h1>
              <p className="mt-5 max-w-4xl text-[15px] leading-8 text-slate-600">
                Seekoffer 聚合院校通知、梳理关键时间节点、沉淀申请过程，帮助你从“到处找信息”走向“有节奏地准备申请”。
              </p>
            </div>

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

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {heroMetrics.map((item) => (
                <div key={item.label} className="rounded-[26px] bg-slate-50 px-5 py-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{item.label}</div>
                  <div className="mt-3 text-3xl font-semibold text-ink">{item.value}</div>
                  <div className="mt-2 text-sm text-slate-500">{item.hint}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {valueCards.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.title} className="rounded-[28px] border border-black/5 bg-white px-5 py-5 shadow-sm">
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

          <div className="grid gap-6">
            <div className="rounded-[34px] bg-brand px-6 py-6 text-white shadow-hero">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-white/85">
                <Sparkles className="h-4 w-4" />
                核心价值
              </div>
              <div className="mt-4 text-2xl font-semibold leading-tight">
                先找到值得关注的项目，再稳稳接住后续的申请动作。
              </div>
              <div className="mt-5 grid gap-3 text-sm leading-7 text-white/82">
                <div className="rounded-[22px] bg-white/10 px-4 py-3">通知库负责发现机会，先把最新和最危险的节点看清楚。</div>
                <div className="rounded-[22px] bg-white/10 px-4 py-3">工作台负责管理项目、材料和行动，不再把节奏拆散在多份表里。</div>
                <div className="rounded-[22px] bg-white/10 px-4 py-3">资源库和院校库负责长期回访，把官网和常用工具稳稳接住。</div>
              </div>
            </div>

            <div className="surface-card rounded-[34px] p-6">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                <ArrowUpRight className="h-4 w-4" />
                产品路径
              </div>
              <div className="mt-5 grid gap-3">
                {[
                  ['01', '先看最新通知', '先判断有没有值得投入时间的项目。'],
                  ['02', '再加入工作台', '把状态、材料和提醒接到自己的申请路径里。'],
                  ['03', '最后回访官网', '去院校库和资源库核对官网、材料和工具入口。']
                ].map(([step, title, text]) => (
                  <div key={step} className="flex gap-4 rounded-[24px] bg-slate-50 px-4 py-4">
                    <div className="text-sm font-semibold text-brand">{step}</div>
                    <div>
                      <div className="text-sm font-semibold text-ink">{title}</div>
                      <div className="mt-1 text-sm leading-6 text-slate-500">{text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.24fr)_400px]">
          <div className="surface-card rounded-[34px] p-6 lg:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                  <BellRing className="h-4 w-4" />
                  最新通知
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-500">先看标题、学校和时间，再决定哪些项目值得马上点开继续核对。</p>
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
                        {getDisplayProjectType(project.projectType)}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
                        {formatNoticeDateOnly(project.publishDate)}
                      </span>
                    </div>
                    <div className="mt-4 text-base font-semibold text-ink">{getDisplaySchoolName(project.schoolName)}</div>
                    <div className="mt-2 text-xl font-semibold leading-8 text-ink">{normalizeNoticeTitle(project.projectName, 46)}</div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                      <span>{getDisplayDepartmentName(project.departmentName)}</span>
                      <span>截止：{formatNoticeDate(project.deadlineDate)}</span>
                    </div>
                  </Link>
                ))
              ) : null}
            </div>
          </div>

          <div className="surface-card rounded-[34px] p-6 lg:p-7">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <ShieldAlert className="h-4 w-4" />
              高危提醒
            </div>
            <p className="mt-2 text-sm leading-7 text-slate-500">把今日、3 天内和 7 天内的节点先提出来，优先处理真正不能错过的项目。</p>

            <div className="mt-5 grid gap-4">
              {riskBuckets.map((bucket) => (
                <div key={bucket.key} className="rounded-[26px] bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-ink">{bucket.title}</div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand shadow-sm">
                      {bucket.items.length} 项
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3">
                    {bucket.items.length ? (
                      bucket.items.map((project) => (
                        <Link
                          key={project.id}
                          href={buildNoticeDetailHref(project.id)}
                          className="rounded-[20px] bg-white px-4 py-4 transition hover:bg-slate-100"
                        >
                          <div className="text-sm font-semibold text-ink">{getDisplaySchoolName(project.schoolName)}</div>
                          <div className="mt-1 text-sm leading-6 text-slate-600">{normalizeNoticeTitle(project.projectName)}</div>
                        </Link>
                      ))
                    ) : (
                      <div className="rounded-[20px] border border-dashed border-black/10 px-4 py-5 text-sm text-slate-500">
                        当前没有 {bucket.title} 的项目。
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <div className="surface-card rounded-[34px] p-6 lg:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                  <BriefcaseBusiness className="h-4 w-4" />
                  工作台能力
                </div>
                <div className="mt-3 text-2xl font-semibold text-ink">把项目、材料和行动放到一条可持续推进的申请线里。</div>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  通知负责发现项目，工作台负责接住后续动作。加入申请表后，你可以继续管理优先级、材料进度、待办和提醒。
                </p>
              </div>
              <Link
                href="/me"
                className="inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white"
              >
                打开工作台
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {[
                ['申请表', '把项目状态、截止时间和备注放进同一张表里。'],
                ['行动清单', '把今天必须处理和本周要处理的动作拆出来。'],
                ['材料进度', '按学校和项目去推进简历、成绩单和个人陈述。']
              ].map(([title, description]) => (
                <div key={title} className="rounded-[26px] bg-slate-50 px-5 py-5">
                  <div className="text-base font-semibold text-ink">{title}</div>
                  <div className="mt-3 text-sm leading-7 text-slate-600">{description}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="surface-card rounded-[34px] p-6">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                <BookOpenText className="h-4 w-4" />
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
                    <ExternalSiteMark source={item.href} label={item.title} size="lg" layout="landscape" />
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

            <div className="surface-card rounded-[34px] p-6 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                  <HeartHandshake className="h-4 w-4" />
                  Offer 池
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
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800">
                Offer 池当前为公开内测演示区，正式发布会加入账号记录、审核与举报机制。
              </div>
            </div>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
