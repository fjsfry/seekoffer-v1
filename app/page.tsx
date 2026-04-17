'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BellRing,
  BookMarked,
  BriefcaseBusiness,
  Compass,
  GraduationCap,
  ShieldCheck,
  Sparkles
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
    () => [...projects].sort((left, right) => right.publishDate.localeCompare(left.publishDate)).slice(0, 5),
    [projects]
  );

  const riskProjects = useMemo(
    () =>
      projects
        .filter((item) => ['today', 'within3days', 'within7days'].includes(item.deadlineLevel))
        .sort((left, right) => left.deadlineDate.localeCompare(right.deadlineDate))
        .slice(0, 4),
    [projects]
  );

  const resourcePreview = officialResourceSections.flatMap((section) => section.links).slice(0, 6);
  const collegePreview = collegeDirectory.slice(0, 8);
  const offerPreview = [...offerFeedItems].sort((left, right) => right.heat - left.heat).slice(0, 4);

  const metrics = [
    { label: '已覆盖通知', value: projects.length ? `${projects.length}+` : '--', hint: '持续同步 2026 通知' },
    { label: '重点院校', value: `${collegeDirectory.length}`, hint: '985 / 211 / 双一流' },
    { label: '高频工具', value: `${officialResourceSections.flatMap((item) => item.links).length}`, hint: '资源库直达入口' },
    { label: '本周高危项目', value: `${riskProjects.length}`, hint: '优先处理截止节点' }
  ];

  const valueCards = [
    {
      title: '通知不再四处找',
      description: '把夏令营、预推免和招生动态集中起来，用一套清晰的列表持续跟进。',
      icon: BellRing
    },
    {
      title: '申请进度更可控',
      description: '通知库负责发现机会，工作台负责记录项目、材料状态和后续动作。',
      icon: BriefcaseBusiness
    },
    {
      title: '资源和院校入口稳定可回访',
      description: '把官网、工具和院校入口收好，减少来回搜索和重复整理的时间。',
      icon: Compass
    }
  ];

  return (
    <SiteShell>
      <div className="grid w-full gap-6">
        <section className="surface-card rounded-[34px] p-7 lg:p-9">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_380px]">
            <div className="space-y-6">
              <div className="eyebrow">Seekoffer Product</div>
              <div>
                <h1 className="max-w-5xl text-4xl font-semibold tracking-tight text-ink md:text-5xl">
                  把分散的保研信息，整理成清晰的申请路径
                </h1>
                <p className="mt-4 max-w-4xl text-[15px] leading-8 text-slate-600">
                  Seekoffer 聚合院校通知、梳理关键时间节点、沉淀申请过程，帮助你从“到处找信息”走向“有节奏地准备申请”。
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/notices"
                  className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white"
                >
                  查看通知库
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

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {metrics.map((item) => (
                  <div key={item.label} className="rounded-[26px] bg-slate-50 px-5 py-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</div>
                    <div className="mt-3 text-3xl font-semibold text-ink">{item.value}</div>
                    <div className="mt-2 text-sm text-slate-500">{item.hint}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[30px] bg-brand px-6 py-6 text-white shadow-hero">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-white/80">
                  <ShieldCheck className="h-4 w-4" />
                  产品思路
                </div>
                <div className="mt-4 text-2xl font-semibold leading-tight">先看真正重要的通知，再把申请节奏稳稳接住。</div>
                <div className="mt-5 grid gap-3 text-sm leading-7 text-white/80">
                  <div className="rounded-[22px] bg-white/10 px-4 py-3">通知库负责快速发现机会，资源库和院校库负责稳定回访官方入口。</div>
                  <div className="rounded-[22px] bg-white/10 px-4 py-3">工作台会把加入的项目、材料状态和行动清单串成一条可执行路径。</div>
                </div>
              </div>

              <div className="surface-card rounded-[30px] p-6">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                  <Sparkles className="h-4 w-4" />
                  本周提醒
                </div>
                <div className="mt-4 grid gap-3">
                  {riskProjects.length ? (
                    riskProjects.map((project) => (
                      <Link
                        key={project.id}
                        href={buildNoticeDetailHref(project.id)}
                        className="rounded-[22px] bg-slate-50 px-4 py-4 transition hover:bg-slate-100"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="truncate text-sm font-semibold text-ink">{project.schoolName}</div>
                          <DeadlineBadge level={project.deadlineLevel} />
                        </div>
                        <div className="mt-2 text-sm leading-6 text-slate-600">{project.projectName}</div>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-black/10 px-4 py-8 text-sm text-slate-500">
                      当前没有本周高危项目，稍后刷新可以继续查看新同步的截止节点。
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {valueCards.map((card) => {
            const Icon = card.icon;

            return (
              <div key={card.title} className="surface-card rounded-[30px] px-6 py-6">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-4 text-xl font-semibold text-ink">{card.title}</div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{card.description}</p>
              </div>
            );
          })}
        </section>

        <section className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <div className="surface-card rounded-[34px] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                  <BellRing className="h-4 w-4" />
                  最新通知
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-500">按发布时间排序查看最新同步的通知，先看标题，再决定要不要进入详情页。</p>
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

          <div className="grid gap-6">
            <div className="surface-card rounded-[34px] p-6">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                <BookMarked className="h-4 w-4" />
                常用资源
              </div>
              <div className="mt-5 grid gap-3">
                {resourcePreview.slice(0, 4).map((item) => (
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

            <div className="surface-card rounded-[34px] p-6">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                <GraduationCap className="h-4 w-4" />
                院校速览
              </div>
              <div className="mt-5 grid gap-3">
                {collegePreview.slice(0, 4).map((item) => (
                  <a
                    key={item.name}
                    href={item.website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-4 transition hover:bg-slate-100"
                  >
                    <ExternalSiteMark source={item.website} label={item.name} size="md" rounded="full" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink">{item.name}</div>
                      <div className="mt-1 truncate text-xs text-slate-500">{item.groups.slice(0, 2).join(' / ')}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="surface-card rounded-[34px] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">资源库精选</div>
                <p className="mt-2 text-sm leading-7 text-slate-500">把高频工具和官方入口放进一个稳定工具箱里，需要时直接打开。</p>
              </div>
              <Link href="/resources" className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                去资源库
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {resourcePreview.map((item) => (
                <a
                  key={item.title}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-[26px] bg-slate-50 p-5 transition hover:bg-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <ExternalSiteMark source={item.href} label={item.title} size="md" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink">{item.title}</div>
                      <div className="mt-1 truncate text-xs text-slate-500">{item.badge}</div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className="grid gap-6">
            <div className="surface-card rounded-[34px] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">院校库精选</div>
                  <p className="mt-2 text-sm leading-7 text-slate-500">优先回到学校官网核对信息，始终是确认项目细节最稳的一步。</p>
                </div>
                <Link href="/colleges" className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                  去院校库
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
                        <div className="mt-1 truncate text-xs text-slate-500">{item.city}</div>
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
                  <p className="mt-2 text-sm leading-7 text-slate-500">先看热度更高的动态，快速判断最近的补录窗口和去向变化。</p>
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
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
