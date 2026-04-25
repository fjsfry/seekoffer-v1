'use client';

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BellRing,
  BookOpenText,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GraduationCap,
  Lightbulb,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react';
import { ApplicationActionButton } from '@/components/application-action-button';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { SiteShell } from '@/components/site-shell';
import { DeadlineBadge, StatusBadge } from '@/components/status-badge';
import { fetchPublicNotices } from '@/lib/cloudbase-data';
import {
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

type SortOption = 'deadline' | 'publish' | 'school';
type ProgressFilter = '全部' | '报名中' | '未开始' | '已结束';
type RangeFilter = '全部' | '985' | '211' | '双一流' | '其他';

const PAGE_SIZE = 8;

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

  if (!pages.includes(1)) pages.unshift(1);
  if (!pages.includes(totalPages)) pages.push(totalPages);

  return Array.from(new Set(pages));
}

function getNoticeCardTags(project: PublicNoticeProject) {
  const seen = new Set<string>();
  const tags = [getDisplayProjectType(project.projectType), getDisplayDiscipline(project.discipline), ...getDisplayTags(project.tags)]
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) {
        return false;
      }

      seen.add(item);
      return true;
    });

  return tags.slice(0, 4);
}

function parseDeadline(project: PublicNoticeProject) {
  const date = project.deadlineDate || '9999-12-31 23:59';
  const timestamp = new Date(`${date.replace(' ', 'T')}:00+08:00`).getTime();
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

function getDaysLeft(project: PublicNoticeProject) {
  const timestamp = parseDeadline(project);
  if (timestamp === Number.MAX_SAFE_INTEGER) return null;

  return Math.max(0, Math.ceil((timestamp - Date.now()) / (1000 * 60 * 60 * 24)));
}

function sortProjects(rows: PublicNoticeProject[], sortBy: SortOption) {
  return rows.sort((left, right) => {
    const leftExpired = left.deadlineLevel === 'expired' ? 1 : 0;
    const rightExpired = right.deadlineLevel === 'expired' ? 1 : 0;

    if (leftExpired !== rightExpired) {
      return leftExpired - rightExpired;
    }

    if (sortBy === 'deadline') {
      return parseDeadline(left) - parseDeadline(right);
    }

    if (sortBy === 'school') {
      return left.schoolName.localeCompare(right.schoolName, 'zh-CN');
    }

    return right.publishDate.localeCompare(left.publishDate);
  });
}

function getCityTag(project: PublicNoticeProject) {
  return (project.tags || []).find((tag) => /北京|上海|广州|南京|杭州|天津|武汉|成都|西安|合肥|苏州|香港/.test(tag));
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
  const [sortBy, setSortBy] = useState<SortOption>('deadline');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [pageState, setPageState] = useState({ page: 1, filterKey: '' });
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
      const matchesSchool =
        !schoolKeyword ||
        [getDisplaySchoolName(item.schoolName), getDisplayDepartmentName(item.departmentName)].join(' ').toLowerCase().includes(schoolKeyword);
      const matchesCategory = category === '全部' ? true : inferDisciplineCategory(item.discipline) === category;
      const matchesDiscipline = discipline === '全部' ? true : getDisplayDiscipline(item.discipline) === discipline;
      const matchesMajor =
        !majorText ||
        [item.discipline, item.departmentName, item.projectName, item.tags.join(' ')].join(' ').toLowerCase().includes(majorText);
      const matchesProgressState = matchesProgress(progress, item);
      const matchesYear = year === '全部' ? true : String(item.year) === year;
      const matchesKeyword =
        !noticeKeyword ||
        [
          getDisplaySchoolName(item.schoolName),
          getDisplayDepartmentName(item.departmentName),
          item.projectName,
          item.discipline,
          item.tags.join(' ')
        ]
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

    return sortProjects(rows, sortBy);
  }, [projects, keyword, schoolName, majorKeyword, category, discipline, schoolRange, progress, projectType, year, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const requestedPage = pageState.filterKey === filterKey ? pageState.page : 1;
  const currentPage = Math.min(requestedPage, totalPages);
  const pagedProjects = filteredProjects.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visiblePages = getVisiblePages(currentPage, totalPages);
  const latestPublishDate = projects.reduce((latest, item) => (item.publishDate > latest ? item.publishDate : latest), '');

  const pageStats = [
    { label: '2026通知', value: `${projects.length}+`, icon: BellRing },
    { label: '最新更新', value: `${projects.filter((item) => item.publishDate === latestPublishDate).length}`, icon: BookOpenText },
    {
      label: '3天内截止',
      value: `${projects.filter((item) => item.deadlineLevel === 'today' || item.deadlineLevel === 'within3days').length}`,
      icon: Clock3
    }
  ];

  const urgentProjects = useMemo(
    () =>
      sortProjects(
        projects.filter((item) => ['today', 'within3days', 'within7days'].includes(item.deadlineLevel)),
        'deadline'
      ).slice(0, 5),
    [projects]
  );

  const weeklyUpdates = useMemo(() => {
    const counts = new Map<string, number>();
    projects
      .filter((item) => item.publishDate >= latestPublishDate.slice(0, 7))
      .forEach((item) => {
        const school = getDisplaySchoolName(item.schoolName);
        counts.set(school, (counts.get(school) || 0) + 1);
      });

    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5);
  }, [projects, latestPublishDate]);

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

  function resetFilters() {
    setKeyword('');
    setSchoolName('');
    setMajorKeyword('');
    setCategory('全部');
    setDiscipline('全部');
    setSchoolRange('全部');
    setProgress('全部');
    setProjectType('全部');
    setYear('2026');
    setSortBy('deadline');
  }

  return (
    <SiteShell>
      <section className="grid gap-6 py-5 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center">
        <div>
          <div className="eyebrow">Notice Library</div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-ink">通知库</h1>
          <p className="mt-4 text-base leading-8 text-slate-600">
            持续同步公开保研通知，优先展示可报名项目与关键截止时间。
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {pageStats.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.label} className="rounded-full border border-slate-200 bg-white px-5 py-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/8 text-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-xs text-slate-500">{item.label}</div>
                    <div className="text-xl font-semibold text-ink">{item.value}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="product-card rounded-[24px] p-5 lg:p-6">
        <div className="flex flex-wrap gap-4 border-b border-slate-100 pb-5">
          {['全部', '夏令营', '预推免', '正式推免'].map((item) => (
            <button
              key={item}
              onClick={() => setProjectType(item)}
              className={`relative px-4 py-2 text-sm font-semibold transition ${
                projectType === item ? 'text-brand' : 'text-slate-500 hover:text-brand'
              }`}
            >
              {item}
              <span
                className={`absolute inset-x-3 -bottom-5 h-0.5 rounded-full bg-brand transition ${
                  projectType === item ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_132px]">
          <label className="flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
            <Search className="h-5 w-5 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索学校 / 学院 / 专业关键词"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </label>
          <button
            type="button"
            onClick={() => setAdvancedOpen((current) => !current)}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {advancedOpen ? '收起筛选' : '高级筛选'}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-[repeat(5,minmax(0,1fr))_132px]">
          <FilterSelect label="年份" value={year} onChange={setYear}>
            <option value="2026">2026</option>
            <option value="全部">全部</option>
          </FilterSelect>
          <FilterSelect label="学校层次" value={schoolRange} onChange={(value) => setSchoolRange(value as RangeFilter)}>
            {(['全部', '985', '211', '双一流', '其他'] as RangeFilter[]).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </FilterSelect>
          <FilterInput label="城市 / 学校" value={schoolName} onChange={setSchoolName} placeholder="全部" />
          <FilterSelect
            label="学科"
            value={category}
            onChange={(value) => {
              setCategory(value);
              setDiscipline('全部');
            }}
          >
            {categoryOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="状态" value={progress} onChange={(value) => setProgress(value as ProgressFilter)}>
            {(['全部', '报名中', '未开始', '已结束'] as ProgressFilter[]).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </FilterSelect>
          <button
            type="button"
            onClick={resetFilters}
            className="h-12 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-500 transition hover:border-brand hover:text-brand"
          >
            重置
          </button>
        </div>

        {advancedOpen ? (
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-3">
            <FilterInput label="专业关键词" value={majorKeyword} onChange={setMajorKeyword} placeholder="例如 人工智能" />
            <FilterSelect label="细分专业" value={discipline} onChange={setDiscipline}>
              {disciplineOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="排序" value={sortBy} onChange={(value) => setSortBy(value as SortOption)}>
              <option value="deadline">按截止时间排序</option>
              <option value="publish">按发布时间排序</option>
              <option value="school">按学校名称排序</option>
            </FilterSelect>
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="font-semibold text-ink">共 {filteredProjects.length.toLocaleString('zh-CN')} 条结果</span>
              <span className="text-slate-400">|</span>
              <button
                onClick={() => setSortBy('deadline')}
                className={sortBy === 'deadline' ? 'font-semibold text-brand' : 'text-slate-500 hover:text-brand'}
              >
                按截止时间排序
              </button>
              <button
                onClick={() => setSortBy('publish')}
                className={sortBy === 'publish' ? 'font-semibold text-brand' : 'text-slate-500 hover:text-brand'}
              >
                按发布时间排序
              </button>
            </div>
            <button onClick={resetFilters} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand">
              <RefreshCw className="h-4 w-4" />
              刷新筛选
            </button>
          </div>

          {pagedProjects.map((project, index) => {
            const daysLeft = getDaysLeft(project);
            const city = getCityTag(project);
            const highlighted = currentPage === 1 && index === 0 && project.deadlineLevel !== 'expired';

            return (
              <article
                key={project.id}
                className={`relative overflow-hidden rounded-[24px] border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft ${
                  highlighted ? 'border-emerald-300 bg-emerald-50/35' : 'border-slate-200'
                }`}
              >
                {highlighted ? (
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-br-2xl bg-emerald-500 text-sm font-bold text-white">
                    急
                  </div>
                ) : null}

                <div className="grid gap-5 sm:grid-cols-[76px_minmax(0,1fr)_190px]">
                  <ExternalSiteMark
                    source={project.sourceLink}
                    label={getDisplaySchoolName(project.schoolName)}
                    size="lg"
                    rounded="full"
                  />

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-ink">{getDisplaySchoolName(project.schoolName)}</h2>
                      <span className="text-sm text-slate-500">{getDisplayDepartmentName(project.departmentName)}</span>
                      <DeadlineBadge level={project.deadlineLevel} />
                    </div>
                    <Link
                      href={buildNoticeDetailHref(project.id)}
                      className="mt-2 block text-lg font-semibold leading-8 text-slate-800 hover:text-brand"
                    >
                      {normalizeNoticeTitle(project.projectName, 76)}
                    </Link>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        发布于 {formatNoticeDateOnly(project.publishDate)}
                      </span>
                      {city ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {city}
                        </span>
                      ) : null}
                      <span>{getDisplayDiscipline(project.discipline)}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {getNoticeCardTags(project).map((item) => (
                        <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:justify-items-end">
                    <StatusBadge status={project.status} />
                    <div className="text-right text-sm">
                      <div className="font-semibold text-brand">截止 {formatNoticeDateOnly(project.deadlineDate)}</div>
                      <div className="mt-1 text-slate-500">
                        {daysLeft === null ? '时间待补充' : project.deadlineLevel === 'expired' ? '已截止' : `剩余 ${daysLeft} 天`}
                      </div>
                    </div>
                    <div className="grid w-full gap-2 sm:w-[150px]">
                      <Link
                        href={buildNoticeDetailHref(project.id)}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-deep"
                      >
                        查看详情
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      <ApplicationActionButton projectId={project.id} variant="secondary" />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}

          {!pagedProjects.length ? (
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500">
              当前筛选条件下没有匹配通知，建议减少筛选条件或换一个关键词。
            </div>
          ) : null}

          {filteredProjects.length ? (
            <div className="flex flex-wrap items-center justify-center gap-3 rounded-[22px] bg-white px-5 py-5 shadow-sm">
              <button
                onClick={() => updatePage((current) => Math.max(1, current - 1))}
                disabled={currentPage === 1}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {visiblePages.map((pageNumber, index) => (
                <button
                  key={`${pageNumber}-${index}`}
                  onClick={() => updatePage(pageNumber)}
                  className={`h-11 min-w-11 rounded-xl px-4 text-sm font-semibold ${
                    currentPage === pageNumber ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {pageNumber}
                </button>
              ))}

              <button
                onClick={() => updatePage((current) => Math.min(totalPages, current + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>

        <aside className="grid content-start gap-5">
          <SideCard title="截止提醒" icon={BellRing}>
            <div className="grid gap-4">
              {urgentProjects.length ? (
                urgentProjects.map((project) => {
                  const daysLeft = getDaysLeft(project);

                  return (
                    <Link key={project.id} href={buildNoticeDetailHref(project.id)} className="grid gap-1 rounded-xl p-2 hover:bg-slate-50">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-semibold text-slate-700">{getDisplaySchoolName(project.schoolName)}</span>
                        <span className="font-semibold text-rose-500">{daysLeft ?? '-'} 天后</span>
                      </div>
                      <div className="line-clamp-1 text-xs text-slate-500">{normalizeNoticeTitle(project.projectName, 34)}</div>
                      <div className="text-xs text-slate-400">{formatNoticeDateOnly(project.deadlineDate)} 截止</div>
                    </Link>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">暂无 7 天内截止通知。</div>
              )}
            </div>
          </SideCard>

          <SideCard title="本周更新" icon={RefreshCw}>
            <div className="grid gap-3">
              {weeklyUpdates.map(([school, count]) => (
                <div key={school} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-700">{school}</span>
                  <span className="font-semibold text-slate-500">{count} 条</span>
                </div>
              ))}
            </div>
          </SideCard>

          <SideCard title="数据说明" icon={Lightbulb}>
            <p className="text-sm leading-7 text-slate-600">
              通知来源于院校官网与公开入口，Seekoffer 会做字段清洗、时间提取和去重整理。关键申请要求仍建议以原文为准。
            </p>
            <Link href="/disclaimer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand">
              了解更多
              <ArrowRight className="h-4 w-4" />
            </Link>
          </SideCard>
        </aside>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <PromoCard title="院校库" description="院校信息、专业设置及推免政策查询" href="/colleges" icon={GraduationCap} />
        <PromoCard title="资源库" description="汇集面试经验与文书模板，助力申请" href="/resources" icon={BookOpenText} />
        <PromoCard title="AI定位" description="智能评估背景竞争力，辅助精准定位" href="/ai" icon={Sparkles} />
      </section>
    </SiteShell>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="soft-input h-12 w-full rounded-xl px-4 text-sm text-slate-700 outline-none placeholder:text-slate-400"
      />
    </label>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="soft-input h-12 w-full rounded-xl px-4 text-sm font-semibold text-slate-700 outline-none"
      >
        {children}
      </select>
    </label>
  );
}

function SideCard({
  title,
  icon: Icon,
  children
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <div className="product-card rounded-[22px] p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/8 text-brand">
            <Icon className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
        </div>
        <Link href="/notices" className="text-xs font-semibold text-slate-400 hover:text-brand">
          更多
        </Link>
      </div>
      {children}
    </div>
  );
}

function PromoCard({
  title,
  description,
  href,
  icon: Icon
}: {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href} className="product-card group relative overflow-hidden rounded-[22px] p-6">
      <div className="relative z-10">
        <div className="text-xl font-semibold text-ink">{title}</div>
        <p className="mt-3 text-sm leading-7 text-slate-500">{description}</p>
        <span className="mt-6 inline-flex items-center gap-2 rounded-xl border border-brand/25 bg-white px-4 py-2.5 text-sm font-semibold text-brand">
          进入{title}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
      <div className="absolute right-5 top-1/2 flex h-24 w-24 -translate-y-1/2 items-center justify-center rounded-[26px] bg-brand/8 text-brand">
        <Icon className="h-12 w-12" />
      </div>
    </Link>
  );
}
