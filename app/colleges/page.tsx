'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, MapPin, Search } from 'lucide-react';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { collegeDirectory } from '@/lib/college-directory';

const cityOptions = ['全部城市', ...Array.from(new Set(collegeDirectory.map((item) => item.city)))];
const groupOptions = ['全部标签', '985', '211', '双一流', 'C9', '华五', '国防七子'];

export default function CollegesPage() {
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState('全部城市');
  const [group, setGroup] = useState('全部标签');

  const filteredColleges = useMemo(() => {
    const query = keyword.trim().toLowerCase();

    return collegeDirectory.filter((item) => {
      const matchesKeyword = !query
        ? true
        : [item.name, item.city, item.focus, item.domain, item.groups.join(' ')].join(' ').toLowerCase().includes(query);
      const matchesCity = city === '全部城市' ? true : item.city === city;
      const matchesGroup = group === '全部标签' ? true : item.groups.includes(group);

      return matchesKeyword && matchesCity && matchesGroup;
    });
  }, [keyword, city, group]);

  return (
    <SiteShell>
      <PageSectionTitle
        eyebrow="College Directory"
        title="院校库"
        subtitle="只保留官网直达，不做过重内容。你可以按城市和院校标签快速筛到目标学校，再一键回到学校官网。"
      />

      <section className="surface-card rounded-[34px] p-7 lg:p-8">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px_240px]">
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
            onClick={() => setGroup('全部标签')}
            className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
              group === '全部标签' ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            全部标签
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {filteredColleges.map((item) => (
          <article
            key={item.name}
            className="surface-card rounded-[32px] p-6 transition hover:-translate-y-1 hover:shadow-soft"
          >
            <div className="flex items-start gap-4">
              <ExternalSiteMark source={item.website} label={item.name} size="lg" rounded="full" />
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

      {!filteredColleges.length ? (
        <section className="surface-card rounded-[30px] px-6 py-12 text-center text-sm text-slate-500">
          当前筛选条件下没有匹配院校，换一个城市、标签或关键词试试看。
        </section>
      ) : null}
    </SiteShell>
  );
}
