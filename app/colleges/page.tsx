'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, MapPin, Search } from 'lucide-react';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { collegeDirectory } from '@/lib/college-directory';

const PAGE_SIZE = 15;
const allCityLabel = '全部城市';
const allGroupLabel = '全部标签';
const cityOptions = [allCityLabel, ...Array.from(new Set(collegeDirectory.map((item) => item.city)))];
const groupOptions = [allGroupLabel, '985', '211', '双一流', 'C9', '华五', '国防七子'];

function getVisiblePages(currentPage: number, totalPages: number) {
  const start = Math.max(1, currentPage - 1);
  const end = Math.min(totalPages, currentPage + 1);
  const pages: number[] = [];

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (!pages.includes(1)) {
    pages.unshift(1);
  }

  if (!pages.includes(totalPages)) {
    pages.push(totalPages);
  }

  return Array.from(new Set(pages));
}

export default function CollegesPage() {
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState(allCityLabel);
  const [group, setGroup] = useState(allGroupLabel);
  const [page, setPage] = useState(1);
  const [jumpPage, setJumpPage] = useState('');

  const filteredColleges = useMemo(() => {
    const query = keyword.trim().toLowerCase();

    return collegeDirectory.filter((item) => {
      const matchesKeyword = !query
        ? true
        : [item.name, item.city, item.focus, item.domain, item.groups.join(' ')]
            .join(' ')
            .toLowerCase()
            .includes(query);
      const matchesCity = city === allCityLabel ? true : item.city === city;
      const matchesGroup = group === allGroupLabel ? true : item.groups.includes(group);

      return matchesKeyword && matchesCity && matchesGroup;
    });
  }, [keyword, city, group]);

  useEffect(() => {
    setPage(1);
  }, [keyword, city, group]);

  const totalPages = Math.max(1, Math.ceil(filteredColleges.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedColleges = filteredColleges.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visiblePages = getVisiblePages(currentPage, totalPages);

  function handleJumpPage() {
    const parsed = Number(jumpPage);
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      setPage(parsed);
    }
  }

  return (
    <SiteShell>
      <PageSectionTitle
        eyebrow="College Directory"
        title="院校库"
        subtitle="只保留官网直达入口，优先服务真实回访场景。按城市、标签和关键词快速筛选，找到学校后直接回到官网继续核对信息。"
      />

      <section className="surface-card rounded-[34px] p-7 lg:p-8">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px_240px]">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索学校、城市、官网域名或标签"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <select
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
          >
            {cityOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={group}
            onChange={(event) => setGroup(event.target.value)}
            className="rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
          >
            {groupOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {groupOptions.slice(1).map((item) => (
            <button
              key={item}
              onClick={() => setGroup(item)}
              className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                group === item ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {item}
            </button>
          ))}
          <button
            onClick={() => setGroup(allGroupLabel)}
            className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
              group === allGroupLabel ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            全部标签
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {pagedColleges.map((item) => (
          <article
            key={item.name}
            className="surface-card rounded-[32px] p-6 transition hover:-translate-y-1 hover:shadow-soft"
          >
            <div className="flex items-start gap-4">
              <ExternalSiteMark source={item.website} label={item.name} size="xl" rounded="full" variant="badge" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-2">
                  {item.groups.map((entry) => (
                    <span key={entry} className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                      {entry}
                    </span>
                  ))}
                </div>
                <div className="mt-4 text-2xl font-semibold tracking-tight text-ink">{item.name}</div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.focus}</p>
                <div className="mt-4 inline-flex items-center gap-2 text-sm text-slate-500">
                  <MapPin className="h-4 w-4" />
                  {item.city}
                </div>
                <div className="mt-6">
                  <a
                    href={item.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white"
                  >
                    打开学校官网
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>

      {!pagedColleges.length ? (
        <section className="surface-card rounded-[30px] px-6 py-12 text-center text-sm text-slate-500">
          当前筛选条件下没有匹配院校，换一个城市、标签或关键词试试看。
        </section>
      ) : null}

      {filteredColleges.length ? (
        <section className="rounded-[30px] bg-white px-5 py-6 shadow-soft">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </button>

            {visiblePages.map((pageNumber) => (
              <button
                key={pageNumber}
                onClick={() => setPage(pageNumber)}
                className={`h-12 min-w-12 rounded-2xl px-4 text-sm font-semibold ${
                  currentPage === pageNumber ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {pageNumber}
              </button>
            ))}

            <button
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
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
