'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Compass,
  GraduationCap,
  Search,
  Target
} from 'lucide-react';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { SiteShell } from '@/components/site-shell';
import { DeadlineBadge } from '@/components/status-badge';
import { fetchPublicNotices } from '@/lib/cloudbase-data';
import { getDeadlineDistanceLabel, getDeadlineLevelFromDate, getDeadlineTimestamp } from '@/lib/deadline-display';
import {
  formatNoticeDateOnly,
  getDisplayDiscipline,
  getDisplayNoticeDepartment,
  getDisplayProjectType,
  getDisplaySchoolName,
  normalizeNoticeTitle
} from '@/lib/notice-display';
import { buildNoticeDetailHref } from '@/lib/notice-links';
import { baseNoticeProjects } from '@/lib/notice-source';
import { filterMainNoticeProjects } from '@/lib/notice-quality';
import {
  buildMajorNoticeHref,
  getMajorDirectionById,
  getMajorDirectionByText,
  majorDirections,
  scoreNoticeForMajorDirection
} from '@/lib/major-taxonomy';
import { resolveNoticeLogoSource } from '@/lib/school-mark-source';
import type { PublicNoticeProject } from '@/lib/mock-data';

const urgentRank: Record<string, number> = { today: 0, within3days: 1, within7days: 2, future: 3, expired: 4 };

export default function MajorFinderPage() {
  return (
    <Suspense
      fallback={
        <SiteShell>
          <section className="page-hero px-6 py-10 text-sm text-slate-500">正在加载专业找营...</section>
        </SiteShell>
      }
    >
      <MajorFinderContent />
    </Suspense>
  );
}

function MajorFinderContent() {
  const searchParams = useSearchParams();
  const queryDirection = searchParams.get('direction');
  const queryKeyword = searchParams.get('q') || searchParams.get('major') || '';
  const inferredDirection = getMajorDirectionByText(queryKeyword);
  const [selectedDirectionId, setSelectedDirectionId] = useState(queryDirection || inferredDirection?.id || majorDirections[0].id);
  const [keyword, setKeyword] = useState(queryKeyword);
  const [projects, setProjects] = useState<PublicNoticeProject[]>(() =>
    filterMainNoticeProjects(baseNoticeProjects).filter((item) => String(item.year) === '2026')
  );
  const [loading, setLoading] = useState(true);

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
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedDirection = getMajorDirectionById(selectedDirectionId);
  const liveProjects = useMemo(
    () => projects.filter((project) => getDeadlineLevelFromDate(project.deadlineDate) !== 'expired'),
    [projects]
  );
  const directionCounts = useMemo(
    () =>
      majorDirections.map((direction) => ({
        direction,
        count: liveProjects.filter((project) => scoreNoticeForMajorDirection(project, direction).score > 0).length
      })),
    [liveProjects]
  );
  const rankedProjects = useMemo(
    () =>
      liveProjects
        .map((project) => ({
          project,
          result: scoreNoticeForMajorDirection(project, selectedDirection, keyword)
        }))
        .filter((item) => item.result.score > 0)
        .sort((left, right) => {
          if (right.result.score !== left.result.score) return right.result.score - left.result.score;
          const leftLevel = getDeadlineLevelFromDate(left.project.deadlineDate);
          const rightLevel = getDeadlineLevelFromDate(right.project.deadlineDate);
          return urgentRank[leftLevel] - urgentRank[rightLevel] || getDeadlineTimestamp(left.project.deadlineDate) - getDeadlineTimestamp(right.project.deadlineDate);
        })
        .slice(0, 18),
    [keyword, liveProjects, selectedDirection]
  );
  const noticeHref = buildMajorNoticeHref(selectedDirection, keyword);
  const urgentCount = rankedProjects.filter((item) => ['today', 'within3days', 'within7days'].includes(getDeadlineLevelFromDate(item.project.deadlineDate))).length;

  return (
    <SiteShell>
      <section className="page-hero grid gap-7 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-center lg:px-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand/8 px-4 py-2 text-sm font-semibold text-brand">
            <Compass className="h-4 w-4" />
            专业找营
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-ink md:text-5xl">
            先选专业方向，再看真正相关的学院通知
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            专业找营和 AI 定位、通知库共用同一套方向关键词。先按方向拿到候选通知，再进入通知库继续筛学校层次、地区、截止时间和项目类型。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={noticeHref}
              className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-float transition hover:bg-brand-deep"
            >
              进入通知库筛选
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/ai?major=${encodeURIComponent(keyword || selectedDirection.searchHint)}`}
              className="inline-flex items-center gap-2 rounded-2xl border border-brand/20 bg-white px-5 py-3 text-sm font-semibold text-brand shadow-sm transition hover:border-brand/40"
            >
              用 AI 继续定位
              <BrainCircuit className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {[
            { label: '方向分类', value: majorDirections.length, icon: Target },
            { label: '当前匹配', value: loading ? '...' : rankedProjects.length, icon: GraduationCap },
            { label: '近 7 天截止', value: loading ? '...' : urgentCount, icon: CalendarDays }
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.label} className="soft-stat-pill rounded-[28px] px-5 py-4">
                <div className="flex items-center gap-4">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/8 text-brand">
                    <Icon className="h-6 w-6" />
                  </span>
                  <div>
                    <div className="text-sm text-slate-500">{item.label}</div>
                    <div className="mt-1 text-2xl font-semibold text-ink">{item.value}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="surface-card rounded-[32px] p-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/8 text-brand">
              <Search className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-ink">选择专业方向</h2>
              <p className="mt-1 text-sm text-slate-500">点一次即可切换推荐池。</p>
            </div>
          </div>

          <label className="mt-5 block">
            <span className="text-xs font-semibold text-slate-500">补充关键词</span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="如：大模型 / 金融工程 / 脑科学"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brand/40 focus:ring-4 focus:ring-brand/8"
            />
          </label>

          <div className="mt-5 grid gap-2">
            {directionCounts.map(({ direction, count }) => {
              const active = direction.id === selectedDirection.id;

              return (
                <button
                  key={direction.id}
                  type="button"
                  onClick={() => setSelectedDirectionId(direction.id)}
                  className={`rounded-[22px] border px-4 py-3 text-left transition ${
                    active
                      ? 'border-brand/25 bg-brand/8 text-brand shadow-sm'
                      : 'border-slate-100 bg-white/90 text-slate-600 hover:border-brand/20 hover:text-brand'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{direction.label}</span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">{count}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{direction.description}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="surface-card rounded-[32px] p-5 lg:p-6">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">{selectedDirection.label} 推荐通知</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
                推荐结果按方向匹配度、截止紧急程度排序。当前只是找营入口，最终申请仍以原通知和学院要求为准。
              </p>
            </div>
            <Link href={noticeHref} className="inline-flex w-fit items-center gap-2 rounded-2xl bg-brand/8 px-4 py-3 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white">
              打开完整筛选
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5 grid gap-4">
            {rankedProjects.length ? (
              rankedProjects.map(({ project, result }) => (
                <MajorNoticeCard
                  key={project.id}
                  project={project}
                  matchedTerms={result.matchedTerms}
                  returnTo={noticeHref}
                />
              ))
            ) : (
              <div className="rounded-[26px] border border-dashed border-slate-200 bg-slate-50/70 px-5 py-10 text-center">
                <BookOpenCheck className="mx-auto h-8 w-8 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold text-ink">当前方向暂未匹配到通知</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500">可以换一个专业方向，或删掉补充关键词后再看更宽的候选池。</p>
              </div>
            )}
          </div>
        </section>
      </section>
    </SiteShell>
  );
}

function MajorNoticeCard({
  project,
  matchedTerms,
  returnTo
}: {
  project: PublicNoticeProject;
  matchedTerms: string[];
  returnTo: string;
}) {
  const href = buildNoticeDetailHref(project.id, returnTo);

  return (
    <article className="grid gap-4 rounded-[26px] border border-slate-100 bg-white/95 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/15 hover:shadow-soft md:grid-cols-[56px_minmax(0,1fr)_150px] md:items-center">
      <ExternalSiteMark source={resolveNoticeLogoSource(project)} label={getDisplaySchoolName(project.schoolName)} size="lg" rounded="full" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink">{getDisplaySchoolName(project.schoolName)}</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-brand">{getDisplayProjectType(project.projectType)}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{getDisplayDiscipline(project.discipline)}</span>
        </div>
        <Link href={href} className="mt-2 block line-clamp-1 text-sm font-semibold text-slate-700 hover:text-brand">
          {normalizeNoticeTitle(project.projectName, 84)}
        </Link>
        <div className="mt-2 line-clamp-1 text-xs text-slate-500">{getDisplayNoticeDepartment(project)}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(matchedTerms.length ? matchedTerms : ['方向相关']).map((term) => (
            <span key={term} className="inline-flex items-center gap-1 rounded-full bg-brand/8 px-2.5 py-1 text-xs font-semibold text-brand">
              <CheckCircle2 className="h-3 w-3" />
              {term}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 md:block md:text-right">
        <div>
          <DeadlineBadge level={getDeadlineLevelFromDate(project.deadlineDate)} />
          <div className="mt-2 text-xs text-slate-500">{formatNoticeDateOnly(project.deadlineDate)}</div>
          <div className="mt-1 text-xs font-semibold text-rose-500">{getDeadlineDistanceLabel(project.deadlineDate)}</div>
        </div>
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-brand md:mt-4">
          查看通知
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
