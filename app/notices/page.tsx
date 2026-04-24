'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { ApplicationActionButton } from '@/components/application-action-button';
import { SiteShell } from '@/components/site-shell';
import { DeadlineBadge, StatusBadge } from '@/components/status-badge';
import { fetchPublicNotices } from '@/lib/cloudbase-data';
import {
  formatNoticeDate,
  formatNoticeDateOnly,
  getDisplayDepartmentName,
  getDisplayDiscipline,
  getDisplayProjectType,
  getDisplaySchoolName,
  getDisplayTags,
  normalizeNoticeTitle
} from '@/lib/notice-display';
import { buildNoticeDetailHref } from '@/lib/notice-links';
import { baseNoticeProjects, inferDisciplineCategory, inferSchoolRange } from '@/lib/notice-source';
import type { PublicNoticeProject } from '@/lib/mock-data';

type SortOption = 'publish' | 'deadline' | 'school';
type ProgressFilter = '全部' | '报名中' | '未开始' | '已结束';
type RangeFilter = '全部' | '985' | '211' | '双一流' | '其他';

const PAGE_SIZE = 15;

function matchesProgress(filter: ProgressFilter, project: PublicNoticeProject) {
  if (filter === '全部') return true;
  if (filter === '报名中') return project.status === '报名中' || project.status === '即将截止';
  if (filter === '未开始') return project.status === '未开始';
  return project.status === '已截止' || project.status === '已结束' || project.status === '活动中';
}

function getVisiblePages(currentPage: number, totalPages: number) {
  const start = Math.max(1, currentPage - 1);
  const end = Math.min(totalPages, currentPage + 1);
  const pages: number[] = [];

  for (let value = start; value <= end; value += 1) {
    pages.push(value);
  }

  if (!pages.includes(1)) {
    pages.unshift(1);
  }

  if (!pages.includes(totalPages)) {
    pages.push(totalPages);
  }

  return Array.from(new Set(pages));
}

export default function NoticesPage() {
  const [projects, setProjects] = useState<PublicNoticeProject[]>(() =>
    baseNoticeProjects.filter((item) => String(item.year) === '2026')
  );
  const [keyword, setKeyword] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [majorKeyword, setMajorKeyword] = useState('');
  const [category, setCategory] = useState('全部');
  const [discipline, setDiscipline] = useState('全部');
  const [schoolRange, setSchoolRange] = useState<RangeFilter>('全部');
  const [progress, setProgress] = useState<ProgressFilter>('全部');
  const [projectType, setProjectType] = useState('全部');
  const [year, setYear] = useState('2026');
  const [sortBy, setSortBy] = useState<SortOption>('publish');
  const [pageState, setPageState] = useState({ page: 1, filterKey: '' });
  const [jumpPage, setJumpPage] = useState('');
  const filterKey = [
    keyword.trim().toLowerCase(),
    schoolName.trim().toLowerCase(),
    majorKeyword.trim().toLowerCase(),
    category,
    discipline,
    schoolRange,
    progress,
    projectType,
    year,
    sortBy
  ].join('|');

  useEffect(() => {
    let active = true;

    fetchPublicNotices().then((rows: PublicNoticeProject[]) => {
      if (active) {
        setProjects(rows.filter((item) => String(item.year) === '2026'));
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const categoryOptions = useMemo(
    () => ['全部', ...Array.from(new Set(projects.map((item) => inferDisciplineCategory(item.discipline))))],
    [projects]
  );

  const disciplineOptions = useMemo(() => {
    const rows =
      category === '全部'
        ? projects
        : projects.filter((item) => inferDisciplineCategory(item.discipline) === category);

    return ['全部', ...Array.from(new Set(rows.map((item) => getDisplayDiscipline(item.discipline)).filter(Boolean)))];
  }, [projects, category]);

  const filteredProjects = useMemo(() => {
    const noticeKeyword = keyword.trim().toLowerCase();
    const schoolKeyword = schoolName.trim().toLowerCase();
    const majorText = majorKeyword.trim().toLowerCase();

    const rows = projects.filter((item) => {
      const matchesType = projectType === '全部' ? true : item.projectType === projectType;
      const matchesRange = schoolRange === '全部' ? true : inferSchoolRange(item) === schoolRange;
      const matchesSchool = !schoolKeyword || item.schoolName.toLowerCase().includes(schoolKeyword);
      const matchesCategory = category === '全部' ? true : inferDisciplineCategory(item.discipline) === category;
      const matchesDiscipline = discipline === '全部' ? true : getDisplayDiscipline(item.discipline) === discipline;
      const matchesMajor =
        !majorText ||
        [item.discipline, item.departmentName, item.projectName].join(' ').toLowerCase().includes(majorText);
      const matchesProgressState = matchesProgress(progress, item);
      const matchesYear = year === '全部' ? true : String(item.year) === year;
      const matchesKeyword =
        !noticeKeyword ||
        [getDisplaySchoolName(item.schoolName), item.departmentName, item.projectName, item.discipline, item.tags.join(' ')]
          .join(' ')
          .toLowerCase()
          .includes(noticeKeyword);

      return (
        matchesType &&
        matchesRange &&
        matchesSchool &&
        matchesCategory &&
        matchesDiscipline &&
        matchesMajor &&
        matchesProgressState &&
        matchesYear &&
        matchesKeyword
      );
    });

    return rows.sort((left, right) => {
      if (sortBy === 'deadline') {
        const leftDeadline = left.deadlineDate || '9999-12-31 23:59';
        const rightDeadline = right.deadlineDate || '9999-12-31 23:59';
        return leftDeadline.localeCompare(rightDeadline);
      }

      if (sortBy === 'school') {
        return left.schoolName.localeCompare(right.schoolName, 'zh-CN');
      }

      return right.publishDate.localeCompare(left.publishDate);
    });
  }, [projects, keyword, schoolName, majorKeyword, category, discipline, schoolRange, progress, projectType, year, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const requestedPage = pageState.filterKey === filterKey ? pageState.page : 1;
  const currentPage = Math.min(requestedPage, totalPages);
  const pagedProjects = filteredProjects.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visiblePages = getVisiblePages(currentPage, totalPages);

  function updatePage(nextPage: number | ((currentPage: number) => number)) {
    setPageState((current) => {
      const basePage = current.filterKey === filterKey ? current.page : 1;
      const resolvedPage = typeof nextPage === 'function' ? nextPage(basePage) : nextPage;

      return {
        filterKey,
        page: resolvedPage
      };
    });
  }

  function handleJumpPage() {
    const parsed = Number(jumpPage);
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      updatePage(parsed);
    }
  }

  return (
    <SiteShell>
      <section className="space-y-5 rounded-[30px] border border-black/5 bg-white p-5 shadow-soft lg:p-6">
        <div className="flex flex-col gap-4 border-b border-black/5 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">通知库</h1>
            <p className="mt-2 text-sm text-slate-500">先看院校，再看项目，按发布时间或截止时间快速筛选重点通知。</p>
          </div>

          <div className="flex w-full max-w-[360px] items-center gap-3 rounded-2xl border border-black/5 bg-slate-50 px-4 py-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索学校、学院或关键词"
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-7 text-emerald-800">
          通知库优先展示 2026 年公开院校通知，数据来自院校官网和公开入口自动同步；每条通知都保留原文链接，关键申请动作请以官网原文为准。
        </div>

        <div className="flex flex-wrap gap-2">
          {['全部', '夏令营', '预推免', '正式推免'].map((item) => (
            <button
              key={item}
              onClick={() => setProjectType(item)}
              className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                projectType === item ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="grid gap-4 rounded-[26px] bg-slate-50/90 p-4 lg:p-5">
          <div className="grid gap-3 lg:grid-cols-[110px_minmax(0,1fr)_120px_260px] lg:items-center">
            <div className="text-sm font-semibold text-slate-500">学校范围</div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
              {(['全部', '985', '211', '双一流', '其他'] as RangeFilter[]).map((item) => (
                <label key={item} className="inline-flex items-center gap-2">
                  <input type="radio" checked={schoolRange === item} onChange={() => setSchoolRange(item)} />
                  {item}
                </label>
              ))}
            </div>
            <div className="text-sm font-semibold text-slate-500">学校名称</div>
            <input
              value={schoolName}
              onChange={(event) => setSchoolName(event.target.value)}
              placeholder="请输入学校名称"
              className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-[110px_170px_170px_minmax(0,1fr)] lg:items-center">
            <div className="text-sm font-semibold text-slate-500">学科专业</div>
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setDiscipline('全部');
              }}
              className="rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none"
            >
              {categoryOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={discipline}
              onChange={(event) => setDiscipline(event.target.value)}
              className="rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none"
            >
              {disciplineOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input
              value={majorKeyword}
              onChange={(event) => setMajorKeyword(event.target.value)}
              placeholder="请输入专业名称"
              className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-[110px_minmax(0,1fr)_120px_170px_120px] lg:items-center">
            <div className="text-sm font-semibold text-slate-500">进行状态</div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
              {(['全部', '报名中', '未开始', '已结束'] as ProgressFilter[]).map((item) => (
                <label key={item} className="inline-flex items-center gap-2">
                  <input type="radio" checked={progress === item} onChange={() => setProgress(item)} />
                  {item}
                </label>
              ))}
            </div>
            <div className="text-sm font-semibold text-slate-500">通知年份</div>
            <select
              value={year}
              onChange={(event) => setYear(event.target.value)}
              className="rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none"
            >
              <option value="2026">2026</option>
            </select>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white"
            >
              <Search className="h-4 w-4" />
              搜索
            </button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-[24px] bg-white/80 px-5 py-4 shadow-soft lg:flex-row lg:items-center lg:justify-end">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSortBy('publish')}
            className={`rounded-2xl px-4 py-2.5 text-sm font-semibold ${
              sortBy === 'publish' ? 'bg-brand text-white' : 'bg-white text-slate-600 shadow-sm'
            }`}
          >
            按发布时间排序
          </button>
          <button
            onClick={() => setSortBy('deadline')}
            className={`rounded-2xl px-4 py-2.5 text-sm font-semibold ${
              sortBy === 'deadline' ? 'bg-brand text-white' : 'bg-white text-slate-600 shadow-sm'
            }`}
          >
            按截止日期排序
          </button>
          <button
            onClick={() => setSortBy('school')}
            className={`rounded-2xl px-4 py-2.5 text-sm font-semibold ${
              sortBy === 'school' ? 'bg-brand text-white' : 'bg-white text-slate-600 shadow-sm'
            }`}
          >
            按学校排序
          </button>
        </div>
      </section>

      <section className="grid gap-4">
        {pagedProjects.map((project) => (
          <article key={project.id} className="rounded-[30px] border border-black/5 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brand-cream px-3 py-1 text-xs font-semibold text-brand">
                    {getDisplayProjectType(project.projectType)}
                  </span>
                  <DeadlineBadge level={project.deadlineLevel} />
                  <StatusBadge status={project.status} />
                </div>

                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0">
                    <div className="text-[1.7rem] font-semibold tracking-tight text-ink">{getDisplaySchoolName(project.schoolName)}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <span>{getDisplayDepartmentName(project.departmentName)}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">{formatNoticeDateOnly(project.publishDate)}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">截止：{formatNoticeDate(project.deadlineDate)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-base font-semibold leading-7 text-slate-700 [display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                  {normalizeNoticeTitle(project.projectName)}
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                  {project.discipline ? (
                    <span className="rounded-full bg-brand-cream px-3 py-1 font-semibold text-brand">
                      {getDisplayDiscipline(project.discipline)}
                    </span>
                  ) : null}
                  {getDisplayTags(project.tags).slice(0, 4).map((item) => (
                    <span key={item} className="rounded-full bg-slate-100 px-3 py-1">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid w-full gap-3 xl:w-[190px]">
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
        ))}

        {!pagedProjects.length ? (
          <div className="rounded-[28px] border border-dashed border-black/10 bg-white/70 px-6 py-16 text-center text-sm text-slate-500">
            当前筛选条件下没有匹配通知，换一个学校、学科或状态试试。
          </div>
        ) : null}
      </section>

      {filteredProjects.length ? (
        <section className="rounded-[30px] bg-white px-5 py-6 shadow-soft">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => updatePage((current) => Math.max(1, current - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </button>

            {visiblePages.map((pageNumber) => (
              <button
                key={pageNumber}
                onClick={() => updatePage(pageNumber)}
                className={`h-12 min-w-12 rounded-2xl px-4 text-sm font-semibold ${
                  currentPage === pageNumber ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {pageNumber}
              </button>
            ))}

            <button
              onClick={() => updatePage((current) => Math.min(totalPages, current + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-45"
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </button>

            <input
              value={jumpPage}
              onChange={(event) => setJumpPage(event.target.value.replace(/[^\d]/g, ''))}
              placeholder="页码"
              className="h-12 w-28 rounded-2xl border border-black/5 px-4 text-center text-sm outline-none"
            />
            <button onClick={handleJumpPage} className="h-12 rounded-2xl bg-brand px-5 text-sm font-semibold text-white">
              跳转
            </button>
          </div>
        </section>
      ) : null}
    </SiteShell>
  );
}
