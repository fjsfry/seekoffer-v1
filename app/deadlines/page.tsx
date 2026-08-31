'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Clock3, RefreshCw } from 'lucide-react';
import { ApplicationActionButton } from '@/components/application-action-button';
import { DesktopStateSurface } from '@/components/desktop-state-surface';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { DeadlineBadge, StatusBadge } from '@/components/status-badge';
import { fetchDeadlineNotices } from '@/lib/cloudbase-data';
import { getDeadlineLevelFromDate } from '@/lib/deadline-display';
import { buildNoticeDetailHref } from '@/lib/notice-links';
import { allSchoolOptions, projectTypeOptions, type PublicNoticeProject } from '@/lib/mock-data';

type DeadlineGroupKey = 'today' | 'within3days' | 'within7days';

const groupMeta: Record<
  DeadlineGroupKey,
  { title: string; subtitle: string; empty: string; tone: string; border: string }
> = {
  today: {
    title: '24 小时内截止',
    subtitle: '最危险的一组，建议现在就核对学校页面并处理提交动作。',
    empty: '当前没有 24 小时内截止项目。',
    tone: 'text-rose-700',
    border: 'border-rose-100 bg-rose-50'
  },
  within3days: {
    title: '3 天内截止',
    subtitle: '优先准备材料，避免被其他事情挤掉。',
    empty: '当前没有 3 天内截止项目。',
    tone: 'text-orange-700',
    border: 'border-orange-100 bg-orange-50'
  },
  within7days: {
    title: '7 天内截止',
    subtitle: '适合提前安排节奏，避免最后两天扎堆。',
    empty: '当前没有 7 天内截止项目。',
    tone: 'text-amber-700',
    border: 'border-amber-100 bg-amber-50'
  }
};

export default function DeadlinesPage() {
  const [projects, setProjects] = useState<PublicNoticeProject[]>([]);
  const [school, setSchool] = useState<(typeof allSchoolOptions)[number]>('全部学校');
  const [projectType, setProjectType] = useState<(typeof projectTypeOptions)[number]>('全部类型');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let active = true;

    setIsLoading(true);
    setLoadError('');
    fetchDeadlineNotices()
      .then((rows) => {
        if (!active) return;
        setProjects(rows);
      })
      .catch(() => {
        if (!active) return;
        setLoadError('截止项目暂时无法加载，请检查网络后重试。');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshNonce]);

  const filteredProjects = useMemo(() => {
    return projects
      .filter((item) => getDeadlineLevelFromDate(item.deadlineDate) !== 'expired')
      .filter((item) => (school === '全部学校' ? true : item.schoolName === school))
      .filter((item) => (projectType === '全部类型' ? true : item.projectType === projectType))
      .sort((left, right) => left.deadlineDate.localeCompare(right.deadlineDate));
  }, [projects, school, projectType]);

  const grouped = useMemo(
    () => ({
      today: filteredProjects.filter((item) => getDeadlineLevelFromDate(item.deadlineDate) === 'today'),
      within3days: filteredProjects.filter((item) => getDeadlineLevelFromDate(item.deadlineDate) === 'within3days'),
      within7days: filteredProjects.filter((item) => getDeadlineLevelFromDate(item.deadlineDate) === 'within7days')
    }),
    [filteredProjects]
  );

  return (
    <SiteShell>
      <div className="desktop-deadlines-page">
        <PageSectionTitle
          eyebrow="Upcoming Deadlines"
          title="即将截止"
          subtitle="按剩余时间分组，优先核对报名入口、材料状态和最终提交时间。"
          level="h1"
        />

        <section className="desktop-deadlines-toolbar mb-8 grid gap-4 xl:grid-cols-[0.9fr_0.9fr_1.2fr]" aria-label="截止项目筛选">
          <select
            aria-label="按学校筛选"
            value={school}
            onChange={(event) => setSchool(event.target.value as typeof school)}
            className="rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none"
          >
            {allSchoolOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            aria-label="按项目类型筛选"
            value={projectType}
            onChange={(event) => setProjectType(event.target.value as typeof projectType)}
            className="rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none"
          >
            {projectTypeOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <div className="desktop-deadlines-toolbar-summary rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 shadow-sm" role="status">
            共 {filteredProjects.length} 个即将截止项目，已按剩余时间从近到远分组。
          </div>
        </section>

        {isLoading ? (
          <DesktopStateSurface
            variant="section"
            loading
            ariaBusy
            icon={<RefreshCw />}
            title="正在加载截止项目"
            detail="正在核对最新截止时间与项目状态。"
          />
        ) : loadError ? (
          <DesktopStateSurface
            variant="section"
            tone="error"
            icon={<RefreshCw />}
            title="截止项目加载失败"
            detail={loadError}
            action={<button type="button" onClick={() => setRefreshNonce((value) => value + 1)}>重新加载</button>}
          />
        ) : (
          <section className="desktop-deadline-groups grid gap-6">
            {(Object.keys(grouped) as DeadlineGroupKey[]).map((groupKey) => {
          const meta = groupMeta[groupKey];
          const rows = grouped[groupKey];

          return (
            <div key={groupKey} className={`desktop-deadline-group desktop-deadline-group--${groupKey} rounded-[30px] border p-5 shadow-sm ${meta.border}`}>
              <div className="desktop-deadline-group-header mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className={`desktop-deadline-group-title text-2xl font-semibold ${meta.tone}`}>{meta.title}</div>
                  <div className="mt-2 text-sm text-slate-600">{meta.subtitle}</div>
                </div>
                <div className={`desktop-deadline-group-count text-3xl font-semibold ${meta.tone}`} aria-label={`${rows.length} 个项目`}>{rows.length}</div>
              </div>

              <div className="desktop-deadline-list grid gap-4">
                {rows.length ? (
                  rows.map((project) => (
                    <article key={project.id} className="desktop-deadline-row-card rounded-[28px] border border-white/70 bg-white p-5 shadow-sm">
                      <div className="desktop-deadline-row-badges flex flex-wrap items-center gap-2">
                        <DeadlineBadge level={getDeadlineLevelFromDate(project.deadlineDate)} />
                        <StatusBadge status={project.status} />
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                          {project.projectType}
                        </span>
                      </div>

                      <div className="desktop-deadline-row-main mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
                        <div className="desktop-deadline-row-identity">
                          <div className="text-lg font-semibold text-ink">{project.schoolName}</div>
                          <div className="mt-1 text-sm text-slate-500">{project.departmentName}</div>
                          <div className="mt-3 text-sm leading-7 text-slate-700">{project.projectName}</div>
                          <div className="mt-4 inline-flex items-center gap-2 text-sm text-brand">
                            <Clock3 className="h-4 w-4" />
                            截止时间：{project.deadlineDate}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {project.tags.map((tag) => (
                              <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="desktop-deadline-row-actions grid gap-3">
                          <Link
                            href={buildNoticeDetailHref(project.id)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white"
                          >
                            查看详情
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                          <ApplicationActionButton projectId={project.id} variant="secondary" />
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <DesktopStateSurface
                    variant="inline"
                    icon={<Clock3 />}
                    title={meta.empty}
                    detail="有新的截止项目时会自动出现在这里。"
                  />
                )}
              </div>
            </div>
          );
        })}
          </section>
        )}
      </div>
    </SiteShell>
  );
}
