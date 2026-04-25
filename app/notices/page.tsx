'use client';

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BellRing,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Filter,
  GraduationCap,
  Lightbulb,
  RefreshCw,
  Search,
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

type SortOption = 'publish' | 'deadline' | 'school';
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

  if (!pages.includes(1)) {
    pages.unshift(1);
  }

  if (!pages.includes(totalPages)) {
    pages.push(totalPages);
  }

  return Array.from(new Set(pages));
}

function getNoticeCardTags(project: PublicNoticeProject) {
  const seen = new Set<string>();
  const tags = [getDisplayDiscipline(project.discipline), ...getDisplayTags(project.tags)]
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) {
        return false;
      }

      seen.add(item);
      return true;
    });

  return tags.slice(0, 3);
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

  const deadlineGroups = useMemo(
    () => [
      { label: '今天截止', count: projects.filter((item) => item.deadlineLevel === 'today').length, tone: 'text-rose-500' },
      { label: '3天内截止', count: projects.filter((item) => item.deadlineLevel === 'within3days').length },
      { label: '7天内截止', count: projects.filter((item) => item.deadlineLevel === 'within7days').length },
      {
        label: '30天内截止',
        count: projects.filter((item) => item.deadlineLevel === 'future' || item.deadlineLevel === 'within7days').length
      }
    ],
    [projects]
  );

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
    setSortBy('publish');
  }

  return (
    <SiteShell>
      <section className="grid gap-6 py-5 lg:grid-cols-[minmax(0,1fr)_480px] lg:items-end">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-ink">通知库</h1>
          <p className="mt-4 text-base leading-8 text-slate-600">快速查找并管理保研相关通知，把握每一次申请机会。</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索学校、学院或通知关键词"
            className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>
      </section>

      <section className="product-card rounded-[24px] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap gap-3">
            {['全部', '夏令营', '预推免', '正式推免'].map((item) => (
              <button
                key={item}
                onClick={() => setProjectType(item)}
                className={`rounded-xl px-6 py-3 text-sm font-semibold transition ${
                  projectType === item ? 'bg-brand text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <FilterSelect label="年份" value={year} onChange={setYear}>
              <option value="2026">2026</option>
            </FilterSelect>
            <button
              type="button"
              onClick={() => setAdvancedOpen((current) => !current)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-brand/25 bg-white px-5 text-sm font-semibold text-brand transition hover:border-brand"
            >
              <Filter className="h-4 w-4" />
              {advancedOpen ? '收起筛选' : '高级筛选'}
            </button>
          </div>
        </div>

        {advancedOpen ? (
          <div className="mt-6 border-t border-slate-100 pt-6">
            <div className="grid gap-4 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto] lg:items-end">
              <FilterSelect label="学校层次" value={schoolRange} onChange={(value) => setSchoolRange(value as RangeFilter)}>
                {(['全部', '985', '211', '双一流', '其他'] as RangeFilter[]).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </FilterSelect>
              <FilterInput label="城市 / 学校" value={schoolName} onChange={setSchoolName} placeholder="全部" />
              <FilterSelect
                label="专业大类"
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
              <FilterSelect label="排序" value={sortBy} onChange={(value) => setSortBy(value as SortOption)}>
                <option value="publish">按发布时间</option>
                <option value="deadline">按截止日期</option>
                <option value="school">按学校名称</option>
              </FilterSelect>
              <button
                type="button"
                onClick={resetFilters}
                className="h-12 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-500 transition hover:border-brand hover:text-brand"
              >
                重置
              </button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <FilterInput label="专业关键词" value={majorKeyword} onChange={setMajorKeyword} placeholder="例如 人工智能" />
              <FilterSelect label="细分专业" value={discipline} onChange={setDiscipline}>
                {disciplineOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </FilterSelect>
            </div>
          </div>
        ) : null}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span className="font-semibold text-ink">共找到 {filteredProjects.length.toLocaleString('zh-CN')} 条结果</span>
          <span>已选条件：</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">年份：{year}</span>
          {projectType !== '全部' ? <span className="rounded-full bg-slate-100 px-3 py-1">{projectType}</span> : null}
          {keyword ? <span className="rounded-full bg-slate-100 px-3 py-1">{keyword}</span> : null}
        </div>

        <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-500">
          {sortBy === 'publish' ? '按发布时间' : sortBy === 'deadline' ? '按截止日期' : '按学校名称'}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4">
          {pagedProjects.map((project) => (
            <article key={project.id} className="product-card rounded-[22px] p-5">
              <div className="grid gap-5 sm:grid-cols-[76px_minmax(0,1fr)_130px]">
                <ExternalSiteMark
                  source={project.sourceLink}
                  label={getDisplaySchoolName(project.schoolName)}
                  size="lg"
                  rounded="full"
                />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-ink">{getDisplaySchoolName(project.schoolName)}</h2>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-brand">
                      {getDisplayProjectType(project.projectType)}
                    </span>
                    <DeadlineBadge level={project.deadlineLevel} />
                    <StatusBadge status={project.status} />
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{getDisplayDepartmentName(project.departmentName)}</div>
                  <Link
                    href={buildNoticeDetailHref(project.id)}
                    className="mt-3 block text-base font-semibold leading-7 text-slate-700 hover:text-brand"
                  >
                    {normalizeNoticeTitle(project.projectName, 70)}
                  </Link>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    {getNoticeCardTags(project).map((item) => (
                      <span key={item} className="rounded-full bg-slate-100 px-3 py-1">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:justify-items-end">
                  <div className="text-sm text-slate-500">截止：{formatNoticeDateOnly(project.deadlineDate)}</div>
                  <Link
                    href={buildNoticeDetailHref(project.id)}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-brand/25 px-4 py-2.5 text-sm font-semibold text-brand transition hover:border-brand sm:w-auto"
                  >
                    查看详情
                  </Link>
                  <ApplicationActionButton projectId={project.id} variant="secondary" />
                </div>
              </div>
            </article>
          ))}

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
              {deadlineGroups.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-slate-700">{item.label}</span>
                  <span className={item.tone || 'text-slate-500'}>{item.count}</span>
                </div>
              ))}
            </div>
            <Link
              href="/me"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand/25 px-4 py-3 text-sm font-semibold text-brand"
            >
              <BellRing className="h-4 w-4" />
              登录后加入提醒
            </Link>
          </SideCard>

          <SideCard title="筛选建议" icon={Lightbulb}>
            <div className="grid gap-4 text-sm text-slate-600">
              <Suggestion text="关注计算机科学与技术相关通知" count={projects.filter((item) => item.discipline.includes('计算机')).length} />
              <Suggestion text="筛选 985 高校的预推免通知" count={projects.filter((item) => inferSchoolRange(item) === '985').length} />
              <Suggestion text="查看新增的 2026 届通知" count={projects.length} />
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand/25 px-4 py-3 text-sm font-semibold text-brand"
            >
              <RefreshCw className="h-4 w-4" />
              换一批建议
            </button>
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
      <div className="mb-5 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/8 text-brand">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Suggestion({ text, count }: { text: string; count: number }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/8 text-brand">
        <Lightbulb className="h-4 w-4" />
      </span>
      <div>
        <div className="leading-6">{text}</div>
        <div className="mt-1 text-xs text-slate-400">共 {count} 条</div>
      </div>
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
