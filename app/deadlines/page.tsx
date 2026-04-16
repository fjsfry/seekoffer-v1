'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Clock3 } from 'lucide-react';
import { ApplicationActionButton } from '@/components/application-action-button';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { DeadlineBadge, StatusBadge } from '@/components/status-badge';
import { fetchDeadlineNotices } from '@/lib/cloudbase-data';
import { buildNoticeDetailHref } from '@/lib/notice-links';
import { allSchoolOptions, projectTypeOptions, type PublicNoticeProject } from '@/lib/mock-data';

type DeadlineGroupKey = 'today' | 'within3days' | 'within7days';

const groupMeta: Record<
  DeadlineGroupKey,
  { title: string; subtitle: string; empty: string; tone: string; border: string }
> = {
  today: {
    title: '今日截止',
    subtitle: '最危险的一组，建议今天直接处理提交动作。',
    empty: '当前没有今日截止项目。',
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

  useEffect(() => {
    let active = true;

    fetchDeadlineNotices().then((rows) => {
      if (active) {
        setProjects(rows);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const filteredProjects = useMemo(() => {
    return projects
      .filter((item) => item.deadlineLevel !== 'expired')
      .filter((item) => (school === '全部学校' ? true : item.schoolName === school))
      .filter((item) => (projectType === '全部类型' ? true : item.projectType === projectType))
      .sort((left, right) => left.deadlineDate.localeCompare(right.deadlineDate));
  }, [projects, school, projectType]);

  const grouped = useMemo(
    () => ({
      today: filteredProjects.filter((item) => item.deadlineLevel === 'today'),
      within3days: filteredProjects.filter((item) => item.deadlineLevel === 'within3days'),
      within7days: filteredProjects.filter((item) => item.deadlineLevel === 'within7days')
    }),
    [filteredProjects]
  );

  return (
    <SiteShell>
      <PageSectionTitle
        eyebrow="Upcoming Deadlines"
        title="即将截止专区"
        subtitle="智能风险预警中心。按紧急程度排序，助你从容应对每一个 Deadline。"
      />

      <section className="mb-8 grid gap-4 xl:grid-cols-[0.9fr_0.9fr_1.2fr]">
        <select
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

        <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
          共筛到 {filteredProjects.length} 个高风险项目，建议优先处理今日截止与 3 天内截止通知。
        </div>
      </section>

      <section className="grid gap-6">
        {(Object.keys(grouped) as DeadlineGroupKey[]).map((groupKey) => {
          const meta = groupMeta[groupKey];
          const rows = grouped[groupKey];

          return (
            <div key={groupKey} className={`rounded-[30px] border p-5 shadow-sm ${meta.border}`}>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className={`text-2xl font-semibold ${meta.tone}`}>{meta.title}</div>
                  <div className="mt-2 text-sm text-slate-600">{meta.subtitle}</div>
                </div>
                <div className={`text-3xl font-semibold ${meta.tone}`}>{rows.length}</div>
              </div>

              <div className="grid gap-4">
                {rows.length ? (
                  rows.map((project) => (
                    <div key={project.id} className="rounded-[28px] border border-white/70 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <DeadlineBadge level={project.deadlineLevel} />
                        <StatusBadge status={project.status} />
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                          {project.projectType}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
                        <div>
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

                        <div className="grid gap-3">
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
                    </div>
                  ))
                ) : (
                  <div className="rounded-[26px] border border-dashed border-black/10 bg-white/70 px-5 py-10 text-sm text-slate-500">
                    {meta.empty}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </SiteShell>
  );
}
