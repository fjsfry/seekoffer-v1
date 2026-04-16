'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BellRing, BookMarked, BriefcaseBusiness, Compass, Sparkles } from 'lucide-react';
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

  const resourcePreview = officialResourceSections.flatMap((section) => section.links).slice(0, 4);
  const offerPreview = [...offerFeedItems].sort((left, right) => right.heat - left.heat).slice(0, 4);
  const collegePreview = collegeDirectory.slice(0, 6);

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-[1240px] space-y-6">
        <section className="surface-card rounded-[34px] p-8 lg:p-10">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_360px]">
            <div>
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
                  ['通知不再四处找', '集中整理夏令营、预推免和招生动态，减少反复搜索和信息遗漏。'],
                  ['申请进度一目了然', '把目标院校、截止时间和材料状态放到同一套流程里管理。'],
                  ['下一步该做什么更清楚', '工作台会持续沉淀你的申请节奏，而不是只推送更多信息。']
                ].map(([title, description]) => (
                  <div key={title} className="rounded-[26px] bg-slate-50 px-5 py-5">
                    <div className="text-lg font-semibold text-ink">{title}</div>
                    <p className="mt-3 text-sm leading-7 text-slate-500">{description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[30px] bg-brand px-6 py-6 text-white shadow-hero">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-white/80">
                  <Sparkles className="h-4 w-4" />
                  为什么先用寻鹿
                </div>
                <div className="mt-4 text-2xl font-semibold leading-tight">先把最重要的通知、时间和行动放到一个地方。</div>
                <div className="mt-5 grid gap-3 text-sm leading-7 text-white/78">
                  <div className="rounded-[22px] bg-white/10 px-4 py-3">通知库负责找信息，工作台负责管理自己的申请节奏。</div>
                  <div className="rounded-[22px] bg-white/10 px-4 py-3">保研这件事不是比谁看得多，而是谁更早知道该先做什么。</div>
                  <div className="rounded-[22px] bg-white/10 px-4 py-3">从浏览通知到整理申请表，再到安排待办，整条路径都在同一个站内完成。</div>
                </div>
              </div>

              <div className="surface-card rounded-[30px] p-6">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                  <BriefcaseBusiness className="h-4 w-4" />
                  工作台入口
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-500">
                  登录后继续管理申请表、材料进度、行动清单和个人资料，保证你的申请路径始终清晰。
                </p>
                <Link
                  href="/me"
                  className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  前往工作台
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
          <div className="surface-card rounded-[34px] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                  <BellRing className="h-4 w-4" />
                  最新通知
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-500">按发布时间倒序查看最近同步的重要项目，优先确认正在更新的官方通知。</p>
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
                    <div className="mt-4 text-lg font-semibold text-ink">{project.schoolName}</div>
                    <div className="mt-2 text-sm leading-7 text-slate-600">{project.projectName}</div>
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

          <div className="space-y-6">
            <div className="surface-card rounded-[34px] p-6">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                <BookMarked className="h-4 w-4" />
                常用资源
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

            <div className="surface-card rounded-[34px] p-6">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                <Compass className="h-4 w-4" />
                使用建议
              </div>
              <div className="mt-4 grid gap-3 text-sm leading-7 text-slate-600">
                <div className="rounded-[22px] bg-slate-50 px-4 py-4">先在通知库里加入重点院校，再回工作台集中管理材料和待办。</div>
                <div className="rounded-[22px] bg-slate-50 px-4 py-4">如果通知库没找到正在跟进的项目，也可以在工作台手动新增院校条目。</div>
                <div className="rounded-[22px] bg-slate-50 px-4 py-4">资源库和院校库更适合做长期收藏，通知库更适合高频追踪。</div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid items-start gap-6 xl:grid-cols-2">
          <div className="surface-card rounded-[34px] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">院校库精选</div>
                <p className="mt-2 text-sm leading-7 text-slate-500">从学校官网开始核对信息，始终是确认招生动态最稳的一步。</p>
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
                <p className="mt-2 text-sm leading-7 text-slate-500">先看讨论热度更高的动态，快速感知补录窗口和志愿流向。</p>
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
