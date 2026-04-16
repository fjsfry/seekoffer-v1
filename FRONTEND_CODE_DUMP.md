# Seekoffer Frontend Code Dump

Generated: 2026-04-14 16:24:34

## app/ai/page.tsx

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';

export default function AiPage() {
  const [registered, setRegistered] = useState(false);

  return (
    <SiteShell
      badge="AI Positioning"
      title="AI 定位先作为待完善能力保留入口，说明方向，但不抢主流程的戏。"
      description="现阶段更重要的是把通知库、申请表、待办和截止提醒做扎实。AI 会服务主流程，而不是在主流程没站稳时先堆空能力。"
      highlights={[
        '后续更适合做院校分层建议、材料建议和提醒策略。',
        '当前先用一页清楚说明未来规划，不做空心能力展示。',
        '保留收集需求和内测报名入口，为下一阶段做准备。'
      ]}
    >
      <PageSectionTitle
        eyebrow="AI Positioning"
        title="AI 定位：待完善"
        subtitle="如果你现在要走最实用的一条闭环，建议先从通知库进入，再把项目加入我的申请表。AI 页面当前只承担说明和需求收集职责。"
      />

      <section className="rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
          <Sparkles className="h-4 w-4" />
          未来会做什么
        </div>
        <div className="mt-5 grid gap-3 text-sm text-slate-600">
          {[
            '基于学校层级、专业方向和申请进度做更实用的定位建议。',
            '把 AI 放到材料建议、待办生成和提醒策略里，而不是单独做一个空推荐页。',
            '结合通知库和我的申请表，给出更贴近保研节奏的操作建议。'
          ].map((item) => (
            <div key={item} className="rounded-2xl bg-slate-50 px-4 py-3">
              {item}
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => setRegistered(true)}
            className="rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white"
          >
            {registered ? '已登记内测需求' : '登记内测需求'}
          </button>
          <Link href="/notices" className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
            先去通知库
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-4 text-sm text-slate-500">
          {registered
            ? '已收到你的内测意向。下一阶段我们会优先围绕申请管理和提醒场景来设计 AI。'
            : '当前页面先不承诺过多能力，保持专业感和克制感。'}
        </div>
      </section>
    </SiteShell>
  );
}

```

## app/applications/page.tsx

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Columns3, LayoutList } from 'lucide-react';
import { LoginRequiredCard } from '@/components/login-required-card';
import { ManualProjectEntryCard } from '@/components/manual-project-entry-card';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { DeadlineBadge } from '@/components/status-badge';
import { useUserSessionState } from '@/hooks/use-user-session';
import { fetchApplicationRows, fetchUserProjects, updateUserProject, watchApplicationTable, type ApplicationRow } from '@/lib/cloudbase-data';
import {
  materialChecklistDefinitions,
  priorityOptions,
  userStatusOptions,
  type MaterialChecklistKey,
  type UserProjectRecord
} from '@/lib/mock-data';

type ViewMode = 'table' | 'board';
type StatusFilter = '全部状态' | UserProjectRecord['myStatus'];

export default function ApplicationsPage() {
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('全部状态');
  const { ready, loggedIn } = useUserSessionState();

  useEffect(() => {
    if (!loggedIn) {
      setRows([]);
      return () => undefined;
    }

    let active = true;

    const load = async () => {
      const merged = await fetchApplicationRows();
      if (active) {
        setRows(merged);
      }
    };

    load();
    const dispose = watchApplicationTable(load);

    return () => {
      active = false;
      dispose();
    };
  }, [loggedIn]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => (statusFilter === '全部状态' ? true : row.item.myStatus === statusFilter));
  }, [rows, statusFilter]);

  const stats = useMemo(
    () => ({
      favorited: rows.filter((row) => row.item.isFavorited).length,
      submitted: rows.filter((row) => row.item.myStatus === '已提交').length,
      upcoming: rows.filter((row) => row.project.deadlineLevel === 'today' || row.project.deadlineLevel === 'within3days').length,
      todos: rows.filter(
        (row) =>
          row.item.materialsProgress < 100 ||
          (row.project.tags.includes('导师联系') && !row.item.contactSupervisorDone) ||
          row.item.resultStatus === '待确认'
      ).length
    }),
    [rows]
  );

  async function refreshRows() {
    const merged = await fetchApplicationRows();
    setRows(merged);
  }

  async function handleRecordChange(userProjectId: string, patch: Partial<UserProjectRecord>) {
    await updateUserProject(userProjectId, patch);
    await refreshRows();
  }

  async function toggleChecklist(userProjectId: string, field: MaterialChecklistKey, currentValue: boolean) {
    await handleRecordChange(userProjectId, { [field]: !currentValue } as Partial<UserProjectRecord>);
  }

  if (!ready) {
    return (
      <SiteShell
        badge="My Application Table"
        title="申请表属于个人管理能力，正在检查登录状态。"
        description="公共内容可以直接浏览，个人申请表会在确认登录后加载。"
      >
        <PageSectionTitle eyebrow="Application Table" title="我的申请表" subtitle="正在检查登录状态，请稍等。" />
        <section className="rounded-[30px] border border-black/5 bg-white px-6 py-10 text-sm text-slate-500 shadow-soft">
          正在加载登录态...
        </section>
      </SiteShell>
    );
  }

  if (!loggedIn) {
    return (
      <SiteShell
        badge="My Application Table"
        title="我的申请表需要先登录。"
        description="通知库、资源库和院校库允许直接浏览，但申请表是个人数据面板，需要先完成微信登录。"
      >
        <PageSectionTitle
          eyebrow="Application Table"
          title="我的申请表"
          subtitle="登录后你才能编辑状态、材料进度、优先级、备注和提醒开关。"
        />
        <LoginRequiredCard
          title="我的申请表需要先登录"
          description="公共内容允许直接浏览，但申请表字段、状态、备注和提醒属于个人管理能力，需要先完成微信登录。"
        />
      </SiteShell>
    );
  }

  return (
    <SiteShell
      badge="My Application Table"
      title="把学生自己的 Excel 搬到网站里，统一管理状态、材料进度、优先级和备注。"
      description="这是整个产品最核心的页面。公共通知由平台维护，个人字段由学生填写，网站再根据这些字段自动生成待办和截止提醒。"
      highlights={[
        '支持表格视图和看板视图，适合保研场景的长期跟踪。',
        '材料清单不是写死在备注里，而是拆成可勾选字段，便于生成提醒。',
        '这张在线申请表本身就是网站的核心差异化能力。'
      ]}
    >
      <PageSectionTitle
        eyebrow="Application Table"
        title="我的申请表"
        subtitle="这一页就是网站版 Excel。你不用再自己建表头，也不用在多份表格里来回同步状态和截止时间。"
      />

      <ManualProjectEntryCard onCreated={refreshRows} />

      <section className="mb-8 grid gap-4 xl:grid-cols-4">
        {[
          ['已收藏项目数', stats.favorited.toString(), '已加入在线申请表的项目总数'],
          ['已提交项目数', stats.submitted.toString(), '已经完成提交，等待后续结果'],
          ['本周高风险项目', stats.upcoming.toString(), '今日截止和 3 天内截止项目'],
          ['待完成事项数', stats.todos.toString(), '系统根据材料和状态自动估算']
        ].map(([label, value, note]) => (
          <div key={label} className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-3 text-3xl font-semibold text-ink">{value}</div>
            <div className="mt-3 text-sm leading-6 text-slate-500">{note}</div>
          </div>
        ))}
      </section>

      <section className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setViewMode('table')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
              viewMode === 'table' ? 'bg-brand text-white' : 'bg-white text-slate-700 shadow-sm'
            }`}
          >
            <LayoutList className="h-4 w-4" />
            表格视图
          </button>
          <button
            onClick={() => setViewMode('board')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
              viewMode === 'board' ? 'bg-brand text-white' : 'bg-white text-slate-700 shadow-sm'
            }`}
          >
            <Columns3 className="h-4 w-4" />
            看板视图
          </button>
        </div>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          className="rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none"
        >
          <option value="全部状态">全部状态</option>
          {userStatusOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </section>

      {viewMode === 'table' ? (
        <section className="overflow-hidden rounded-[30px] border border-black/5 bg-white shadow-soft">
          <div className="overflow-x-auto">
            <div className="grid min-w-[1220px] grid-cols-[1.2fr_0.75fr_0.9fr_1.1fr_0.7fr_1fr_0.95fr] gap-4 border-b border-black/5 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-500">
              <div>项目</div>
              <div>项目类型</div>
              <div>截止时间</div>
              <div>我的状态</div>
              <div>优先级</div>
              <div>材料清单 / 完成度</div>
              <div>备注</div>
            </div>

            <div className="divide-y divide-black/5">
              {filteredRows.map(({ item, project }) => (
                <div
                  key={item.userProjectId}
                  className="grid min-w-[1220px] grid-cols-[1.2fr_0.75fr_0.9fr_1.1fr_0.7fr_1fr_0.95fr] gap-4 px-5 py-5 text-sm"
                >
                  <div>
                    <div className="font-semibold text-ink">{project.schoolName}</div>
                    <div className="mt-1 text-slate-500">{project.departmentName}</div>
                    <div className="mt-2 text-slate-700">{project.projectName}</div>
                    {project.sourceSite === '用户手动录入' ? (
                      <div className="mt-2 text-xs font-semibold text-slate-400">手动录入项目</div>
                    ) : (
                      <Link href={`/notices/${project.id}`} className="mt-2 inline-flex text-xs font-semibold text-brand">
                        查看详情
                      </Link>
                    )}
                  </div>

                  <div>
                    <div className="font-semibold text-ink">{project.projectType}</div>
                    <div className="mt-2 text-slate-500">{project.discipline}</div>
                  </div>

                  <div>
                    <div className="font-semibold text-ink">{project.deadlineDate}</div>
                    <div className="mt-2">
                      <DeadlineBadge level={project.deadlineLevel} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <select
                      value={item.myStatus}
                      onChange={(event) =>
                        handleRecordChange(item.userProjectId, {
                          myStatus: event.target.value as UserProjectRecord['myStatus']
                        })
                      }
                      className="w-full rounded-2xl border border-black/5 bg-slate-50 px-3 py-2 outline-none"
                    >
                      {userStatusOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        checked={item.customReminderEnabled}
                        onChange={(event) =>
                          handleRecordChange(item.userProjectId, { customReminderEnabled: event.target.checked })
                        }
                      />
                      开启 7 天 / 3 天 / 当天提醒
                    </label>
                  </div>

                  <div>
                    <select
                      value={item.priorityLevel}
                      onChange={(event) =>
                        handleRecordChange(item.userProjectId, {
                          priorityLevel: event.target.value as UserProjectRecord['priorityLevel']
                        })
                      }
                      className="w-full rounded-2xl border border-black/5 bg-slate-50 px-3 py-2 outline-none"
                    >
                      {priorityOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="font-semibold text-ink">已完成 {item.materialsProgress}%</span>
                        <span className="text-xs text-slate-500">{materialChecklistDefinitions.length} 项检查</span>
                      </div>
                      <div className="grid gap-2">
                        {materialChecklistDefinitions.map((field) => (
                          <button
                            key={field.key}
                            onClick={() => toggleChecklist(item.userProjectId, field.key, item[field.key])}
                            className={`rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
                              item[field.key]
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-white text-slate-500 shadow-sm'
                            }`}
                          >
                            {item[field.key] ? '已完成' : '待完成'} · {field.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <textarea
                      rows={5}
                      value={item.myNotes}
                      onChange={(event) => handleRecordChange(item.userProjectId, { myNotes: event.target.value })}
                      className="w-full rounded-2xl border border-black/5 bg-slate-50 px-3 py-3 text-sm outline-none"
                    />
                  </div>
                </div>
              ))}

              {!filteredRows.length ? (
                <div className="px-6 py-12 text-center text-sm text-slate-500">你还没有符合当前筛选条件的项目，先去通知库加入项目吧。</div>
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-3">
          {userStatusOptions.map((status) => (
            <div key={status} className="rounded-[30px] border border-black/5 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-lg font-semibold text-ink">{status}</div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                  {filteredRows.filter((row) => row.item.myStatus === status).length}
                </div>
              </div>
              <div className="grid gap-3">
                {filteredRows
                  .filter((row) => row.item.myStatus === status)
                  .map(({ item, project }) => (
                    <div key={item.userProjectId} className="rounded-2xl bg-slate-50 px-4 py-4">
                      <div className="font-semibold text-ink">{project.schoolName}</div>
                      <div className="mt-1 text-sm text-slate-600">{project.projectName}</div>
                      <div className="mt-2 text-xs text-slate-400">{project.sourceSite === '用户手动录入' ? '手动录入项目' : project.departmentName}</div>
                      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                        <span>材料完成度 {item.materialsProgress}%</span>
                        <DeadlineBadge level={project.deadlineLevel} />
                      </div>
                    </div>
                  ))}

                {!filteredRows.some((row) => row.item.myStatus === status) ? (
                  <div className="rounded-2xl border border-dashed border-black/10 px-4 py-4 text-sm text-slate-500">
                    当前没有项目处于这个状态。
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </section>
      )}

    </SiteShell>
  );
}

```

## app/calendar/page.tsx

```tsx
import { redirect } from 'next/navigation';

export default function CalendarAliasPage() {
  redirect('/deadlines');
}

```

## app/colleges/page.tsx

```tsx
'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, Globe, MapPin, Search } from 'lucide-react';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { collegeDirectory } from '@/lib/portal-data';

const cityOptions = ['全部城市', ...Array.from(new Set(collegeDirectory.map((item) => item.city)))];
const levelOptions = ['全部层级', '985', '211', '双一流'];

export default function CollegesPage() {
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState('全部城市');
  const [level, setLevel] = useState('全部层级');

  const filteredColleges = useMemo(() => {
    const query = keyword.trim().toLowerCase();

    return collegeDirectory.filter((item) => {
      const matchesKeyword = !query
        ? true
        : [item.name, item.city, item.focus, item.domain].join(' ').toLowerCase().includes(query);
      const matchesCity = city === '全部城市' ? true : item.city === city;
      const matchesLevel = level === '全部层级' ? true : item.level.includes(level);

      return matchesKeyword && matchesCity && matchesLevel;
    });
  }, [keyword, city, level]);

  return (
    <SiteShell
      badge="College Directory"
      title="院校库负责提供学校官网目录，先把常用学校官网做成稳定、直观、可长期回访的入口层。"
      description="这一版院校库只保留学校官网直达，不混入学院、研究生院或项目入口；结构参考院校目录页，但页面职责保持克制。"
      highlights={[
        '当前只保留学校官网，不把不同层级网址混在一起。',
        '优先收录 985 / 211 / 双一流院校。',
        '每张卡片都带学校图标与官网域名，入口更直观。'
      ]}
    >
      <PageSectionTitle
        eyebrow="College Directory"
        title="院校库"
        subtitle="这里先做学校官网目录。点击学校卡片直接跳到官网，帮助保研生把高频学校入口收拢到同一页。"
      />

      <section className="mb-8 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="relative overflow-hidden rounded-[30px] border border-black/5 bg-brand p-6 text-white shadow-soft">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />
          <div className="relative">
            <div className="eyebrow border-white/15 bg-white/10 text-white/80">Official Directory</div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">先把学校官网目录做稳，再谈更细的入口分层。</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/80">
              院校库现在只承担一个职责：把常用学校官网整理清楚。这样结构稳定，也不会把研究生院、学院和具体项目入口混在一起。
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {collegeDirectory.slice(0, 5).map((item) => (
                <div key={item.name} className="inline-flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3">
                  <ExternalSiteMark source={item.website} label={item.name} size="sm" rounded="full" />
                  <div className="text-sm font-semibold">{item.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
          {[
            ['已收录学校', String(collegeDirectory.length), '当前先做高频院校的官网总入口。'],
            ['收录范围', '985 / 211 / 双一流', '目录结构先按学校官网层级统一。'],
            ['入口策略', '官网直达', '不混放学院页和项目页，减少混乱。']
          ].map(([label, value, note]) => (
            <div key={label} className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm">
              <div className="text-sm text-slate-500">{label}</div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-ink">{value}</div>
              <div className="mt-2 text-sm leading-6 text-slate-500">{note}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-[30px] border border-black/5 bg-white p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_220px]">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索学校名称、城市或官网域名"
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
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            className="rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
          >
            {levelOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {filteredColleges.map((item) => (
          <article key={item.name} className="group rounded-[30px] border border-black/5 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
            <div className="flex items-start gap-4">
              <ExternalSiteMark source={item.website} label={item.name} size="lg" rounded="full" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {item.level.map((entry) => (
                    <span key={entry} className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                      {entry}
                    </span>
                  ))}
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{item.city}</span>
                </div>

                <div className="mt-4 text-2xl font-semibold tracking-tight text-ink">{item.name}</div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.focus}</p>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {item.city}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Globe className="h-4 w-4" />
                    {item.domain}
                  </span>
                </div>

                <a
                  href={item.website}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white"
                >
                  打开学校官网
                  <ExternalLink className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </a>
              </div>
            </div>
          </article>
        ))}
      </section>

      {!filteredColleges.length ? (
        <section className="mt-8 rounded-[28px] border border-dashed border-black/10 bg-white/70 px-6 py-12 text-center text-sm text-slate-500">
          当前筛选条件下没有匹配院校，换一个城市、层级或关键词试试。
        </section>
      ) : null}
    </SiteShell>
  );
}

```

## app/deadlines/page.tsx

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Clock3 } from 'lucide-react';
import { ApplicationActionButton } from '@/components/application-action-button';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { DeadlineBadge, StatusBadge } from '@/components/status-badge';
import { fetchDeadlineNotices } from '@/lib/cloudbase-data';
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
    <SiteShell
      badge="Upcoming Deadlines"
      title="把截止风险单独拎出来看，让学生知道这几天最应该先处理什么。"
      description="这页先做 MVP 里的“即将截止列表”。它比月历更直接，能优先解决漏报和忘记提交的问题。"
      highlights={[
        '支持按学校和项目类型过滤当前的时间风险。',
        '今日截止、3 天内截止、7 天内截止彻底分开展示，不混在同一列表里。',
        '每一条都能继续进详情页，或者直接加入自己的申请表。'
      ]}
    >
      <PageSectionTitle
        eyebrow="Upcoming Deadlines"
        title="即将截止专区"
        subtitle="这里不追求信息全面，而是追求动作清晰：先看今天要救的项目，再看 3 天内要推进的项目，最后看 7 天内需要排期的项目。"
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
          共筛到 {filteredProjects.length} 个风险项目。先处理今日截止，再处理 3 天内截止。
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
                            href={`/notices/${project.id}`}
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

```

## app/globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
  --page-bg: #f6f0e6;
  --page-ink: #122026;
  --panel: rgba(255, 255, 255, 0.8);
}

* {
  box-sizing: border-box;
}

html,
body {
  min-height: 100%;
  padding: 0;
  margin: 0;
}

body {
  background:
    radial-gradient(circle at 10% 10%, rgba(224, 170, 85, 0.16), transparent 28%),
    radial-gradient(circle at 90% 6%, rgba(23, 73, 77, 0.12), transparent 28%),
    linear-gradient(180deg, #fbf6ef 0%, #f6f0e6 42%, #f2e8da 100%);
  color: var(--page-ink);
  font-family: 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', sans-serif;
}

a {
  color: inherit;
  text-decoration: none;
}

button,
input,
textarea,
select {
  font: inherit;
}

::selection {
  background: rgba(23, 73, 77, 0.16);
}

.page-grid {
  background-image:
    linear-gradient(rgba(18, 32, 38, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(18, 32, 38, 0.03) 1px, transparent 1px);
  background-size: 26px 26px;
  background-position: center;
}

.glass-panel {
  background: var(--panel);
  backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.7);
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 999px;
  border: 1px solid rgba(23, 73, 77, 0.12);
  background: rgba(255, 255, 255, 0.72);
  padding: 0.4rem 0.8rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #31575b;
}

.title-balance {
  text-wrap: balance;
}

.hero-shadow {
  box-shadow: 0 30px 80px rgba(16, 47, 52, 0.24);
}

```

## app/guide/page.tsx

```tsx
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { applicationColumnPresets, fieldGuideItems, guideTips, statusDefinitions } from '@/lib/mock-data';

const guideExamples = [
  {
    title: '什么时候把项目加入申请表',
    text: '只要确认这个项目值得跟踪，就先加入申请表。加入以后网站才能为你做截止提醒、材料待办和个人备注。'
  },
  {
    title: '为什么“我的状态”要统一口径',
    text: '因为“已关注”“已考虑”“已准备”这类自定义状态太多，后面系统没法准确判断你现在该做什么。'
  },
  {
    title: '为什么材料要拆成勾选项',
    text: '如果所有内容都堆在备注里，网站无法知道你到底缺推荐信还是缺成绩单，也就无法生成准确提醒。'
  }
];

export default function GuidePage() {
  return (
    <SiteShell
      badge="Field Guide"
      title="把学生最容易填乱的 Excel 表头，直接放到网站里讲清楚。"
      description="这一页专门解决“学生自己整理表格差异化太大”的问题。我们直接把字段、状态和填写口径放在网站里，减少每个人自己重复设计表头的成本。"
      highlights={[
        '告诉学生每一列是什么、为什么要填、应该怎么填。',
        '统一状态定义，避免“已关注 / 已报名 / 准备中”这类口径混乱。',
        '让网站不仅提供通知，还提供可直接拿来用的填写方法。'
      ]}
    >
      <PageSectionTitle
        eyebrow="Guide"
        title="常见问题与填写指导"
        subtitle="保研网站真正有价值的地方，不只是给通知，还要帮学生把信息结构、申请动作和在线表格口径一起讲清楚。"
      />

      <section className="mb-8 grid gap-4 xl:grid-cols-3">
        {guideTips.map((item) => (
          <div key={item} className="rounded-[28px] border border-black/5 bg-white p-5 text-sm leading-7 text-slate-600 shadow-sm">
            {item}
          </div>
        ))}
      </section>

      <section className="mb-8 rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
        <PageSectionTitle
          eyebrow="Columns"
          title="推荐表头"
          subtitle="下面这些就是我们建议学生在网站版申请表里统一填写的核心列。它们会同时服务于筛选、排序、提醒和待办生成。"
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {applicationColumnPresets.map((column) => (
            <div key={column.key} className="rounded-[24px] bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-ink">{column.label}</div>
                {column.required ? (
                  <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-white">必填</span>
                ) : (
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 shadow-sm">选填</span>
                )}
              </div>
              <div className="mt-3 text-sm leading-6 text-slate-600">{column.description}</div>
              <div className="mt-3 text-xs text-slate-500">示例：{column.sample}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
        <PageSectionTitle
          eyebrow="Status System"
          title="统一状态定义"
          subtitle="状态如果不统一，后面的待办和提醒就会失真。所以这里先把状态体系定清楚。"
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {statusDefinitions.map((item) => (
            <div key={item.label} className="rounded-[24px] bg-slate-50 px-4 py-4">
              <div className="font-semibold text-ink">{item.label}</div>
              <div className="mt-3 text-sm leading-6 text-slate-600">{item.meaning}</div>
              <div className="mt-3 rounded-2xl bg-white px-3 py-3 text-sm text-slate-500 shadow-sm">{item.nextAction}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-[30px] border border-black/5 bg-white shadow-soft">
        <div className="grid grid-cols-[0.8fr_0.8fr_1.2fr_1fr] gap-4 border-b border-black/5 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-500">
          <div>字段</div>
          <div>分类</div>
          <div>说明</div>
          <div>示例</div>
        </div>
        <div className="divide-y divide-black/5">
          {fieldGuideItems.map((field) => (
            <div key={field.key} className="grid grid-cols-[0.8fr_0.8fr_1.2fr_1fr] gap-4 px-5 py-4 text-sm">
              <div className="font-semibold text-ink">{field.label}</div>
              <div className="text-slate-600">{field.category}</div>
              <div className="text-slate-600">{field.description}</div>
              <div className="text-slate-500">{field.example}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {guideExamples.map((item) => (
          <div key={item.title} className="rounded-[28px] border border-black/5 bg-white px-5 py-5 shadow-sm">
            <div className="font-semibold text-ink">{item.title}</div>
            <div className="mt-3 text-sm leading-7 text-slate-600">{item.text}</div>
          </div>
        ))}
      </section>
    </SiteShell>
  );
}

```

## app/layout.tsx

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '寻鹿 Seekoffer | 保研通知与申请管理台',
  description:
    '面向保研学生的申请管理网站。统一整理夏令营、预推免和正式推免通知，并将学生原本手工维护的 Excel 表在线化。'
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="page-grid">{children}</body>
    </html>
  );
}

```

## app/me/page.tsx

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BellRing, BookCheck, ClipboardList, Plus, Save, UserRound } from 'lucide-react';
import { LoginRequiredCard } from '@/components/login-required-card';
import { ManualProjectEntryCard } from '@/components/manual-project-entry-card';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { DeadlineBadge } from '@/components/status-badge';
import { useUserSessionState } from '@/hooks/use-user-session';
import { fetchApplicationRows, updateUserProject, watchApplicationTable, type ApplicationRow } from '@/lib/cloudbase-data';
import { updateUserProfile, type UserProfile } from '@/lib/user-session';
import { priorityOptions, userStatusOptions, type UserProjectRecord } from '@/lib/mock-data';

type TodoPreviewSection = {
  title: string;
  subtitle: string;
  tone: string;
  items: Array<{
    id: string;
    title: string;
    description: string;
    href: string;
  }>;
};

const emptyProfile: UserProfile = {
  nickname: '微信用户',
  age: '',
  undergraduateSchool: '',
  major: '',
  grade: '大四',
  targetMajor: '',
  targetRegion: ''
};

export default function MePage() {
  const { session, ready, loggedIn } = useUserSessionState();
  const [form, setForm] = useState<UserProfile>(emptyProfile);
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    setForm(session?.profile || emptyProfile);
  }, [session]);

  useEffect(() => {
    if (!loggedIn) {
      setRows([]);
      return () => undefined;
    }

    let active = true;

    const load = async () => {
      const merged = await fetchApplicationRows();
      if (active) {
        setRows(merged);
      }
    };

    load();
    const dispose = watchApplicationTable(load);

    return () => {
      active = false;
      dispose();
    };
  }, [loggedIn]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      submitted: rows.filter((row) => row.item.myStatus === '已提交').length,
      upcoming: rows.filter((row) => row.project.deadlineLevel === 'today' || row.project.deadlineLevel === 'within3days').length,
      todos: rows.filter(
        (row) =>
          row.item.materialsProgress < 100 ||
          row.item.resultStatus === '待确认' ||
          (row.project.tags.includes('导师联系') && !row.item.contactSupervisorDone)
      ).length
    }),
    [rows]
  );

  const todoSections = useMemo<TodoPreviewSection[]>(() => {
    const imminent = rows
      .filter(
        ({ item, project }) =>
          (project.deadlineLevel === 'today' || project.deadlineLevel === 'within3days') &&
          item.myStatus !== '已提交' &&
          item.myStatus !== '已通过' &&
          item.myStatus !== '已放弃'
      )
      .slice(0, 3)
      .map(({ item, project }) => ({
        id: `${item.userProjectId}-deadline`,
        title: `${project.schoolName} · ${project.projectName}`,
        description: `截止时间 ${project.deadlineDate}，当前状态为“${item.myStatus}”，建议优先提交。`,
        href: project.sourceSite === '用户手动录入' ? '/applications#manual-entry' : `/notices/${project.id}`
      }));

    const materials = rows
      .filter(({ item }) => item.materialsProgress < 100 && item.myStatus !== '已放弃')
      .slice(0, 3)
      .map(({ item, project }) => ({
        id: `${item.userProjectId}-materials`,
        title: `${project.schoolName} · 材料未完成`,
        description: `当前完成度 ${item.materialsProgress}%，建议尽快回到申请表补齐材料。`,
        href: '/applications'
      }));

    const pending = rows
      .filter(
        ({ item, project }) =>
          item.resultStatus === '待确认' ||
          Boolean(item.interviewTime) ||
          (project.tags.includes('导师联系') && !item.contactSupervisorDone)
      )
      .slice(0, 3)
      .map(({ item, project }) => ({
        id: `${item.userProjectId}-pending`,
        title: `${project.schoolName} · ${project.projectName}`,
        description:
          item.resultStatus === '待确认'
            ? '项目进入待确认阶段，建议尽快处理。'
            : item.interviewTime
              ? `面试时间为 ${item.interviewTime}，请确认安排。`
              : '该项目强调导师联系，建议尽快补充沟通动作。',
        href: '/todos'
      }));

    return [
      {
        title: '即将截止未提交',
        subtitle: '优先处理 3 天内截止但还没有提交的项目。',
        tone: 'bg-rose-50 text-rose-700',
        items: imminent
      },
      {
        title: '材料未完成',
        subtitle: '把材料没有补齐的项目单独拎出来。',
        tone: 'bg-amber-50 text-amber-700',
        items: materials
      },
      {
        title: '待确认事项',
        subtitle: '把面试、结果确认和导师联系聚合到一起。',
        tone: 'bg-emerald-50 text-emerald-700',
        items: pending
      }
    ];
  }, [rows]);

  async function refreshRows() {
    const merged = await fetchApplicationRows();
    setRows(merged);
  }

  async function handleRecordChange(userProjectId: string, patch: Partial<UserProjectRecord>) {
    await updateUserProject(userProjectId, patch);
    await refreshRows();
  }

  function handleProfileChange<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSaveProfile() {
    updateUserProfile(form);
    setSaveMessage('个人基本信息已保存。');
  }

  if (!ready) {
    return (
      <SiteShell badge="My Space" title="正在检查登录状态。" description="我的页需要先确认登录态后再加载你的个人信息与申请管理数据。">
        <PageSectionTitle eyebrow="My Space" title="我的" subtitle="正在检查登录状态，请稍等。" />
        <section className="rounded-[30px] border border-black/5 bg-white px-6 py-10 text-sm text-slate-500 shadow-soft">
          正在加载登录态...
        </section>
      </SiteShell>
    );
  }

  if (!loggedIn) {
    return (
      <SiteShell
        badge="My Space"
        title="我的页是申请管理中心，需要先登录。"
        description="公共内容允许直接浏览，但我的申请表、我的待办、收藏和发布都属于个人动作，需要先完成微信登录。"
        highlights={[
          '通知库、资源库、院校库和研招网允许未登录浏览。',
          '我的申请表、我的待办、收藏、加入申请表和 Offer 发布需要登录。',
          '登录后，“我的”页会成为整个网站的个人管理中心。'
        ]}
      >
        <PageSectionTitle
          eyebrow="My Space"
          title="我的"
          subtitle="登录后你可以填写个人基本情况，并直接在这一页集中管理申请表和待办。"
        />
        <LoginRequiredCard
          title="我的页需要先登录"
          description="“我的”页会承载个人基本信息、我的申请表和我的待办，这些都属于个人管理数据，需要先完成微信登录。"
        />
      </SiteShell>
    );
  }

  return (
    <SiteShell
      badge="My Space"
      title="我的页要直接承接个人信息、我的申请表和我的待办，它会成为网站最有差异化的页面。"
      description="这里不做花哨个人中心，而是把真正有价值的个人管理能力放在最显眼的位置：个人基本信息、申请表和待办。"
      highlights={[
        '上半区放个人基本信息，下半区突出申请表和待办。',
        '申请表字段继续保留状态、截止时间、材料进度、优先级、备注和提醒开关。',
        '待办直接由申请表派生，减少学生自己维护多张表。'
      ]}
    >
      <PageSectionTitle
        eyebrow="My Space"
        title="我的"
        subtitle="这一页既是个人资料页，也是申请管理中心。公共通知是入口，真正的个人闭环会在这里完成。"
      />

      <section className="mb-8 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
            <UserRound className="h-4 w-4" />
            个人基本信息
          </div>
          <div className="mt-5 grid gap-4">
            <Field label="昵称">
              <input
                value={form.nickname}
                onChange={(event) => handleProfileChange('nickname', event.target.value)}
                className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="年龄">
                <input
                  value={form.age}
                  onChange={(event) => handleProfileChange('age', event.target.value)}
                  placeholder="例如 21"
                  className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
                />
              </Field>
              <Field label="当前年级">
                <input
                  value={form.grade}
                  onChange={(event) => handleProfileChange('grade', event.target.value)}
                  placeholder="例如 大四"
                  className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
                />
              </Field>
            </div>
            <Field label="本科院校">
              <input
                value={form.undergraduateSchool}
                onChange={(event) => handleProfileChange('undergraduateSchool', event.target.value)}
                placeholder="例如 北京航空航天大学"
                className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
              />
            </Field>
            <Field label="本科专业">
              <input
                value={form.major}
                onChange={(event) => handleProfileChange('major', event.target.value)}
                placeholder="例如 计算机科学与技术"
                className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
              />
            </Field>
            <Field label="目标专业方向">
              <input
                value={form.targetMajor}
                onChange={(event) => handleProfileChange('targetMajor', event.target.value)}
                placeholder="例如 计算机 / 人工智能"
                className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
              />
            </Field>
            <Field label="目标地区">
              <input
                value={form.targetRegion}
                onChange={(event) => handleProfileChange('targetRegion', event.target.value)}
                placeholder="例如 北京 / 上海"
                className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
              />
            </Field>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={handleSaveProfile}
              className="inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white"
            >
              <Save className="h-4 w-4" />
              保存基本信息
            </button>
            {saveMessage ? <span className="text-sm text-emerald-700">{saveMessage}</span> : null}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              ['申请表项目数', String(stats.total), '已加入我的申请表的项目数'],
              ['已提交项目', String(stats.submitted), '已经进入等待结果的项目'],
              ['高风险项目', String(stats.upcoming), '今日截止和 3 天内截止'],
              ['待办事项', String(stats.todos), '由状态和材料进度自动生成']
            ].map(([label, value, note]) => (
              <div key={label} className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm">
                <div className="text-sm text-slate-500">{label}</div>
                <div className="mt-3 text-3xl font-semibold text-ink">{value}</div>
                <div className="mt-2 text-sm leading-6 text-slate-500">{note}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['查看完整申请表', '继续编辑状态、材料进度、优先级和备注。', '/applications'],
              ['去处理我的待办', '把今天最该做的项目优先处理掉。', '/todos'],
              ['手动新增项目', '没在通知库找到项目时，也能自己录入。', '/applications#manual-entry']
            ].map(([title, note, href]) => (
              <Link key={title} href={href} className="rounded-[26px] border border-black/5 bg-white px-5 py-5 shadow-sm transition hover:-translate-y-0.5">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                  <BellRing className="h-4 w-4" />
                  快捷操作
                </div>
                <div className="mt-4 text-lg font-semibold text-ink">{title}</div>
                <div className="mt-2 text-sm leading-7 text-slate-600">{note}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-10 rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <BookCheck className="h-4 w-4" />
              我的申请表
            </div>
            <div className="mt-2 text-sm text-slate-500">这一段直接承接网站版 Excel，默认保留状态、截止时间、材料进度、优先级、备注和提醒开关。</div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/applications#manual-entry"
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
            >
              <Plus className="h-4 w-4" />
              手动新增项目
            </Link>
            <Link href="/applications" className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              查看完整申请表
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {rows.length ? (
          <div className="overflow-x-auto">
            <div className="grid min-w-[1120px] grid-cols-[1.2fr_0.9fr_1fr_0.9fr_0.9fr_1fr] gap-4 border-b border-black/5 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-500">
              <div>项目</div>
              <div>截止时间</div>
              <div>我的状态</div>
              <div>材料完成度</div>
              <div>优先级 / 提醒</div>
              <div>我的备注</div>
            </div>

            <div className="divide-y divide-black/5">
              {rows.map(({ item, project }) => (
                <div key={item.userProjectId} className="grid min-w-[1120px] grid-cols-[1.2fr_0.9fr_1fr_0.9fr_0.9fr_1fr] gap-4 px-5 py-5 text-sm">
                  <div>
                    <div className="font-semibold text-ink">{project.schoolName}</div>
                    <div className="mt-1 text-slate-500">{project.departmentName}</div>
                    <div className="mt-2 leading-7 text-slate-700">{project.projectName}</div>
                    {project.sourceSite === '用户手动录入' ? (
                      <div className="mt-2 text-xs font-semibold text-slate-400">手动录入项目</div>
                    ) : (
                      <Link href={`/notices/${project.id}`} className="mt-2 inline-flex text-xs font-semibold text-brand">
                        查看详情
                      </Link>
                    )}
                  </div>

                  <div>
                    <div className="font-semibold text-ink">{project.deadlineDate}</div>
                    <div className="mt-2">
                      <DeadlineBadge level={project.deadlineLevel} />
                    </div>
                  </div>

                  <div>
                    <select
                      value={item.myStatus}
                      onChange={(event) =>
                        handleRecordChange(item.userProjectId, {
                          myStatus: event.target.value as UserProjectRecord['myStatus']
                        })
                      }
                      className="w-full rounded-2xl border border-black/5 bg-slate-50 px-3 py-2 outline-none"
                    >
                      {userStatusOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-brand"
                        style={{ width: `${Math.max(item.materialsProgress, 6)}%` }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-slate-500">{item.materialsProgress}% 已完成</div>
                  </div>

                  <div className="space-y-3">
                    <select
                      value={item.priorityLevel}
                      onChange={(event) =>
                        handleRecordChange(item.userProjectId, {
                          priorityLevel: event.target.value as UserProjectRecord['priorityLevel']
                        })
                      }
                      className="w-full rounded-2xl border border-black/5 bg-slate-50 px-3 py-2 outline-none"
                    >
                      {priorityOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        checked={item.customReminderEnabled}
                        onChange={(event) =>
                          handleRecordChange(item.userProjectId, { customReminderEnabled: event.target.checked })
                        }
                      />
                      开启提醒
                    </label>
                  </div>

                  <div>
                    <textarea
                      rows={4}
                      value={item.myNotes}
                      onChange={(event) => handleRecordChange(item.userProjectId, { myNotes: event.target.value })}
                      className="w-full rounded-2xl border border-black/5 bg-slate-50 px-3 py-3 text-sm outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-[26px] border border-dashed border-black/10 px-5 py-10 text-sm text-slate-500">
            你还没有加入任何项目。先去通知库把感兴趣的项目加入“我的申请表”，这里就会开始形成你的个人工作台。
          </div>
        )}
      </section>

      <section className="rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <ClipboardList className="h-4 w-4" />
              我的待办
            </div>
            <div className="mt-2 text-sm text-slate-500">待办不是另一张表，而是由申请表里的状态、材料和时间风险重新整理出来的行动清单。</div>
          </div>
          <Link href="/todos" className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
            查看完整待办
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {todoSections.map((section) => (
            <div key={section.title} className="rounded-[26px] border border-black/5 bg-slate-50 p-5">
              <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${section.tone}`}>{section.title}</div>
              <div className="mt-3 text-sm leading-7 text-slate-600">{section.subtitle}</div>

              <div className="mt-4 grid gap-3">
                {section.items.length ? (
                  section.items.map((item) => (
                    <Link key={item.id} href={item.href} className="rounded-2xl bg-white px-4 py-4 shadow-sm transition hover:-translate-y-0.5">
                      <div className="font-semibold text-ink">{item.title}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-600">{item.description}</div>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-black/10 px-4 py-4 text-sm text-slate-500">
                    当前这一类待办暂时为空，说明这部分风险可控。
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <ManualProjectEntryCard compact onCreated={refreshRows} />
    </SiteShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-ink">{label}</div>
      {children}
    </label>
  );
}

```

## app/notices/[id]/page.tsx

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowUpRight, Clock3, History, ShieldCheck } from 'lucide-react';
import { ApplicationActionButton } from '@/components/application-action-button';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { DeadlineBadge, StatusBadge } from '@/components/status-badge';
import { baseNoticeProjects } from '@/lib/notice-source';

function getCountdown(deadlineDate: string) {
  const value = new Date(`${deadlineDate.replace(' ', 'T')}:00+08:00`);
  const now = new Date();
  const diff = value.getTime() - now.getTime();

  if (Number.isNaN(value.getTime())) {
    return '截止时间待补充';
  }

  if (diff <= 0) {
    return '项目已截止';
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days >= 1) {
    return `距截止约 ${days} 天`;
  }

  return `距截止约 ${hours} 小时`;
}

export default async function NoticeDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = baseNoticeProjects.find((item) => item.id === id);

  if (!project) {
    notFound();
  }

  return (
    <SiteShell
      badge="Notice Detail"
      title="完整查看一个项目，并决定是否加入自己的申请表。"
      description="详情页会把原通知拆成结构化字段：基本信息、材料要求、申请条件、时间风险、来源标识和变更记录。"
      highlights={[
        '原文链接、最近核验时间和人工校验状态会一起展示。',
        '可以直接从详情页加入“我的申请表”，不需要另开表格登记。',
        '往年记录会放在同页展示，帮助学生判断项目节奏是否稳定。'
      ]}
    >
      <PageSectionTitle
        eyebrow="Project Detail"
        title={`${project.schoolName} · ${project.projectName}`}
        subtitle="这是单个项目的完整信息页。适合在决定要不要报、要准备什么材料、时间风险有多大时集中查看。"
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-6">
          <section className="rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
            <div className="flex flex-wrap items-center gap-2">
              <DeadlineBadge level={project.deadlineLevel} />
              <StatusBadge status={project.status} />
              <span className="rounded-full bg-brand-cream px-3 py-1 text-xs font-semibold text-slate-700">
                {project.projectType}
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <InfoItem label="学校" value={project.schoolName} />
              <InfoItem label="学院 / 系" value={project.departmentName} />
              <InfoItem label="学科方向" value={project.discipline} />
              <InfoItem label="发布时间" value={project.publishDate} />
              <InfoItem label="截止时间" value={project.deadlineDate} />
              <InfoItem label="活动时间" value={`${project.eventStartDate} 至 ${project.eventEndDate}`} />
            </div>

            <div className="mt-5 rounded-2xl bg-brand-cream px-4 py-4 text-sm text-slate-700">
              <div className="inline-flex items-center gap-2 font-semibold text-brand">
                <Clock3 className="h-4 w-4" />
                截止倒计时
              </div>
              <div className="mt-2 text-lg font-semibold text-ink">{getCountdown(project.deadlineDate)}</div>
            </div>
          </section>

          <ContentCard title="申请条件">
            <p>{project.requirements}</p>
          </ContentCard>

          <ContentCard title="材料要求">
            <ul className="space-y-2">
              {project.materialsRequired.map((item) => (
                <li key={item} className="rounded-2xl bg-slate-50 px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </ContentCard>

          <ContentCard title="笔试 / 面试说明">
            <p>{project.examInterviewInfo}</p>
          </ContentCard>

          <ContentCard title="联系方式与备注">
            <div className="grid gap-4 md:grid-cols-2">
              <InfoItem label="联系方式" value={project.contactInfo} />
              <InfoItem label="备注" value={project.remarks} />
            </div>
          </ContentCard>

          <ContentCard title="历史记录参考">
            <div className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <History className="h-4 w-4" />
              往年规律
            </div>
            <div className="grid gap-3">
              {project.historyRecords.map((item) => (
                <div key={`${project.id}-${item.year}`} className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <div className="font-semibold text-ink">{item.year} 年</div>
                  <div className="mt-2">发布时间：{item.publishDate}</div>
                  <div className="mt-1">截止时间：{item.deadlineDate}</div>
                  <div className="mt-2 leading-7">{item.summary}</div>
                </div>
              ))}
            </div>
          </ContentCard>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
            <div className="text-lg font-semibold text-ink">操作</div>
            <div className="mt-4 grid gap-3">
              <ApplicationActionButton projectId={project.id} />
              <a
                href={project.applyLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                打开原文入口
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <a
                href={project.sourceLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-brand shadow-sm"
              >
                查看平台详情页
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <Link
                href="/deadlines"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
              >
                去看截止提醒
              </Link>
            </div>
          </section>

          <section className="rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <ShieldCheck className="h-4 w-4" />
              数据来源标识
            </div>
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <InfoItem label="来源网站" value={project.sourceSite} />
              <InfoItem label="平台录入时间" value={project.collectedAt} />
              <InfoItem label="最近更新时间" value={project.updatedAt} />
              <InfoItem label="最近核验时间" value={project.lastCheckedAt} />
              <InfoItem label="人工校验" value={project.isVerified ? '已校验' : '待校验'} />
            </div>
          </section>

          <section className="rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
            <div className="text-lg font-semibold text-ink">变更记录</div>
            <div className="mt-4 space-y-3">
              {project.changeLog.map((item) => (
                <div key={`${item.date}-${item.field}`} className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <div className="font-semibold text-ink">
                    {item.date} · {item.field}
                  </div>
                  <div className="mt-2 leading-7">{item.change}</div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </SiteShell>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-4">
      <div className="text-sm font-semibold text-ink">{label}</div>
      <div className="mt-2 text-sm leading-7 text-slate-600">{value}</div>
    </div>
  );
}

function ContentCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[30px] border border-black/5 bg-white p-6 text-sm leading-7 text-slate-600 shadow-soft">
      <div className="mb-4 text-lg font-semibold text-ink">{title}</div>
      {children}
    </section>
  );
}

```

## app/notices/page.tsx

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Search } from 'lucide-react';
import { ApplicationActionButton } from '@/components/application-action-button';
import { SiteShell } from '@/components/site-shell';
import { DeadlineBadge, StatusBadge } from '@/components/status-badge';
import { fetchPublicNotices } from '@/lib/cloudbase-data';
import { inferDisciplineCategory, inferSchoolRange } from '@/lib/notice-source';
import type { PublicNoticeProject } from '@/lib/mock-data';

type SortOption = 'publish' | 'deadline' | 'school';
type ProgressFilter = '全部' | '报名中' | '未开始' | '已结束';
type RangeFilter = '全部' | '985' | '211' | '双一流' | '其他';

function matchesProgress(filter: ProgressFilter, project: PublicNoticeProject) {
  if (filter === '全部') return true;
  if (filter === '报名中') return project.status === '报名中' || project.status === '即将截止';
  if (filter === '未开始') return project.status === '未开始';
  return project.status === '已截止' || project.status === '已结束' || project.status === '活动中';
}

export default function NoticesPage() {
  const [projects, setProjects] = useState<PublicNoticeProject[]>([]);
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

  useEffect(() => {
    let active = true;

    fetchPublicNotices().then((rows) => {
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
    const rows = category === '全部'
      ? projects
      : projects.filter((item) => inferDisciplineCategory(item.discipline) === category);
    return ['全部', ...Array.from(new Set(rows.map((item) => item.discipline).filter(Boolean)))];
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
        item.schoolName.toLowerCase().includes(schoolKeyword);
      const matchesCategory = category === '全部' ? true : inferDisciplineCategory(item.discipline) === category;
      const matchesDiscipline = discipline === '全部' ? true : item.discipline === discipline;
      const matchesMajor =
        !majorText ||
        [item.discipline, item.departmentName, item.projectName].join(' ').toLowerCase().includes(majorText);
      const matchesProgressState = matchesProgress(progress, item);
      const matchesYear = year === '全部' ? true : String(item.year) === year;
      const matchesKeyword =
        !noticeKeyword ||
        [item.schoolName, item.departmentName, item.projectName, item.discipline, item.tags.join(' ')]
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

  return (
    <SiteShell
      badge="Notice Library"
      title=""
      description=""
      highlights={[]}
    >
      <section className="space-y-5 rounded-[30px] border border-black/5 bg-white p-5 shadow-soft lg:p-6">
        <div className="flex flex-col gap-4 border-b border-black/5 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="eyebrow">Notice Filters</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">通知筛选条件</h1>
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

      <section className="flex flex-col gap-3 rounded-[24px] bg-white/80 px-5 py-4 shadow-soft lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-ink">保研通知查询结果</div>
          <div className="mt-1 text-sm text-slate-500">共筛到 {filteredProjects.length} 条 2026 年通知。</div>
        </div>
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
        {filteredProjects.map((project) => (
          <article key={project.id} className="rounded-[30px] border border-black/5 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brand-cream px-3 py-1 text-xs font-semibold text-brand">
                    {project.projectType}
                  </span>
                  <DeadlineBadge level={project.deadlineLevel} />
                  <StatusBadge status={project.status} />
                </div>

                <div className="mt-4 text-xl font-semibold tracking-tight text-ink">{project.projectName}</div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                  <span className="font-semibold text-ink">{project.schoolName}</span>
                  <span>{project.departmentName}</span>
                  <span>{project.publishDate} ~ {project.deadlineDate}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {project.tags.slice(0, 6).map((item) => (
                    <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid w-full gap-3 xl:w-[190px]">
                <Link
                  href={`/notices/${project.id}`}
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

        {!filteredProjects.length ? (
          <div className="rounded-[28px] border border-dashed border-black/10 bg-white/70 px-6 py-16 text-center text-sm text-slate-500">
            当前筛选条件下没有匹配通知，换一个学校、学科或状态试试。
          </div>
        ) : null}
      </section>
    </SiteShell>
  );
}

```

## app/offers/page.tsx

```tsx
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Heart, Search, TrendingUp } from 'lucide-react';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { hotKeywords, offerFeedItems, offerMetrics } from '@/lib/portal-data';

export default function OffersPage() {
  const [keyword, setKeyword] = useState('');

  const filteredOffers = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) {
      return offerFeedItems;
    }

    return offerFeedItems.filter((item) =>
      [item.author, item.giveUp, item.goTo, item.message, item.tags.join(' ')].join(' ').toLowerCase().includes(query)
    );
  }, [keyword]);

  return (
    <SiteShell
      badge="Offer Pool"
      title="把释放 Offer 做成更好检索、更好判断的动态栏目，用来辅助判断候补和补录窗口。"
      description="Offer 池继续保留，但它不再是整个网站的全部。它更适合做高频回看、搜索和趋势观察。"
      highlights={[
        'Offer 池适合观察候补流动，不代替院校官网和正式通知。',
        '搜索和标签比纯信息流更重要，因为学生更常带着问题来看。',
        '发布动作保留，但需要先登录。'
      ]}
    >
      <PageSectionTitle
        eyebrow="Offer Flow"
        title="Offer 池"
        subtitle="释放信息适合高频刷新，但前端页面只保留对保研生真正有帮助的要点。"
      />

      <section className="mb-8 grid gap-4 xl:grid-cols-3">
        {offerMetrics.map((item) => (
          <div key={item.label} className="rounded-[28px] border border-black/5 bg-slate-50/80 p-5">
            <div className="text-sm text-slate-500">{item.label}</div>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-ink">{item.value}</div>
            <div className="mt-2 text-sm leading-6 text-slate-500">{item.hint}</div>
          </div>
        ))}
      </section>

      <section className="mb-8 rounded-[28px] bg-brand p-5 text-white shadow-soft">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-center">
          <div>
            <div className="eyebrow border-white/15 bg-white/10 text-white/80">Search First</div>
            <div className="mt-3 text-2xl font-semibold">先搜索，再判断补录窗口</div>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/75">
              后续这里还可以继续扩展为院校、专业、地区、年级和验证状态的联合筛选。
            </p>
          </div>
          <Link
            href="/publish"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-brand"
          >
            发布释放 Offer
            <TrendingUp className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-[28px] border border-black/5 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索学校、专业、去向或留言关键词"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {hotKeywords.map((item) => (
              <button
                key={item}
                onClick={() => setKeyword(item)}
                className="rounded-full bg-brand-cream px-3 py-2 text-sm text-slate-700"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-ink">使用建议</div>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Offer 池适合用来观察候补流动，不适合代替院校官网和正式通知。关键信息仍需结合通知库和官方入口交叉核对。
          </p>
        </div>
      </section>

      <section className="grid gap-4">
        {filteredOffers.map((offer) => (
          <article key={offer.id} className="rounded-[30px] border border-black/5 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-sm font-semibold text-white">
                    {offer.avatar}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink">{offer.author}</span>
                      {offer.verified ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          身份已核验
                        </span>
                      ) : null}
                      <span className="text-xs text-slate-400">{offer.time}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                      {offer.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-slate-100 px-3 py-1">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">放弃：{offer.giveUp}</div>
                  <div className="rounded-2xl bg-brand/10 px-4 py-3 text-sm text-brand">去向：{offer.goTo}</div>
                </div>
                <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600">{offer.message}</p>
              </div>

              <button className="inline-flex items-center gap-2 self-start rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 shadow-sm">
                <Heart className="h-4 w-4 text-rose-500" />
                接好运 {offer.likes}
              </button>
            </div>
          </article>
        ))}
      </section>
    </SiteShell>
  );
}

```

## app/page.tsx

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, BellRing, Compass, FolderKanban, Sparkles } from 'lucide-react';
import { DeadlineBadge } from '@/components/status-badge';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { fetchPublicNotices } from '@/lib/cloudbase-data';
import { signInWithWechatDemo } from '@/lib/user-session';
import { collegeDirectory, homePortalCards, offerFeedItems, officialResourceSections } from '@/lib/portal-data';
import { useUserSessionState } from '@/hooks/use-user-session';
import type { PublicNoticeProject } from '@/lib/mock-data';

export default function HomePage() {
  const [projects, setProjects] = useState<PublicNoticeProject[]>([]);
  const { loggedIn, session } = useUserSessionState();

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

  const upcomingProjects = useMemo(
    () =>
      projects
        .filter((item) => item.deadlineLevel === 'today' || item.deadlineLevel === 'within3days' || item.deadlineLevel === 'within7days')
        .sort((left, right) => left.deadlineDate.localeCompare(right.deadlineDate))
        .slice(0, 4),
    [projects]
  );

  const hotResources = officialResourceSections.flatMap((section) => section.links).slice(0, 6);
  const featuredColleges = collegeDirectory.slice(0, 8);
  const latestOfferFeed = offerFeedItems.slice(0, 3);

  return (
    <SiteShell
      badge="Seekoffer Portal"
      title="首页只负责做门户分流和重点展示，让学生一进来就知道下一步该去哪。"
      description="寻鹿 Seekoffer 的定位是“保研通知 + 助力申请 + 资源整合”的综合网站。首页不再承担全量通知列表，而是承担门户角色。"
      highlights={[
        '最新通知和即将截止要放在首页第一屏，帮助学生先抓重点。',
        '资源库、院校库、Offer 池和我的申请表入口都要从首页能快速触达。',
        '首页负责分流，通知库负责完整检索，这是这次改版的核心边界。'
      ]}
    >
      <PageSectionTitle
        eyebrow="Portal Home"
        title="首页"
        subtitle="这里不是完整通知列表，而是门户页。它负责帮保研生快速判断：先看什么、先做什么、下一步去哪。"
      />

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {homePortalCards.map((item) => {
          const content = (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-brand-cream px-3 py-1 text-xs font-semibold text-brand">{item.badge}</span>
                <ArrowUpRight className="h-4 w-4 text-brand" />
              </div>
              <div className="mt-4 text-xl font-semibold text-ink">{item.title}</div>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
            </>
          );

          if (item.external) {
            return (
              <a
                key={item.title}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                {content}
              </a>
            );
          }

          return (
            <Link
              key={item.title}
              href={item.href}
              className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
            >
              {content}
            </Link>
          );
        })}
      </section>

      <section className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                <Compass className="h-4 w-4" />
                最新通知
              </div>
              <div className="mt-2 text-sm text-slate-500">默认展示最近发布的项目，帮助学生先掌握新增信息。</div>
            </div>
            <Link href="/notices" className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              进入通知库
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-4">
            {latestProjects.map((project) => (
              <div key={project.id} className="rounded-[24px] border border-black/5 bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <DeadlineBadge level={project.deadlineLevel} />
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
                    {project.publishDate}
                  </span>
                </div>
                <div className="mt-4 text-lg font-semibold text-ink">{project.schoolName}</div>
                <div className="mt-1 text-sm text-slate-500">{project.departmentName}</div>
                <div className="mt-3 text-sm leading-7 text-slate-700">{project.projectName}</div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-slate-500">截止时间：{project.deadlineDate}</div>
                  <Link href={`/notices/${project.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                    查看详情
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[30px] border border-black/5 bg-brand p-6 text-white shadow-soft">
            <div className="eyebrow border-white/15 bg-white/10 text-white/80">My Entry</div>
            <div className="mt-4 text-2xl font-semibold">我的申请表入口</div>
            <p className="mt-3 text-sm leading-7 text-white/80">
              申请表和待办是寻鹿最有差异化的能力。公共内容可直接浏览，但真正的个人管理动作需要先登录。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/me"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-brand"
              >
                {loggedIn ? '进入我的' : '查看我的入口'}
                <ArrowRight className="h-4 w-4" />
              </Link>
              {!loggedIn ? (
                <button
                  onClick={() => signInWithWechatDemo()}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white"
                >
                  微信登录
                </button>
              ) : null}
            </div>
            <div className="mt-4 text-xs leading-6 text-white/70">
              {loggedIn
                ? `当前已登录为 ${session?.profile.nickname || '微信用户'}，可以继续管理申请表和待办。`
                : '通知库、资源库、院校库和研招网允许直接浏览；申请表、待办和发布入口需要先登录。'}
            </div>
          </div>

          <div className="rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <FolderKanban className="h-4 w-4" />
              即将截止
            </div>
            <div className="mt-4 grid gap-3">
              {upcomingProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/notices/${project.id}`}
                  className="rounded-2xl bg-slate-50 px-4 py-4 transition hover:bg-slate-100"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-ink">{project.schoolName}</div>
                    <DeadlineBadge level={project.deadlineLevel} />
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">{project.projectName}</div>
                  <div className="mt-2 text-xs text-slate-500">截止：{project.deadlineDate}</div>
                </Link>
              ))}
            </div>
            <Link href="/deadlines" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand">
              查看即将截止专区
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                <Sparkles className="h-4 w-4" />
                热门资源
              </div>
              <div className="mt-2 text-sm text-slate-500">资源库负责把高频官方入口、检索网站和效率工具整理成长期导航层。</div>
            </div>
            <Link href="/resources" className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              去资源库
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {hotResources.map((item) => (
              <a
                key={item.title}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-[24px] border border-black/5 bg-slate-50 px-4 py-4 transition hover:bg-slate-100"
              >
                <div className="flex items-center gap-3">
                  <ExternalSiteMark source={item.href} label={item.title} size="md" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink">{item.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.badge}</div>
                  </div>
                </div>
                <div className="mt-3 text-sm leading-6 text-slate-600">{item.description}</div>
              </a>
            ))}
          </div>
        </div>

        <div className="rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                <Compass className="h-4 w-4" />
                热门院校
              </div>
              <div className="mt-2 text-sm text-slate-500">院校库当前只放学校官网，让学校入口清晰、稳定、好记。</div>
            </div>
            <Link href="/colleges" className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              去院校库
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {featuredColleges.map((item) => (
              <a
                key={item.name}
                href={item.website}
                target="_blank"
                rel="noreferrer"
                className="rounded-[24px] border border-black/5 bg-slate-50 px-4 py-4 transition hover:bg-slate-100"
              >
                <div className="flex items-center gap-3">
                  <ExternalSiteMark source={item.website} label={item.name} size="md" rounded="full" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink">{item.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.city}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.level.map((entry) => (
                    <span key={entry} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
                      {entry}
                    </span>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <BellRing className="h-4 w-4" />
              Offer 池动态
            </div>
            <div className="mt-2 text-sm text-slate-500">Offer 池继续保留，用来辅助判断补录窗口和候补流动节奏。</div>
          </div>
          <Link href="/offers" className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
            去 Offer 池
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {latestOfferFeed.map((item) => (
            <div key={item.id} className="rounded-[24px] border border-black/5 bg-slate-50 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand text-sm font-semibold text-white">
                  {item.avatar}
                </div>
                <div>
                  <div className="text-sm font-semibold text-ink">{item.author}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.time}</div>
                </div>
              </div>
              <div className="mt-4 text-sm leading-7 text-slate-700">{item.message}</div>
              <div className="mt-4 grid gap-2 text-xs text-slate-500">
                <div className="rounded-2xl bg-rose-50 px-3 py-2 text-rose-700">放弃：{item.giveUp}</div>
                <div className="rounded-2xl bg-brand/10 px-3 py-2 text-brand">去向：{item.goTo}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}

```

## app/publish/page.tsx

```tsx
'use client';

import Link from 'next/link';
import { ArrowRight, PencilLine } from 'lucide-react';
import { LoginRequiredCard } from '@/components/login-required-card';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { useUserSessionState } from '@/hooks/use-user-session';

export default function PublishPage() {
  const { ready, loggedIn } = useUserSessionState();

  if (!ready) {
    return (
      <SiteShell badge="Publish" title="正在检查登录状态。" description="发布释放 Offer 需要先确认登录态。">
        <PageSectionTitle eyebrow="Publish" title="发布释放 Offer" subtitle="正在检查登录状态，请稍等。" />
        <section className="rounded-[30px] border border-black/5 bg-white px-6 py-10 text-sm text-slate-500 shadow-soft">
          正在加载登录态...
        </section>
      </SiteShell>
    );
  }

  if (!loggedIn) {
    return (
      <SiteShell
        badge="Publish"
        title="发布释放 Offer 需要先登录。"
        description="公共页面可以直接浏览，但发布动作会影响社区内容可信度，所以需要先完成微信登录。"
      >
        <PageSectionTitle
          eyebrow="Publish"
          title="发布释放 Offer"
          subtitle="登录后才能进入发布动作。这样可以把公共浏览和用户动作清晰区分开。"
        />
        <LoginRequiredCard
          title="发布释放 Offer 需要先登录"
          description="Offer 发布属于个人动作和社区贡献能力，需要先完成微信登录后再继续。"
        />
      </SiteShell>
    );
  }

  return (
    <SiteShell
      badge="Admin Later"
      title="通知录入后台会是下一步重点，但当前先把学生端主闭环跑通。"
      description="你规划里的录入后台、数据审核和提醒配置都很重要。不过在 MVP 阶段，更值得先把学生端的通知列表、详情、申请表、待办和即将截止做稳定。"
      highlights={[
        '后台后续会承接通知录入、字段补全、重复合并和人工审核。',
        '等学生端链路稳定后，再把运营后台补完整。',
        '当前先通过统一数据模型把前后台字段口径固定下来。'
      ]}
    >
      <PageSectionTitle
        eyebrow="Admin"
        title="录入后台规划中"
        subtitle="目前更建议你先体验学生端路径，因为这是最直接体现产品价值的部分。"
      />

      <section className="rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
          <PencilLine className="h-4 w-4" />
          后台下一步会做
        </div>
        <div className="mt-5 grid gap-3 text-sm text-slate-600">
          {[
            '新增项目与编辑项目。',
            '标记人工校验状态。',
            '维护标签和材料字段。',
            '处理变更日志与提醒规则。'
          ].map((item) => (
            <div key={item} className="rounded-2xl bg-slate-50 px-4 py-3">
              {item}
            </div>
          ))}
        </div>
        <Link href="/applications" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand">
          先去看我的申请表
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </SiteShell>
  );
}

```

## app/resources/page.tsx

```tsx
import Link from 'next/link';
import { ArrowRight, ExternalLink, SearchCheck, Sparkles } from 'lucide-react';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { officialResourceSections } from '@/lib/portal-data';

export default function ResourcesPage() {
  const featuredLogos = officialResourceSections.flatMap((section) => section.links).slice(0, 6);

  return (
    <SiteShell
      badge="Resource Library"
      title="把保研常用网站做成真正可长期回访的资源库，而不是一页干巴巴的链接说明。"
      description="资源库负责承接高频官方入口、学术检索和效率工具。它借鉴的是资源组织方式，不是整站照搬。"
      highlights={[
        '先放真正高频、真正权威、真正值得长期回访的网站。',
        '按类别分组，减少所有链接混成一屏的负担。',
        '让资源库成为寻鹿长期可回访的门户层之一。'
      ]}
    >
      <PageSectionTitle
        eyebrow="Resources"
        title="资源库 / 官方入口"
        subtitle="这里优先放真正高频、真正权威、真正值得长期回访的网站，并且直接把站点标识带进卡片，让你一眼就能认出来。"
      />

      <section className="mb-8 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="relative overflow-hidden rounded-[30px] border border-black/5 bg-brand p-6 text-white shadow-soft">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />
          <div className="relative">
            <div className="eyebrow border-white/15 bg-white/10 text-white/80">Resource Portal</div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">高频网站应该像工具面板，而不是说明文字堆。</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/80">
              保研生反复回访的站点，本来就应该被做成带 logo 的识别卡片。这样比纯标题列表更快，也更像真正能长期使用的资源门户。
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {featuredLogos.map((item) => (
                <div key={item.title} className="rounded-2xl bg-white/10 px-4 py-4 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <ExternalSiteMark source={item.href} label={item.title} size="md" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{item.title}</div>
                      <div className="mt-1 text-xs text-white/70">{item.badge}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-black/5 bg-slate-50 p-6">
          <div className="flex items-center gap-2 text-lg font-semibold text-ink">
            <Sparkles className="h-5 w-5 text-brand" />
            这一页承担什么职责
          </div>
          <div className="mt-4 grid gap-3 text-sm text-slate-600">
            {[
              '集中放官方入口、学术检索和效率工具。',
              '让学生少花时间反复搜站点，多花时间处理申请。',
              '与院校库一起，成为寻鹿长期可回访的导航层。'
            ].map((item) => (
              <div key={item} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-8">
        {officialResourceSections.map((section) => (
          <div key={section.title}>
            <PageSectionTitle eyebrow="Portal Entry" title={section.title} subtitle={section.description} />
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {section.links.map((item) => (
                <a
                  key={item.title}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-[30px] border border-black/5 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="flex items-start gap-4">
                    <ExternalSiteMark source={item.href} label={item.title} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-semibold text-ink">{item.title}</div>
                      <div className="mt-2 inline-flex rounded-full bg-brand-cream px-3 py-1 text-xs font-semibold text-brand">
                        {item.badge}
                      </div>
                      <p className="mt-4 text-sm leading-7 text-slate-600">{item.description}</p>
                      <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand">
                        打开入口
                        <ExternalLink className="h-4 w-4 transition group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="mt-10 rounded-[32px] border border-black/5 bg-slate-950 p-6 text-white shadow-soft">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-white/80">
              <SearchCheck className="h-4 w-4 text-brand-gold" />
              Portal Connection
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">资源库和院校库会一起构成寻鹿的门户层。</h2>
            <p className="mt-3 text-sm leading-7 text-white/75">
              资源库用网站 logo 帮你快速识别常用站点，院校库用学校图标帮你快速定位目标学校。它们不是炫技页面，而是高频入口页。
            </p>
          </div>
          <Link
            href="/colleges"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-brand"
          >
            去看院校库
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}

```

## app/todos/page.tsx

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock3, ListTodo, MailCheck, ShieldAlert } from 'lucide-react';
import { LoginRequiredCard } from '@/components/login-required-card';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { useUserSessionState } from '@/hooks/use-user-session';
import { fetchApplicationRows, watchApplicationTable, type ApplicationRow } from '@/lib/cloudbase-data';

type TodoSection = {
  title: string;
  subtitle: string;
  iconKey: 'deadline' | 'materials' | 'pending';
  items: Array<{
    id: string;
    title: string;
    description: string;
    href: string;
    tone: string;
  }>;
};

export default function TodosPage() {
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const { ready, loggedIn } = useUserSessionState();

  useEffect(() => {
    if (!loggedIn) {
      setRows([]);
      return () => undefined;
    }

    let active = true;

    const load = async () => {
      const merged = await fetchApplicationRows();
      if (active) {
        setRows(merged);
      }
    };

    load();
    const dispose = watchApplicationTable(load);

    return () => {
      active = false;
      dispose();
    };
  }, [loggedIn]);

  function renderIcon(iconKey: TodoSection['iconKey']) {
    if (iconKey === 'deadline') {
      return <ShieldAlert className="h-4 w-4" />;
    }

    if (iconKey === 'materials') {
      return <ListTodo className="h-4 w-4" />;
    }

    return <MailCheck className="h-4 w-4" />;
  }

  const sections = useMemo<TodoSection[]>(() => {
    const imminent = rows
      .filter(
        ({ item, project }) =>
          (project.deadlineLevel === 'today' || project.deadlineLevel === 'within3days') &&
          item.myStatus !== '已提交' &&
          item.myStatus !== '已通过' &&
          item.myStatus !== '已放弃'
      )
      .map(({ item, project }) => ({
        id: `${item.userProjectId}-deadline`,
        title: `${project.schoolName} · ${project.projectName}`,
        description: `截止时间 ${project.deadlineDate}，当前状态为“${item.myStatus}”，需要优先完成提交动作。`,
        href: project.sourceSite === '用户手动录入' ? '/applications#manual-entry' : `/notices/${project.id}`,
        tone: 'bg-rose-50 text-rose-700'
      }));

    const materials = rows
      .filter(({ item }) => item.materialsProgress < 100 && item.myStatus !== '已放弃')
      .map(({ item, project }) => {
        const missing = [
          !item.cvReady ? '简历' : null,
          !item.transcriptReady ? '成绩单' : null,
          !item.rankingProofReady ? '排名证明' : null,
          !item.recommendationReady ? '推荐信' : null,
          !item.personalStatementReady ? '个人陈述' : null
        ]
          .filter(Boolean)
          .join('、');

        return {
          id: `${item.userProjectId}-materials`,
          title: `${project.schoolName} · 材料未完成`,
          description: `当前完成度 ${item.materialsProgress}%，仍缺：${missing || '待补充'}。`,
          href: '/applications',
          tone: 'bg-amber-50 text-amber-700'
        };
      });

    const pending = rows
      .filter(
        ({ item, project }) =>
          item.resultStatus === '待确认' ||
          Boolean(item.interviewTime) ||
          (project.tags.includes('导师联系') && !item.contactSupervisorDone)
      )
      .map(({ item, project }) => {
        let description = '有待确认事项，请尽快处理。';

        if (project.tags.includes('导师联系') && !item.contactSupervisorDone) {
          description = '该项目强调导师联系，但你的申请表里还没有标记为已联系。';
        } else if (item.interviewTime) {
          description = `面试时间为 ${item.interviewTime}，请确认准备材料和时间冲突。`;
        } else if (item.resultStatus === '待确认') {
          description = '项目已进入待确认阶段，建议尽快处理确认动作。';
        }

        return {
          id: `${item.userProjectId}-pending`,
          title: `${project.schoolName} · ${project.projectName}`,
          description,
          href: '/applications',
          tone: 'bg-emerald-50 text-emerald-700'
        };
      });

    return [
      {
        title: '即将截止未提交',
        subtitle: '3 天内截止但还没有进入“已提交”的项目，先救最危险的一批。',
        iconKey: 'deadline',
        items: imminent
      },
      {
        title: '材料未完成',
        subtitle: '把简历、成绩单、推荐信这些最容易拖延的材料单独拎出来。',
        iconKey: 'materials',
        items: materials
      },
      {
        title: '待确认事项',
        subtitle: '入营确认、面试时间确认、导师联系等都归到这里。',
        iconKey: 'pending',
        items: pending
      }
    ];
  }, [rows]);

  if (!ready) {
    return (
      <SiteShell badge="My Todos" title="待办属于个人管理能力，正在检查登录状态。" description="确认登录后会加载你的待办清单。">
        <PageSectionTitle eyebrow="My Todos" title="我的待办" subtitle="正在检查登录状态，请稍等。" />
        <section className="rounded-[30px] border border-black/5 bg-white px-6 py-10 text-sm text-slate-500 shadow-soft">
          正在加载登录态...
        </section>
      </SiteShell>
    );
  }

  if (!loggedIn) {
    return (
      <SiteShell
        badge="My Todos"
        title="我的待办需要先登录。"
        description="待办页依赖你的申请表状态、材料进度和提醒设置，所以需要登录后使用。"
      >
        <PageSectionTitle
          eyebrow="My Todos"
          title="我的待办"
          subtitle="登录后系统才会根据你的申请表自动生成“今天该做什么”的清单。"
        />
        <LoginRequiredCard
          title="我的待办需要先登录"
          description="待办并不是公共页面，它依赖你的申请状态、材料清单和提醒开关来生成。"
        />
      </SiteShell>
    );
  }

  return (
    <SiteShell
      badge="My Todos"
      title="把今天该做什么自动列出来，而不是让学生自己从 Excel 里慢慢找。"
      description="我的待办页不要求你再填一套新数据，它只是把申请表里的状态、截止时间和材料清单重新编排成“现在该做什么”的视图。"
      highlights={[
        '优先识别 3 天内截止但还没提交的项目。',
        '自动把材料不完整、导师联系未完成、待确认事项拎出来。',
        '每条待办都能直接跳回项目详情或申请表编辑。'
      ]}
    >
      <PageSectionTitle
        eyebrow="My Todos"
        title="我的待办"
        subtitle="这一页是网站版 Excel 的延伸。你不需要自己再开一个待办表，系统会根据已有字段帮你自动整理。"
      />

      <section className="grid gap-6">
        {sections.map((section) => {
          return (
            <div key={section.title} className="rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                    {renderIcon(section.iconKey)}
                    {section.title}
                  </div>
                  <div className="mt-3 text-sm leading-7 text-slate-600">{section.subtitle}</div>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-500">
                  {section.items.length}
                </div>
              </div>

              <div className="grid gap-4">
                {section.items.length ? (
                  section.items.map((item) => (
                    <div key={item.id} className="rounded-[26px] border border-black/5 bg-slate-50 px-5 py-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.tone}`}>{section.title}</span>
                      </div>
                      <div className="mt-4 text-lg font-semibold text-ink">{item.title}</div>
                      <div className="mt-3 text-sm leading-7 text-slate-600">{item.description}</div>
                      <Link href={item.href} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand">
                        去处理
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[26px] border border-dashed border-black/10 px-5 py-10 text-sm text-slate-500">
                    当前没有这一类待办，说明这部分风险暂时可控。
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="mt-10 rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
          <Clock3 className="h-4 w-4" />
          待办是怎么生成的
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            '截止时间 + 我的状态：识别“3 天内截止但未提交”的高风险项目。',
            '材料清单 + 完成度：识别简历、成绩单、推荐信等缺失项。',
            '导师联系 / 面试时间 / 结果状态：识别待确认和沟通事项。'
          ].map((item) => (
            <div key={item} className="rounded-[24px] bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
              {item}
            </div>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}

```

## components/application-action-button.tsx

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus } from 'lucide-react';
import { addProjectToApplicationTable, fetchUserProjects, watchApplicationTable } from '@/lib/cloudbase-data';
import { getUserSession, watchUserSession } from '@/lib/user-session';

export function ApplicationActionButton({
  projectId,
  variant = 'primary'
}: {
  projectId: string;
  variant?: 'primary' | 'secondary';
}) {
  const [added, setAdded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function load() {
      const session = getUserSession();
      if (!session) {
        if (active) {
          setAdded(false);
        }
        return;
      }

      const rows = await fetchUserProjects();
      if (active) {
        setAdded(rows.some((item) => item.projectId === projectId));
      }
    }

    load();
    const disposeApplications = watchApplicationTable(load);
    const disposeSession = watchUserSession(load);

    return () => {
      active = false;
      disposeApplications();
      disposeSession();
    };
  }, [projectId]);

  async function handleAdd() {
    if (!getUserSession()) {
      window.alert('加入我的申请表需要先完成微信登录。');
      router.push('/me');
      return;
    }

    await addProjectToApplicationTable(projectId);
    setAdded(true);
  }

  const className =
    variant === 'secondary'
      ? 'rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm'
      : 'rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white';

  return (
    <button onClick={handleAdd} className={className}>
      <span className="inline-flex items-center gap-2">
        {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {added ? '已加入我的申请表' : '加入我的申请表'}
      </span>
    </button>
  );
}

```

## components/external-site-mark.tsx

```tsx
'use client';

import { useMemo, useState } from 'react';

function resolveDomain(urlOrDomain: string) {
  if (!urlOrDomain) return '';

  try {
    const value = urlOrDomain.startsWith('http') ? new URL(urlOrDomain).hostname : urlOrDomain;
    return value.replace(/^www\./, '');
  } catch {
    return urlOrDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || '';
  }
}

function buildFaviconUrl(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

export function ExternalSiteMark({
  source,
  label,
  size = 'md',
  rounded = 'xl'
}: {
  source: string;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  rounded?: 'full' | 'xl';
}) {
  const [broken, setBroken] = useState(false);
  const domain = useMemo(() => resolveDomain(source), [source]);

  const dimensions =
    size === 'sm'
      ? 'h-10 w-10 text-base'
      : size === 'lg'
        ? 'h-16 w-16 text-2xl'
        : 'h-12 w-12 text-lg';

  const radius = rounded === 'full' ? 'rounded-full' : 'rounded-2xl';
  const initial = (label || domain || '?').trim().slice(0, 1).toUpperCase();

  return (
    <div
      className={`relative flex ${dimensions} ${radius} items-center justify-center overflow-hidden border border-black/5 bg-white shadow-sm`}
    >
      {!broken && domain ? (
        <img
          src={buildFaviconUrl(domain)}
          alt={`${label} logo`}
          className="h-full w-full object-cover p-2"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="font-semibold text-brand">{initial}</span>
      )}
    </div>
  );
}

```

## components/login-required-card.tsx

```tsx
'use client';

import Link from 'next/link';
import { LockKeyhole, QrCode } from 'lucide-react';
import { signInWithWechatDemo } from '@/lib/user-session';

export function LoginRequiredCard({
  title = '这个功能需要先登录',
  description = '公共内容允许直接浏览，但申请表、待办、收藏和发布入口需要先完成微信登录。'
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
      <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
        <LockKeyhole className="h-4 w-4" />
        登录后使用
      </div>
      <h2 className="mt-4 text-2xl font-semibold text-ink">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={() => signInWithWechatDemo()}
          className="inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white"
        >
          <QrCode className="h-4 w-4" />
          微信登录
        </button>
        <Link
          href="/notices"
          className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
        >
          先去浏览通知库
        </Link>
      </div>

      <div className="mt-4 text-xs leading-6 text-slate-400">
        当前先完成登录态与权限分流，真正的微信扫码 OAuth 流程可以在下一步接入。
      </div>
    </section>
  );
}

```

## components/manual-project-entry-card.tsx

```tsx
'use client';

import { useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { createManualApplicationEntry, type ManualProjectInput } from '@/lib/cloudbase-data';

const initialForm: ManualProjectInput = {
  schoolName: '',
  departmentName: '',
  projectName: '',
  projectType: '夏令营',
  discipline: '',
  deadlineDate: '',
  eventStartDate: '',
  eventEndDate: '',
  applyLink: ''
};

function formatDateTime(input: string) {
  if (!input) {
    return '';
  }

  return input.replace('T', ' ');
}

export function ManualProjectEntryCard({
  onCreated,
  compact = false
}: {
  onCreated?: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(!compact);
  const [form, setForm] = useState<ManualProjectInput>(initialForm);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField<K extends keyof ManualProjectInput>(key: K, value: ManualProjectInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit() {
    if (!form.schoolName.trim() || !form.projectName.trim() || !form.deadlineDate.trim()) {
      setMessage('请至少填写学校、项目名称和截止时间。');
      return;
    }

    setSubmitting(true);
    setMessage('');

    await createManualApplicationEntry({
      ...form,
      deadlineDate: formatDateTime(form.deadlineDate),
      eventStartDate: formatDateTime(form.eventStartDate || ''),
      eventEndDate: formatDateTime(form.eventEndDate || '')
    });

    setForm(initialForm);
    setSubmitting(false);
    setMessage('已手动加入我的申请表。');
    onCreated?.();
  }

  return (
    <section id="manual-entry" className="rounded-[30px] border border-black/5 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-ink">手动新增项目</div>
          <div className="mt-2 text-sm leading-7 text-slate-600">
            如果通知库里暂时没有这个项目，你也可以自己录入，先把申请节奏管理起来。
          </div>
        </div>
        {compact ? (
          <button
            onClick={() => setOpen((current) => !current)}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <Plus className="h-4 w-4" />
            {open ? '收起录入' : '手动新增'}
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-5 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="学校名称">
              <input
                value={form.schoolName}
                onChange={(event) => updateField('schoolName', event.target.value)}
                placeholder="例如 清华大学"
                className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
              />
            </Field>
            <Field label="学院 / 系 / 实验室">
              <input
                value={form.departmentName}
                onChange={(event) => updateField('departmentName', event.target.value)}
                placeholder="例如 电子工程系"
                className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
              />
            </Field>
            <Field label="项目类型">
              <select
                value={form.projectType}
                onChange={(event) => updateField('projectType', event.target.value as ManualProjectInput['projectType'])}
                className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
              >
                {['夏令营', '预推免', '正式推免'].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="学科方向">
              <input
                value={form.discipline}
                onChange={(event) => updateField('discipline', event.target.value)}
                placeholder="例如 计算机"
                className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="项目名称">
              <input
                value={form.projectName}
                onChange={(event) => updateField('projectName', event.target.value)}
                placeholder="例如 2027 年预推免通知"
                className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
              />
            </Field>
            <Field label="截止时间">
              <input
                type="datetime-local"
                value={form.deadlineDate}
                onChange={(event) => updateField('deadlineDate', event.target.value)}
                className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
              />
            </Field>
            <Field label="活动开始时间">
              <input
                type="datetime-local"
                value={form.eventStartDate}
                onChange={(event) => updateField('eventStartDate', event.target.value)}
                className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
              />
            </Field>
            <Field label="活动结束时间">
              <input
                type="datetime-local"
                value={form.eventEndDate}
                onChange={(event) => updateField('eventEndDate', event.target.value)}
                className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
              />
            </Field>
          </div>

          <Field label="原文或报名链接">
            <input
              value={form.applyLink}
              onChange={(event) => updateField('applyLink', event.target.value)}
              placeholder="可选，方便你自己后续回访"
              className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {submitting ? '保存中...' : '加入我的申请表'}
            </button>
            {message ? <span className="text-sm text-slate-500">{message}</span> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-ink">{label}</div>
      {children}
    </label>
  );
}

```

## components/page-section-title.tsx

```tsx
export function PageSectionTitle({
  eyebrow,
  title,
  subtitle
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-8 flex flex-col gap-3 border-b border-black/5 pb-6">
      <div className="eyebrow w-fit">{eyebrow}</div>
      <div>
        <h2 className="title-balance text-3xl font-semibold tracking-tight text-ink">{title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{subtitle}</p>
      </div>
    </div>
  );
}

```

## components/seekoffer-logo.tsx

```tsx
import Image from 'next/image';
import Link from 'next/link';
import { Compass } from 'lucide-react';

export function SeekofferLogo() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/85 p-1 shadow-float">
        <Image
          src="/logo.png"
          alt="寻鹿 Seekoffer"
          width={48}
          height={48}
          className="h-12 w-12 rounded-[14px] object-cover"
          priority
        />
      </div>
      <div>
        <div className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
          寻鹿 Seekoffer
          <Compass className="h-4 w-4 text-brand-pine" />
        </div>
        <div className="text-xs uppercase tracking-[0.24em] text-slate-400">保研通知 + 助力申请 + 资源整合</div>
      </div>
    </Link>
  );
}

```

## components/site-header.tsx

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Brain, Building2, Globe, Heart, House, Newspaper, UserRound } from 'lucide-react';
import { SeekofferLogo } from './seekoffer-logo';
import { UserSessionEntry } from './user-session-entry';

const navItems = [
  { href: '/', label: '首页', icon: House },
  { href: '/notices', label: '通知库', icon: Newspaper },
  { href: '/resources', label: '资源库', icon: BookOpen },
  { href: '/colleges', label: '院校库', icon: Building2 },
  { href: '/offers', label: 'Offer 池', icon: Heart },
  { href: '/ai', label: 'AI 定位', icon: Brain },
  { href: 'https://yz.chsi.com.cn/', label: '研招网', icon: Globe, external: true },
  { href: '/me', label: '我的', icon: UserRound }
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="glass-panel sticky top-4 z-30 mb-6 rounded-[28px] px-4 py-4 shadow-soft lg:px-5">
      <div className="grid gap-4 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:items-center">
        <SeekofferLogo />

        <div className="flex min-w-0 justify-center">
          <nav className="flex flex-wrap items-center justify-center gap-2 rounded-[22px] bg-white/70 p-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.external
                ? false
                : item.href === '/'
                  ? pathname === '/'
                  : item.href === '/notices'
                    ? pathname === '/notices' || pathname.startsWith('/notices/')
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);

              const className = `inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                active ? 'bg-brand text-white shadow-sm' : 'text-slate-500 hover:bg-white hover:text-ink'
              }`;

              if (item.external) {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className={className}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </a>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={className}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex justify-start xl:justify-end">
          <UserSessionEntry />
        </div>
      </div>
    </header>
  );
}

```

## components/site-shell.tsx

```tsx
import { SiteHeader } from './site-header';

export function SiteShell({
  title: _title,
  description: _description,
  badge: _badge,
  highlights: _highlights = [],
  children
}: {
  title: string;
  description: string;
  badge: string;
  highlights?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen px-4 py-4 lg:px-6 lg:py-6">
      <div className="mx-auto max-w-[1240px]">
        <SiteHeader />

        <main className="animate-rise space-y-6">{children}</main>
      </div>
    </div>
  );
}

```

## components/status-badge.tsx

```tsx
import type { DeadlineLevel, PublicProjectStatus } from '@/lib/mock-data';

export function StatusBadge({ status }: { status: PublicProjectStatus }) {
  const tone =
    status === '即将截止'
      ? 'bg-orange-50 text-orange-700'
      : status === '报名中'
        ? 'bg-emerald-50 text-emerald-700'
        : status === '已截止'
          ? 'bg-slate-100 text-slate-500'
          : status === '活动中'
            ? 'bg-cyan-50 text-cyan-700'
            : 'bg-slate-100 text-slate-600';

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{status}</span>;
}

export function DeadlineBadge({ level }: { level: DeadlineLevel }) {
  const mapping = {
    today: { label: '今日截止', tone: 'bg-rose-50 text-rose-700' },
    within3days: { label: '3 天内截止', tone: 'bg-orange-50 text-orange-700' },
    within7days: { label: '7 天内截止', tone: 'bg-amber-50 text-amber-700' },
    future: { label: '正常跟进', tone: 'bg-emerald-50 text-emerald-700' },
    expired: { label: '已截止', tone: 'bg-slate-100 text-slate-500' }
  } as const;

  const current = mapping[level];
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${current.tone}`}>{current.label}</span>;
}

```

## components/user-session-entry.tsx

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogOut, QrCode, UserRound } from 'lucide-react';
import { getUserSession, signInWithWechatDemo, signOutUser, watchUserSession, type UserSession } from '@/lib/user-session';

export function UserSessionEntry() {
  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    const load = () => setSession(getUserSession());
    load();
    const dispose = watchUserSession(load);
    return () => dispose();
  }, []);

  if (!session) {
    return (
      <button
        onClick={() => signInWithWechatDemo()}
        className="inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5"
      >
        <QrCode className="h-4 w-4" />
        微信登录
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href="/me"
        className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm"
      >
        <UserRound className="h-4 w-4 text-brand" />
        {session.profile.nickname || '我的'}
      </Link>
      <button
        onClick={() => signOutUser()}
        className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600"
      >
        <LogOut className="h-4 w-4" />
        退出
      </button>
    </div>
  );
}

```

## data/baoyantongzhi-notices-2026.json

```json
[
  {
    "id": "baoyantongzhi-52248",
    "schoolName": "中国科学技术大学",
    "departmentName": "应用化学与工程学院（科教融合学院）",
    "projectName": "2026年中国科学技术大学应用化学与工程学院（中国科学院长春应用化学研究所）2026年校园开放日活动通知",
    "projectType": "夏令营",
    "discipline": "理工",
    "publishDate": "2026-04-03",
    "deadlineDate": "2026-04-16 23:59",
    "eventStartDate": "2026-04-03",
    "eventEndDate": "2026-04-16",
    "applyLink": "https://mp.weixin.qq.com/s/-Amrr3fCCdqqRL8paVobBw",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52248",
    "requirements": "中华人民共和国公民，拥护中国共产党的领导，品德良好，遵纪守法。",
    "materialsRequired": [
      "简历",
      "成绩单",
      "排名证明",
      "推荐信",
      "英语成绩"
    ],
    "examInterviewInfo": "原通知未明确笔试 / 面试安排，建议以原文和后续邮件为准。",
    "contactInfo": "zhoujy@ciac.ac.cn / 0431-85262387",
    "remarks": "公告如下：",
    "tags": [
      "985",
      "211",
      "双一流",
      "自划线",
      "安徽",
      "理工",
      "材料要求复杂"
    ],
    "status": "即将截止",
    "year": 2026,
    "deadlineLevel": "within3days",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52320",
    "schoolName": "清华大学",
    "departmentName": "统计与数据科学系",
    "projectName": "2026年清华大学统计与数据科学系2026学术开放日",
    "projectType": "夏令营",
    "discipline": "理工",
    "publishDate": "2026-04-07",
    "deadlineDate": "2026-04-21 23:59",
    "eventStartDate": "2026-04-07",
    "eventEndDate": "2026-04-21",
    "applyLink": "https://mp.weixin.qq.com/s/-Z8OHTeC1xv-Gyd9m8LM8Q",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52320",
    "requirements": "清华统计系2026学术开放日 为促进统计学与数据科学领域的学术交流，搭建面向本科生的开放交流平台，清华大学统计与数据科学系将举办学术开放日活动。 本次活动围绕统计学与数据科学的理论发展与实际应用开展交流与分享，面向对相关领域具有兴趣的本科生开放报名参与。 清华大学统计与数据科学系简介 清华大学统计与数据科学系（以下简称“统计系”）致力于建设具有国际影响力的统计学与数据科学研究与教学平台，围绕现代统计理论与数据科学方法，形成了结构合理、充满活力的学术队伍。 目前，统计系在统计与数据科学基础理论、AI与机器学习的统计理论基础、交叉科学等方向持续推进前沿研究，并依托清华大学多学科优势，建设“数据科学交叉研究院”等多个高水平平台，推动统计学与人工智能、生命科学、经济金融等领域的交叉融合，不断拓展学科边界与应用场景。",
    "materialsRequired": [
      "整合为一个PDF格式的文件上传，文件命名格式：",
      "姓名+学校"
    ],
    "examInterviewInfo": "原通知未明确笔试 / 面试安排，建议以原文和后续邮件为准。",
    "contactInfo": "tjxjxb@mailoa.tsinghua.edu.cn",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "985",
      "211",
      "双一流",
      "自划线",
      "北京",
      "理工"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-24603",
    "schoolName": "深圳理工大学",
    "departmentName": "全校类",
    "projectName": "2026年深圳理工大学与宁波诺丁汉大学2026年秋季联合培养博士研究生招生简章",
    "projectType": "夏令营",
    "discipline": "综合",
    "publishDate": "2026-03-09",
    "deadlineDate": "2026-04-26 23:59",
    "eventStartDate": "2026-03-09",
    "eventEndDate": "2026-04-26",
    "applyLink": "https://mp.weixin.qq.com/s/ymbwEOnpnmEBK7vu5_sleg",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/24603",
    "requirements": "为培养具有国际视野和产学研紧密结合的高层次人才，加强双方的科研合作，利用双方现有的学术优势、资源和设施，实现人才培养优势互补，经双方友好协商，于2020年9月达成协议，开展联合培养博士研究生项目（DTP），在多个领域发展创新博士培养体系，培养具有国际视野的高水平博士人才，目前已招收6届联培博士生。 现启动2026年秋季学期博士联培项目招生工作，入学时间为2026年9月，欢迎优秀学子踊跃申请！ 一、招生方向及研究课题 （一）招生方向 生物医学工程、复合材料、电气和电子工程、机器和控制、先进智能制造、人工智能和优化、大数据分析和信息系统、先进能源与环境材料。 （二）博士研究课题",
    "materialsRequired": [
      "，英语成绩于7月15日前提交"
    ],
    "examInterviewInfo": "原通知未明确笔试 / 面试安排，建议以原文和后续邮件为准。",
    "contactInfo": "liyulei@suat-sz.edu.cn / 0755-88802441",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "双非",
      "广东",
      "综合",
      "导师联系"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-24600",
    "schoolName": "香港中文大学（深圳）",
    "departmentName": "经管学院",
    "projectName": "2026年香港中文大学（深圳）经管学院经济学硕士项目2026夏令营-Mini营考核安排",
    "projectType": "夏令营",
    "discipline": "经管",
    "publishDate": "2026-01-31",
    "deadlineDate": "2026-04-30 23:59",
    "eventStartDate": "2025-12-29",
    "eventEndDate": "2026-04-30",
    "applyLink": "https://mp.weixin.qq.com/s/zaPvxhfI_ookGtz0WSF1XQ",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/24600",
    "requirements": "及材料",
    "materialsRequired": [
      "简历",
      "成绩单",
      "排名证明",
      "推荐信",
      "个人陈述",
      "身份证"
    ],
    "examInterviewInfo": "安排 ➡ 夏令营申请开放中 关于夏令营 / INTRODUCTION 香港中文大学（深圳）经济学硕士项目2026年优秀大学生夏令营-Mini营已于 2025年12月29日",
    "contactInfo": "以原通知中的联系方式为准",
    "remarks": "夏令营申请无需本科院校推免资格。 特别提示 Important Notice",
    "tags": [
      "双非",
      "广东",
      "经管",
      "需笔试",
      "需面试",
      "材料要求复杂",
      "导师联系"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52403",
    "schoolName": "上海创智学院",
    "departmentName": "全校类",
    "projectName": "2026年上海创智学院2026年夏令营博士生遴选通知",
    "projectType": "夏令营",
    "discipline": "综合",
    "publishDate": "2026-04-08",
    "deadlineDate": "2026-05-05 23:59",
    "eventStartDate": "2026-04-10",
    "eventEndDate": "2026-05-05",
    "applyLink": "https://mp.weixin.qq.com/s/AW-W5rsrG3GGBkjtwvUvhg",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52403",
    "requirements": "上海创智学院秉持“从不可能到可能、从可能到价值、从价值到普惠”的育人理念，以国家战略价值、长期产业价值和普惠社会价值为引领，培养有远大抱负和家国情怀的人工智能顶尖人才。学院链接全国三十一所头部高校、头部实验室、人工智能头部创新企业，汇聚活跃于人工智能创新一线的青年顶尖师资，破界式选才、阵地式培养。学院提供大规模先进算力基础设施、高质量数据语料和多场景具身实验室，学院与多个人工智能领军企业、机构设立联合创新中心、院企联合实验室，为人才培养提供丰富的实习实训资源。学院拥有创智未来中心，链接创投基金、提供全流程陪伴式创业。为高标准选拔出富有家国情怀、综合素质过硬、科学素养扎实、创新潜质突出、富有挑战精神的优秀学生，学院计划于2026年5月～6月开展夏令营博士生遴选工作。 数说创智，等你共创 学院链接31所高校，已入学520名、已录取897名学生。目前已有83位全职全时团队，130+位兼职导师，120+位产业导师。 学院一年来已举办13场“图灵奖”等顶尖学者专题报告会，253场导师报告会、学生分享会。 学院已与超50家企业合作开展100+企业课题、紧密合作30+创投机构、自主孵育20+创新企业、链接200+产业顾问及导师。 学院已布局1项重大战略布局项目、6项标杆项目、7项火炬项目、5项科学智能项目、63项导师项目、5项学生项目。",
    "materialsRequired": [
      "以原通知材料要求为准"
    ],
    "examInterviewInfo": "方式",
    "contactInfo": "admissions@sii.edu.cn / 021-53300123",
    "remarks": "学制：学院不设定强制性的学制和最低学习年限。",
    "tags": [
      "双非",
      "上海",
      "综合",
      "需笔试",
      "需面试",
      "导师联系"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-24605",
    "schoolName": "北京中关村学院",
    "departmentName": "全校类",
    "projectName": "2026年北京中关村学院2026年“直博生夏令营”活动通知",
    "projectType": "夏令营",
    "discipline": "综合",
    "publishDate": "2026-03-17",
    "deadlineDate": "2026-05-05 23:59",
    "eventStartDate": "2026-03-23",
    "eventEndDate": "2026-05-05",
    "applyLink": "https://www.bza.edu.cn/detail/acld06aavyiaa8lwsi69ofwtxdund3k5",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/24605",
    "requirements": "（一）主要面向预期报考2027年直博的学生，需满足以下资格：",
    "materialsRequired": [
      "本科阶段前五学期的成绩单和专业排名证明（须加盖教务处或院系公章）"
    ],
    "examInterviewInfo": "模式。创新设置“教科人管理中心”打破壁垒，自主开发10余门前沿短课，并以110多个“真问题、真需求”的研究项目为核心载体（含8个学生自主立项），让学生在科研攻关中成长。 攻坚前沿科研，构建全链条矩阵。 学院举办首届国际AI科学家大会，邀请包括6位诺奖得主、100+国际知名学者等多学科领域专家，会上发布“全球首个助力科研人才全流程培养的科研智能体系统”—OmniScientist。学院围绕“AI核心、AI*科学技术、AI*人文社科”三大科研方向，组织中关村Xᴬᴵ智汇讲坛、中关村国际青年论坛等百余场学术活动，学院师生发表多篇《Nature》、《Science》等高影响学术期刊、人工智能顶会最佳论文，产出超级软件智能、地球尺度AI社会模拟器、Z212肿瘤免疫药物等科研突破。 贯通成果转化，赋能创业实践。 学院打造“政产学研创金”六位一体生态，推动校企共同出题、共同解题，目前与中国移动、腾讯、智谱华章、银河通用等机构已建立14个联合研究机构，成功孵化深度机智、新烛时代等企业，总融资超3亿元，投后估值超10亿元，“前店后厂”的赋能机制为成果转化与创新创业项目提供全周期服务。 引领国家级AI转化枢纽，构建全链条创新生态",
    "contactInfo": "admission@bza.edu.cn / 010-82821018",
    "remarks": "所有学生须签订《诚信参加夏令营选拔考核承诺书》。",
    "tags": [
      "双非",
      "北京",
      "综合",
      "需面试",
      "导师联系"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52499",
    "schoolName": "复旦大学",
    "departmentName": "管理学院",
    "projectName": "2026年复旦大学管理学院2027级招生系列活动正式启动",
    "projectType": "夏令营",
    "discipline": "经管",
    "publishDate": "2026-04-10",
    "deadlineDate": "2026-05-07 23:59",
    "eventStartDate": "2026-04-13",
    "eventEndDate": "2026-05-07",
    "applyLink": "https://mp.weixin.qq.com/s/gKKT5TueB_KKn0lpEOm0XQ",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52499",
    "requirements": "“领创体验营”开启申请 “你能否成为我们” “我们是否适合你”",
    "materialsRequired": [
      "以原通知材料要求为准"
    ],
    "examInterviewInfo": "原通知未明确笔试 / 面试安排，建议以原文和后续邮件为准。",
    "contactInfo": "upec@fudan.edu.cn / 021-25011530",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "985",
      "211",
      "双一流",
      "自划线",
      "上海",
      "经管"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52498",
    "schoolName": "中国科学技术大学",
    "departmentName": "数学科学学院",
    "projectName": "2026年中国科学技术大学数学科学学院2026年“数学有理”科学营报名通知",
    "projectType": "夏令营",
    "discipline": "理工",
    "publishDate": "2026-04-10",
    "deadlineDate": "2026-05-08 23:59",
    "eventStartDate": "2026-04-12",
    "eventEndDate": "2026-05-08",
    "applyLink": "https://math.ustc.edu.cn/2026/0410/c18650a726171/page.htm",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52498",
    "requirements": "以原通知申请条件为准",
    "materialsRequired": [
      "以原通知材料要求为准"
    ],
    "examInterviewInfo": "原通知未明确笔试 / 面试安排，建议以原文和后续邮件为准。",
    "contactInfo": "以原通知中的联系方式为准",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "985",
      "211",
      "双一流",
      "自划线",
      "安徽",
      "理工"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52438",
    "schoolName": "香港中文大学（深圳）",
    "departmentName": "理工学院",
    "projectName": "2026年香港中文大学（深圳）理工学院2026年卓越本科生夏令营开放报名",
    "projectType": "夏令营",
    "discipline": "理工",
    "publishDate": "2026-04-07",
    "deadlineDate": "2026-05-08 23:59",
    "eventStartDate": "2026-04-03",
    "eventEndDate": "2026-05-08",
    "applyLink": "https://mp.weixin.qq.com/s/ei_28cznyaW9tdzk9ecbAA",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52438",
    "requirements": "为什么选择港中大（深圳）理工学院夏令营？ 顶尖师资，引领前沿： 由香港中文大学（深圳）理工学院资深教授团队倾力授课，带你深入探索人工智能与数学、物理学、化学、材料科学与工程、能源科学与工程等学科的交叉前沿。 大师讲堂，启迪思维：",
    "materialsRequired": [
      "（适用于两个方向）：",
      "个人简历",
      "在校成绩单（含学分说明）",
      "其他证明材料（若有）",
      "报名方式：",
      "申请链接：https://v.wjx.cn/vm/YqqIWTG.aspx#",
      "截止日期：2026年5月8日",
      "扫描二维码报名"
    ],
    "examInterviewInfo": "原通知未明确笔试 / 面试安排，建议以原文和后续邮件为准。",
    "contactInfo": "ursc_sse@cuhk.edu.cn",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "双非",
      "广东",
      "理工",
      "材料要求复杂",
      "导师联系"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-24608",
    "schoolName": "香港中文大学",
    "departmentName": "化学系",
    "projectName": "2026年香港中文大学化学系夏令营招生通知",
    "projectType": "夏令营",
    "discipline": "理工",
    "publishDate": "2026-03-13",
    "deadlineDate": "2026-05-10 23:59",
    "eventStartDate": "2026-03-13",
    "eventEndDate": "2026-05-10",
    "applyLink": "https://chem.cuhk.edu.hk/%e9%a6%99%e6%b8%af%e4%b8%ad%e6%96%87%e5%a4%a7%e5%ad%a6%e5%8c%96%e5%ad%a6%e7%b3%bb%e6%8b%9b%e7%94%9f%e5%a4%8f%e4%bb%a4%e8%90%a5-2026/",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/24608",
    "requirements": "香港中文大学化学系招生夏令营将于2026年7月13日至17日举行，欢迎有意于2027年入读化学系硕士-博士课程的本科生与研究生申请，报名于5月10日截止。获选参加这次夏令营的同学将于5月下旬收到邀请信。夏令营结束后，在师生双向选择的基础上，化学系将发出预 对象：有意申请攻读香港中文大学化学系硕士-博士课程2027年秋季入学的本科生与研究生 内容：教授讲座、在读同学经验分享、面试 、参观校园与实验室",
    "materialsRequired": [
      "通过电子邮件发送至",
      "chemgrad@cuhk.edu.hk",
      "报名截止日期为",
      "2026年5月10日",
      "必须材料：填写好的",
      "申请表",
      "，简历，大学本科及研究生阶段的成绩单副本",
      "非必须材料：TOEFL或IETLS 成绩单副本 (香港中文大学研究生院对研究生的入学要求包括TOEFL iBT 不低于79分或IETLS Overall不低于6.5"
    ],
    "examInterviewInfo": "、参观校园与实验室 费用：全免 住宿与交通： 香港中文大学化学系将为参加夏令营的外地同学免费提供校内住宿，并根据来港的路途远近补助部分交通费用。 研究生资助： 如获录取，将提供全额奖学金（2026-27年度为每月港币19,100元）及医疗保障。 特别优秀的申请人会被推荐申请 香港博士研究生奖学金计划 ），入选者可获每月港币28,400元奖学金、免缴学费及",
    "contactInfo": "chemgrad@cuhk.edu.hk",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "香港",
      "理工",
      "需面试",
      "材料要求复杂"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52185",
    "schoolName": "北京大学",
    "departmentName": "全球健康发展研究院",
    "projectName": "2026年北京大学全球健康发展研究院北大-耶鲁全球健康经济学夏校 “AI赋能星球健康”",
    "projectType": "夏令营",
    "discipline": "经管",
    "publishDate": "2026-03-28",
    "deadlineDate": "2026-05-11 23:59",
    "eventStartDate": "2026-03-28",
    "eventEndDate": "2026-05-11",
    "applyLink": "https://mp.weixin.qq.com/s/S9MCYqanT7bn5Y107jJDwA?scene=1&click_id=1",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52185",
    "requirements": "主办、协办单位 主办：北京大学全球健康发展研究院 北京大学全球健康发展研究院（全健院）成立于2020年，由北京大学国发院教育部长江学者特聘教授、中国医学科学院学部委员刘国恩老师担任创始院长；作为北京大学实体交叉研究机构，全健院聚集北京大学健康经济、医疗卫生、国际关系、气候环境等多学科力量，以跨越国界的视角把全球健康置于人类发展的框架，以“同一世界、同一健康”为核心理念，通过科学研究、人才培养、国际合作、产教融合等平台，探索人类健康重大议题的应对方案，推动中国积极参与全球卫生治理，助力构建人类健康发展共同体。 协办：耶鲁北京中心 耶鲁北京中心（Yale Center Beijing）旨在助力耶鲁大学实现致力于为社会各界和全球各地区培养领袖的愿景。凭借耶鲁大学作为全球性研究型大学的丰富资源和其历来与中国的紧密联系，中心旨在促进决策者和思想领袖们就全球各种紧迫问题开展建设性对话及坦率交流。中心帮助耶鲁扩展现有活动，与位于中国的机构和组织加强合作关系，支持耶鲁各个学院和部门的研究和教学活动。中心由耶鲁大学管理学院代表耶鲁大学进行管理。",
    "materialsRequired": [
      "夏校申请表（见附件），填写后签字"
    ],
    "examInterviewInfo": "原通知未明确笔试 / 面试安排，建议以原文和后续邮件为准。",
    "contactInfo": "ghd@pku.edu.cn",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "985",
      "211",
      "双一流",
      "自划线",
      "北京",
      "经管"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52252",
    "schoolName": "西湖大学",
    "departmentName": "生命科学学院",
    "projectName": "2026西湖大学生命科学学院生命科学国际暑期学校全球启动",
    "projectType": "夏令营",
    "discipline": "理工",
    "publishDate": "2026-03-30",
    "deadlineDate": "2026-05-17 23:59",
    "eventStartDate": "",
    "eventEndDate": "2026-05-17",
    "applyLink": "https://mp.weixin.qq.com/s/tLAJRYXwz9LFDlbLnp6xOA",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52252",
    "requirements": "全球范围内生命科学专业类 大学二年级、三年级 本科生 ，具备较好的英语交流能力。",
    "materialsRequired": [
      "成绩单",
      "个人陈述"
    ],
    "examInterviewInfo": "原通知未明确笔试 / 面试安排，建议以原文和后续邮件为准。",
    "contactInfo": "ug_summercamp@westlake.edu.cn / 0571-87310235",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "双非",
      "浙江",
      "理工",
      "导师联系"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-24678",
    "schoolName": "清华大学",
    "departmentName": "苏世民书院",
    "projectName": "2026年清华大学苏世民书院2027级招生简章",
    "projectType": "夏令营",
    "discipline": "经管",
    "publishDate": "2025-12-01",
    "deadlineDate": "2026-05-20 23:59",
    "eventStartDate": "2026-01-01",
    "eventEndDate": "2026-05-20",
    "applyLink": "https://mp.weixin.qq.com/s/zyP58-SAW5AYIqsV23CTow",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/24678",
    "requirements": "申请者拥有学士学位。 应届本科毕业生须在入学前(2027年8月1日)完成全部学业要求并获得学位。",
    "materialsRequired": [
      "所有申请材料须为英文"
    ],
    "examInterviewInfo": "两个阶段。 中国区申请关键时间点: 2026年1月1日 线申请系统开放 2026年5月20日中午12:00 (北京时间) 在线申请系统关闭",
    "contactInfo": "admissions@sc.tsinghua.edu.cn",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "985",
      "211",
      "双一流",
      "自划线",
      "北京",
      "经管",
      "需面试"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-24679",
    "schoolName": "香港中文大学（深圳）",
    "departmentName": "经管学院",
    "projectName": "2026年香港中文大学（深圳）经管学院市场学理学硕士项目2027年秋季入学优秀大学生夏令营申请开启",
    "projectType": "夏令营",
    "discipline": "经管",
    "publishDate": "2025-12-29",
    "deadlineDate": "2026-05-29 23:59",
    "eventStartDate": "2025-12-29",
    "eventEndDate": "2026-05-29",
    "applyLink": "https://mscmkt.cuhk.edu.cn/zh-hans/node/4032",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/24679",
    "requirements": "申请者需同时符合以下两个条件： a) 大学本科三年级学生（2027年应届毕业生），对本科毕业专业无硬性要求，鼓励跨专业申请。学习成绩优异，总评成绩在该校同年级本专业当中名列前茅，和/或在其他方面有优异表现。申请无需本科院校推免资格。 b) 英语水平要求（满足以下任一语言要求即可）： ·英语四级不低于550分；或 ·英语六级不低于520分；或 ·雅思（学术类）不低于6.5；或 ·托福不低于79分；或 ·GMAT（Verbal）不低于21分或Band 78。",
    "materialsRequired": [
      "申请网址：https://mscmkt.cuhk.edu.cn/",
      "*申请费用100元，不设退款",
      "*夏令营申请无需本科院校推免资格，申请人可在申请系统中查看申请状态"
    ],
    "examInterviewInfo": "表现优异的营员将获得最高豁免100%学费的入学奖学金。 夏令营特色 ✦ 提前暂获入学offer",
    "contactInfo": "以原通知中的联系方式为准",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "双非",
      "广东",
      "经管",
      "需面试"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-24606",
    "schoolName": "中国科学院",
    "departmentName": "古脊椎动物与古人类研究所",
    "projectName": "2026年中国科学院古脊椎动物与古人类研究所分子古生物学实验室2026年夏令营本硕学员招募（第一轮）",
    "projectType": "夏令营",
    "discipline": "理工",
    "publishDate": "2026-03-18",
    "deadlineDate": "2026-05-31 23:59",
    "eventStartDate": "2026-03-18",
    "eventEndDate": "2026-05-31",
    "applyLink": "http://www.ivpp.cas.cn/tzgg/202603/t20260312_8158467.html",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/24606",
    "requirements": "一、课题组简介 中国科学院古脊椎动物与古人类研究所分子古生物学实验室立足于我国百万年以来丰富的化石资源，通过共同创新和延展应用分子古生物学技术，从遗传学角度深入探索人类及其伴生物种的起源与演化历史，已经取得许多重要研究发现，且在国际上具有广泛影响力。课题组长期保持与古遗传学研究领域国际前沿团队的交流合作，旨在共同推进全球分子古生物学研究的发展。 课题组注重对学生科研及实践能力的全方位培养，有志于从事学术工作的毕业生大多进入哈佛大学、耶鲁大学、马普所、北京大学以及中国科学院动物所等国内外顶尖科研机构从事研究工作或继续深造，选择就业的毕业生则主要分布于高校科研机构、生物科技企业、国家事业单位等。 1.1主要研究方向 延展或开发新的实验技术，不断提高古DNA和古蛋白数据质量及拓展材料来源，广泛开展各类考古遗存（骨骼、沉积物、牙结石、牙釉质）的古DNA捕获与测序及古蛋白序列重建工作；运用生物信息学与群体遗传学分析方法，根据所获取的分子遗传学数据，研究古老型人类基因特点，揭示古代人群的遗传结构，构建现代人起源与演化的框架；研究旧石器时代以来欧亚不同区域，尤其是东亚人群的起源、迁徙、地域适应及互动交融情况；开展古代驯化动植物的遗传演化研究，来侧面反映人群的生存面貌和演化历史；通过牙结石中古代微生物的遗传研究，解读人类与环境的互动关系；利用古蛋白提取和质谱技术对考古遗址出土骨骼及残留物进行蛋白质组分析，以进行种属鉴定并探讨先民对动植物资源的利用等方面。 1.2实验室成果",
    "materialsRequired": [
      "相关证明（本研究组为国际前沿科学团队，",
      "夏令营部分课程为英文教学，",
      "要求参与者具有良好的英语沟通和阅读能力）",
      "有意在本实验室深造者"
    ],
    "examInterviewInfo": "内容 个人能力（个人报告、课堂表现、参与度、文献研讨等）； 团队合作（课题合作讨论与展示）； 其它综合表现。",
    "contactInfo": "paleo-molecular@ivpp.ac.cn",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "双一流",
      "北京",
      "理工",
      "导师联系"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52183",
    "schoolName": "复旦大学",
    "departmentName": "国际金融学院",
    "projectName": "2026年复旦大学国际金融学院EMF2026系列招生活动全面启幕",
    "projectType": "夏令营",
    "discipline": "经管",
    "publishDate": "2026-03-30",
    "deadlineDate": "2026-06-01 23:59",
    "eventStartDate": "2026-04-01",
    "eventEndDate": "2026-06-01",
    "applyLink": "https://mp.weixin.qq.com/s/S4T1625NEqNx12wdIrTtjw",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52183",
    "requirements": "春天，是启程，是前行，是新序章的开启。 在这个奔赴理想的季节， 复旦国金EMF2026年招生活动",
    "materialsRequired": [
      "简历"
    ],
    "examInterviewInfo": "原通知未明确笔试 / 面试安排，建议以原文和后续邮件为准。",
    "contactInfo": "fisf_emf@fudan.edu.cn",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "985",
      "211",
      "双一流",
      "自划线",
      "上海",
      "经管"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-24691",
    "schoolName": "北京大学",
    "departmentName": "生命科学联合中心（北大方面）",
    "projectName": "2026年北京大学生命科学联合中心（北大方面）2026年暑期培训班招生简介",
    "projectType": "夏令营",
    "discipline": "理工",
    "publishDate": "2026-03-19",
    "deadlineDate": "2026-06-02 23:59",
    "eventStartDate": "2026-03-19",
    "eventEndDate": "2026-06-02",
    "applyLink": "https://mp.weixin.qq.com/s/c4HLevuAyljhRHrCI-PuzQ?scene=1&click_id=1",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/24691",
    "requirements": "◆ ◆ ◆ ◆ 生命科学联合中心（北大方面）2026年暑期培训班招生简介 生命科学联合中心是为了加速我国一流大学建设，在国家支持下由教育部、科技部、财政部设计、组织，清华大学与北京大学密切配合，按照“统一领导、顶层设计、强强联合、务实发展、动态调整”的原则组建的，是科研和教育体制改革的重大措施。目标是通过改革教育和科研的相关制度，吸引与汇聚热心教育的优秀科学家，以出色的理论教学和尖端的研究并重，培养拔尖创新人才，造就一流的生命科学研究与教育中心。 为促进生命科学发展，探索创新性人才培养模式，生命中心每年利用暑假时间，面向全国高校本科生，甄选生命科学中的特别领域，举办暑期培训班。暑期培训班将充分发挥生命中心两校联合、师资与科研上的优势，并延请国内外知名学者，以激发学生兴趣，培育未来精英为目标，让学生在培训中了解领域内前沿问题，开拓思路，引导创新性的思维习惯。 欢迎全国有志于加入生命科学交叉科学前沿队伍的化学、生物、物理、数学、计算机、医学、电子信息及工学等各学科的本科生积极报名。 一、培训方向、时间",
    "materialsRequired": [
      "推荐信"
    ],
    "examInterviewInfo": "选拔方式 “化学生物学” 面向全国高校内对化学生物学研究有浓厚兴趣，有志于从事化学生物学相关领域研究的在读本科生（化学，生物医学，药学等专业学生）。 “神经与认知科学” 面向全国高校内，对神经科学有浓厚兴趣，有志于从事和神经科学相关领域研究的在读本科生（四年制需完成大学一年级或二年级课程，五年制需完成一年级或二年级或三年级课程）。 “定量生物学”",
    "contactInfo": "gsummer@pku.edu.cn / 010-62758696",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "985",
      "211",
      "双一流",
      "自划线",
      "北京",
      "理工"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52435",
    "schoolName": "香港科技大学（广州）",
    "departmentName": "全校类",
    "projectName": "2026年香港科技大学（广州）功能枢纽2026博士项目夏令营报名开启",
    "projectType": "夏令营",
    "discipline": "综合",
    "publishDate": "2026-04-08",
    "deadlineDate": "2026-06-03 23:59",
    "eventStartDate": "2026-04-08",
    "eventEndDate": "2026-06-03",
    "applyLink": "https://mp.weixin.qq.com/s/B0ItTaEy_rzxF395X8Kf4Q",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52435",
    "requirements": "Summer Camp 2023~2025",
    "materialsRequired": [
      "必要材料",
      "在读证明/学历证明",
      "● 学术简历",
      "● 最新官方成绩单",
      "● 身份证明（身份证、护照等）",
      "推荐可选材料",
      "● 英语成绩证明（雅思、托福、四六级均可）",
      "● 获奖证书、发表的论文或著作、获批专利等其他材料"
    ],
    "examInterviewInfo": "原通知未明确笔试 / 面试安排，建议以原文和后续邮件为准。",
    "contactInfo": "summercamp-funh@hkust-gz.edu.cn",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "双非",
      "广东",
      "综合",
      "材料要求复杂",
      "导师联系"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52500",
    "schoolName": "中国科学院",
    "departmentName": "生物与化学交叉研究中心",
    "projectName": "2026年中国科学院生物与化学交叉研究中心暑期夏令营报名通知",
    "projectType": "夏令营",
    "discipline": "理工",
    "publishDate": "2026-04-09",
    "deadlineDate": "2026-06-15 23:59",
    "eventStartDate": "2026-04-09",
    "eventEndDate": "2026-06-15",
    "applyLink": "https://www.ircbc.ac.cn/edu/xly/202604/t20260409_8183495.html",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52500",
    "requirements": "具有良好的思想品德和政治素质，遵纪守法，身心健康； . 生命科学、化学、医学、药学以及数学相关专业202 届本科毕业生； 学习成绩优秀，",
    "materialsRequired": [
      "成绩单",
      "排名证明",
      "推荐信",
      "身份证"
    ],
    "examInterviewInfo": "原通知未明确笔试 / 面试安排，建议以原文和后续邮件为准。",
    "contactInfo": "ircbc_student@sioc.ac.cn",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "双一流",
      "北京",
      "理工"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52191",
    "schoolName": "澳门大学",
    "departmentName": "工商管理学院",
    "projectName": "2026年澳門大學工商管理學院2026年學術夏令營火熱招募",
    "projectType": "夏令营",
    "discipline": "经管",
    "publishDate": "2026-03-23",
    "deadlineDate": "2026-06-15 23:59",
    "eventStartDate": "2026-03-23",
    "eventEndDate": "2026-06-15",
    "applyLink": "https://mp.weixin.qq.com/s/cuzsn-koEHczr9ycfWyPMQ?scene=1&click_id=6",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52191",
    "requirements": "澳門大學工商管理學院 2026年學術夏令營火熱招募中！ 工商管理學院（FBA）是澳門大學歷史最悠久的學院之一，在教學、科研、國際認可及產學合作方面均具領先地位，並展現獨特的亞洲區域特色。",
    "materialsRequired": [
      "必繳材料",
      "官方成績單（",
      "院系／教務部門蓋章",
      "排名證明（",
      "英文個人簡歷",
      "選繳材料：",
      "英語能力證明（如 CET4/6、TOEFL、IELTS、GMAT、GRE 等）"
    ],
    "examInterviewInfo": "原通知未明确笔试 / 面试安排，建议以原文和后续邮件为准。",
    "contactInfo": "amyho@um.edu.mo",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "澳门",
      "经管",
      "材料要求复杂"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52434",
    "schoolName": "中国科学院",
    "departmentName": "广州生物医药与健康研究院",
    "projectName": "2026年中国科学院广州生物医药与健康研究院第二十届“走进GIBH”大学生夏令营报名通知",
    "projectType": "夏令营",
    "discipline": "医农",
    "publishDate": "2026-04-08",
    "deadlineDate": "2026-06-19 23:59",
    "eventStartDate": "2026-04-08",
    "eventEndDate": "2026-06-19",
    "applyLink": "https://gibh.cas.cn/yjs/zsxx/xly/202604/t20260408_8183050.html",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52434",
    "requirements": "全国“双一流”建设高校或相关学科（专业）优势突出的国内重点高校 大三（五年制则为大四）本科生；",
    "materialsRequired": [
      "，以免错过筛选时间",
      "第二批夏令营：即日起至2026年6月19日24:00"
    ],
    "examInterviewInfo": "等。具体安排另行通知。",
    "contactInfo": "education@gibh.ac.cn / 020-32015351",
    "remarks": "夏令营活动期间食宿免费，统一购买活动期间的人身意外伤害保险。",
    "tags": [
      "双一流",
      "北京",
      "医农",
      "导师联系"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-24604",
    "schoolName": "复旦大学",
    "departmentName": "化学系",
    "projectName": "2026年复旦大学化学系分子合成与识别科学中心夏令营报名开始",
    "projectType": "夏令营",
    "discipline": "理工",
    "publishDate": "2026-03-16",
    "deadlineDate": "2026-06-20 23:59",
    "eventStartDate": "2026-03-16",
    "eventEndDate": "2026-06-20",
    "applyLink": "https://mp.weixin.qq.com/s/5QpWFn7rLNpm3qnp1SKO8w",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/24604",
    "requirements": "以原通知申请条件为准",
    "materialsRequired": [
      "以原通知材料要求为准"
    ],
    "examInterviewInfo": "原通知未明确笔试 / 面试安排，建议以原文和后续邮件为准。",
    "contactInfo": "以原通知中的联系方式为准",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "985",
      "211",
      "双一流",
      "自划线",
      "上海",
      "理工"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-24602",
    "schoolName": "香港中文大学（深圳）",
    "departmentName": "数据科学学院",
    "projectName": "2026年香港中文大学（深圳）数据科学学院硕士研究生项目2026年优秀大学生迷你营及夏令营开放申请",
    "projectType": "夏令营",
    "discipline": "理工",
    "publishDate": "2026-02-04",
    "deadlineDate": "2026-06-20 23:59",
    "eventStartDate": "2026-02-04",
    "eventEndDate": "2026-06-20",
    "applyLink": "https://mp.weixin.qq.com/s/PlA3r0GmzvshCkNB1E3JFg",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/24602",
    "requirements": "申请者需同时符合以下三个条件： 内地高校本科三年级学生 （2027年应届毕业生），不限专业； “985工程”/ “211工程” 院校的学生，本科 5学期成绩排名在专业或年级的 前30% ；非 “985工程”/ “211工程” 院校的学生，本科前5学期成绩排名在专业或年级的 前10%",
    "materialsRequired": [
      "扫描件：本科",
      "前5个学期",
      "在校成绩单（校级公章）",
      "*申请者需上传官方开具的完整成绩单及绩点计算说明扫描件，若成绩单上无平均绩点或者无均分体现，则请同时上传一份学校开具的官方均分（加权平均分）证明",
      "多份文件建议合成一份以PDF格式上传",
      "在校成绩排名（由院系/教务部门盖章）",
      "扫描件：",
      "相关英语能力资格证书复印件，"
    ],
    "examInterviewInfo": "表现优异者，有机会获得全奖、半奖及其他不同等级的入学奖学金。 名师课堂与沉浸式学习体验 与国际一流教授面对面交流，洞悉人工智能与数据科学的学术前沿与行业应用。 学长学姐经验分享 聆听优秀学长学姐的真知灼见，了解他们的求学经历与职业发展路径。 与优秀同辈同行",
    "contactInfo": "以原通知中的联系方式为准",
    "remarks": "具体考核流程后续各项目会通过邮件形式发送给材料审核通过的入营者。申请人可在申请系统中查看申请状态。",
    "tags": [
      "双非",
      "广东",
      "理工",
      "材料要求复杂"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52123",
    "schoolName": "中国科学院",
    "departmentName": "上海营养与健康研究所",
    "projectName": "2026年中国科学院上海营养与健康研究所 2026年大学生暑期夏令营暨2027级硕士研究生推免初选报名通知",
    "projectType": "夏令营",
    "discipline": "理工",
    "publishDate": "2026-03-20",
    "deadlineDate": "2026-06-20 23:59",
    "eventStartDate": "2026-04-01",
    "eventEndDate": "2026-06-20",
    "applyLink": "https://sedu.sinh.ac.cn/news.php?id=531",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52123",
    "requirements": "生物学、医学、药学、数学、 统计、 物理、计算机等相关专业的 届本科毕业生。",
    "materialsRequired": [
      "的真实合法性，如因材料虚假或其他不端行为导致的一切后果由申请者本人承担"
    ],
    "examInterviewInfo": "原通知未明确笔试 / 面试安排，建议以原文和后续邮件为准。",
    "contactInfo": "yaohe@sari-hk.com / 15214241771",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "双一流",
      "北京",
      "理工"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52348",
    "schoolName": "中国科学院",
    "departmentName": "福建物质结构研究所",
    "projectName": "2026年中国科学院福建物质结构研究所（海西研究院）2026年大学生暑期夏令营招募通知",
    "projectType": "夏令营",
    "discipline": "理工",
    "publishDate": "2026-04-07",
    "deadlineDate": "2026-06-20 23:59",
    "eventStartDate": "",
    "eventEndDate": "2026-06-20",
    "applyLink": "http://www.fjirsm.ac.cn/yjsjy/zsxx/202604/t20260407_8182017.html",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52348",
    "requirements": "化学、材料、物理、生物、光学、控制等相关专业大学三年级本科生（2027年7月毕业）以及优秀大二本科生（2028年7月毕业）；",
    "materialsRequired": [
      "网上报名后生成的表格打印后本人签字"
    ],
    "examInterviewInfo": "，闭营晚会",
    "contactInfo": "120101239@qq.com",
    "remarks": "参加暑期夏令营的学生必须遵守我所的相关规定，按照统一的安排进行工作和活动；",
    "tags": [
      "双一流",
      "北京",
      "理工",
      "需面试",
      "导师联系"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52206",
    "schoolName": "中国科学院",
    "departmentName": "脑科学与智能技术卓越创新中心",
    "projectName": "2026年中国科学院脑科学与智能技术卓越创新中心暑期学校2026年通知《认识、探索大脑的奥秘》",
    "projectType": "夏令营",
    "discipline": "理工",
    "publishDate": "2026-03-31",
    "deadlineDate": "2026-06-25 23:59",
    "eventStartDate": "2026-03-27",
    "eventEndDate": "2026-06-25",
    "applyLink": "https://cebsit.cas.cn/yjs/tzgg/202603/t20260331_8179817.html",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52206",
    "requirements": "大学在读的生命科学、医学、数学、计算机、物理、自动化、电子、化学等专业的学生。线下环节仅面向参加推免面试的2027届本科毕业生；",
    "materialsRequired": [
      "成绩单",
      "推荐信",
      "身份证"
    ],
    "examInterviewInfo": "的同学亲临脑智卓越中心，实地感受浓厚的学术氛围及精彩生活，通过深入实验室及技术平台等方式，感受脑科学与智能技术的魅力所在。我们将为入选线下学习的学员统一安排在沪期间的食宿。 课程内容： 神经科学的历史与展望、神经系统发育、神经细胞的生理特性、感知觉的神经环路基础、情感的神经环路基础、行为的神经环路基础、神经系统疾病、非人灵长类动物模型及克隆猴技术、脑科学与智能技术等内容。 主讲人： 蒲慕明、师咏勇、孙衍刚、杜久林、熊志奇、周嘉伟、王佐仁、顾勇、姚海珊、王伟、何杰、杨天明、徐宁龙、王凯、王立平、严军、陈跃军、梁智锋、徐春、徐敏、常乐、刘真、刘静宇、张哲、刘丹倩、穆宇、龚能、周海波、ANGELOVSKI Goran、黄薇、李毅、刘赐融、俞青、赵郑拓、刘佳男、毛盾、汪菲、徐圣进、KAPOOR Vishal、OKAZAWA Gouki、EVRARD Henry、肖雄、喻晓、周毅、马少捷、孙怡迪、杨大平、张铁林、李雪、SAJAD Amirsaman、陈语思、周昌阳、胡禹、沈志明等研究员。",
    "contactInfo": "gradstudent@ion.ac.cn / 021-54921941",
    "remarks": "请认真填写各项信息，并保证所填数据真实可靠，如因材料虚假或其他不端行为导致的一切后果，由申请者本人承担；脑智卓越中心倡导环保，无需邮寄纸质材料，请在线提交附件材料，具体提交方式如下： 请将推荐信（推荐信需要有推荐教师的签名）上传至申请表中指定位置，并将学生证复印件、身份证正反面复印件、本科成绩单、四六级成绩单、各类证书、奖状扫描件、其他材料的顺序进行扫描排列，制作生成一个PDF文件，文件按照如下方式命名：附件 – XX大学 – 姓名，上传至申请表最后一栏附件栏。",
    "tags": [
      "双一流",
      "北京",
      "理工",
      "需面试",
      "导师联系"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52510",
    "schoolName": "香港科技大学（广州）",
    "departmentName": "全校类",
    "projectName": "2026年香港科技大学（广州）红鸟挑战营即将开启",
    "projectType": "夏令营",
    "discipline": "综合",
    "publishDate": "2026-04-03",
    "deadlineDate": "2026-07-03 23:59",
    "eventStartDate": "2026-04-27",
    "eventEndDate": "2026-07-03",
    "applyLink": "https://mp.weixin.qq.com/s/wXLOxW7t2zyNGQ4oB1ggaw",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52510",
    "requirements": "我们总在寻找，寻找那片允许你打破常规的土壤。2026年的夏天，别让鲜活的思考在既定的轨道上沉寂。 这一次，我们不谈枯燥的说教，只谈如何以热爱为序，邀你共赴一场灵魂共振、思维破壁的探索之旅。 香港科技大学（广州） 红鸟挑战营营期主题与时间正式揭晓！ 当智能体模拟认知、介入具身，人的坐标在哪里？",
    "materialsRequired": [
      "以原通知材料要求为准"
    ],
    "examInterviewInfo": "委员会的遴选与面试，将获得红鸟硕士项目的录取资格。 2026年红鸟挑战营将举办3期，每期预计招收100名营员。 挑战者的故事，从来不止一种写法——《挑战者十日录》正式发布 点击图片查看原文",
    "contactInfo": "以原通知中的联系方式为准",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "双非",
      "广东",
      "综合",
      "需面试"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52321",
    "schoolName": "深圳医学科学院",
    "departmentName": "全校类",
    "projectName": "2026年深圳医学科学院2026年国际暑期学校报名通知",
    "projectType": "夏令营",
    "discipline": "综合",
    "publishDate": "2026-04-04",
    "deadlineDate": "2026-07-06 23:59",
    "eventStartDate": "",
    "eventEndDate": "2026-07-06",
    "applyLink": "https://mp.weixin.qq.com/s/o7-AzmezWv4mWVYM8GtmkA",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52321",
    "requirements": "招生对象 本项目面向以下学生开放申请： 本科二年级以上在校生 在读硕士研究生 专业背景包括但不限于：生物学、医学、药学、化学、生物医学工程、计算机科学、物理学、材料科学、心理学及相关学科",
    "materialsRequired": [
      "请将全部申请材料按顺序整合为一个",
      "PDF",
      "文件，通过电子邮件发送至：",
      "意向导师邮箱 和 研究生办公室邮箱（",
      "graduate_office@smart.org.cn",
      "邮件标题格式请注明：2026 Summer School – 姓名 – 学校"
    ],
    "examInterviewInfo": "原通知未明确笔试 / 面试安排，建议以原文和后续邮件为准。",
    "contactInfo": "graduate_office@smart.org.cn / 0755-26923202",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "双非",
      "广东",
      "综合",
      "材料要求复杂",
      "导师联系"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52345",
    "schoolName": "空军工程大学",
    "departmentName": "全校类",
    "projectName": "2026年空军工程大学2027年直接选拔招录“双一流”建设高校及建设学科应届本科毕业生入伍攻读硕士研究生预通知",
    "projectType": "预推免",
    "discipline": "综合",
    "publishDate": "2026-04-03",
    "deadlineDate": "2026-07-30 23:59",
    "eventStartDate": "",
    "eventEndDate": "2026-07-30",
    "applyLink": "https://www.afeu.edu.cn/info/1057/11453.htm",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52345",
    "requirements": "“双一流”建设高校及建设学科应届本科毕业生入伍攻读硕士研究生",
    "materialsRequired": [
      "成绩单",
      "身份证"
    ],
    "examInterviewInfo": "待后续推免资格明确且体检政审合格后",
    "contactInfo": "kgdyzb@163.com / 029-84786148",
    "remarks": "）有以下情形之一者，取消录取资格： 在推荐免试过程中有弄虚作假行为的； 日前未获得学士学位及相应毕业证书； 入学复查复试不合格的。 ）大学已录取的推免生，按要求不再报名参加全国硕士研究生招生考试。 以上政策",
    "tags": [
      "中国",
      "综合",
      "需面试"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-24609",
    "schoolName": "南方科技大学",
    "departmentName": "商学院",
    "projectName": "2026年南方科技大学商学院“可持续发展：科技 + 金融”夏令营招生简章",
    "projectType": "夏令营",
    "discipline": "经管",
    "publishDate": "2026-03-18",
    "deadlineDate": "",
    "eventStartDate": "2026-03-18",
    "eventEndDate": "",
    "applyLink": "https://mp.weixin.qq.com/s/A0Ng4nD3Zbp7WUEXrpVBjA",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/24609",
    "requirements": "以原通知申请条件为准",
    "materialsRequired": [
      "以原通知材料要求为准"
    ],
    "examInterviewInfo": "原通知未明确笔试 / 面试安排，建议以原文和后续邮件为准。",
    "contactInfo": "以原通知中的联系方式为准",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "双一流",
      "广东",
      "经管"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-24690",
    "schoolName": "上海财经大学",
    "departmentName": "滴水湖高级金融学院",
    "projectName": "2026年上海财经大学滴水湖高级金融学院金融硕士（MF）项目2027级MF招生",
    "projectType": "预推免",
    "discipline": "经管",
    "publishDate": "2026-03-17",
    "deadlineDate": "",
    "eventStartDate": "",
    "eventEndDate": "",
    "applyLink": "https://mp.weixin.qq.com/s/wY-Tk8NI_yHJI73mhXc_CQ",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/24690",
    "requirements": "SUFE-DAFI 建校于1917年，是中国教育史上最早的商科大学。1996年，学校成为国家“211工程”重点建设高校；2006年，成为国家“优势学科创新平台”建设高校；2017年，入选国家“双一流”建设高校；2020-2025连续6年“软科中国大学排名”财经类大学全国第1。 上海财经大学滴水湖高级金融学院（简称上财滴水湖高金）",
    "materialsRequired": [
      "以原通知材料要求为准"
    ],
    "examInterviewInfo": "• 完成国家推免系统志愿填报 方式二：全国统考 10月 完成国家统考系统志愿填报 12月下旬 参加全国统考",
    "contactInfo": "dafi_mf@mail.shufe.edu.cn / 021-38220125",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "211",
      "双一流",
      "上海",
      "经管",
      "导师联系"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52254",
    "schoolName": "清华大学",
    "departmentName": "环境学院",
    "projectName": "2026年清华大学环境学院国际暑期学校招募开启",
    "projectType": "夏令营",
    "discipline": "理工",
    "publishDate": "2026-03-27",
    "deadlineDate": "",
    "eventStartDate": "",
    "eventEndDate": "",
    "applyLink": "https://mp.weixin.qq.com/s/MCT2PPpeZvc1-ny8hGQjkg",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52254",
    "requirements": "供稿 | 教学办公室 通讯员 | 姜爱娜 编辑 | 张楠楠 审核 | 邓兵 责编 | 张少君",
    "materialsRequired": [
      "以原通知材料要求为准"
    ],
    "examInterviewInfo": "原通知未明确笔试 / 面试安排，建议以原文和后续邮件为准。",
    "contactInfo": "以原通知中的联系方式为准",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "985",
      "211",
      "双一流",
      "自划线",
      "北京",
      "理工"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-24607",
    "schoolName": "中国科学院",
    "departmentName": "空间应用工程与技术中心",
    "projectName": "2026年中国科学院空间应用工程与技术中心夏令营招募通知",
    "projectType": "夏令营",
    "discipline": "理工",
    "publishDate": "2026-03-19",
    "deadlineDate": "",
    "eventStartDate": "",
    "eventEndDate": "",
    "applyLink": "https://mp.weixin.qq.com/s/6-Kk6NUMe1e6ftwuhGYwxw?scene=1",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/24607",
    "requirements": "国内各高校大三本科生（2027年毕业，不仅局限于推免生）；品学兼优，成绩优秀，动手能力强，对星际航行有浓厚的兴趣； 专业要求 航空宇航科学与技术、计算机科学与技术、信息与通信工程、电子科学与技术、遥感科学与技术、动力工程及工程热物理、电子信息、能源动力、行星科学等相关专业。 华南理工大学 时间：2026/3/19-19:00 地点：五山校区清清文理楼3A01报告厅 中山大学 时间：2026/3/20-15:00",
    "materialsRequired": [
      "以原通知材料要求为准"
    ],
    "examInterviewInfo": "，表现优秀者，将在推免录取、统考录取中获得重点关注，为后续研究生生涯奠定基础。 资金资助 夏令营期间食宿全免并报销单程路费，优秀营员录取后将获得1万-3万的所长奖学金“菁英启航”奖，且在读期间免学费及住宿费，并邀请参加中心发射场基地的入学实习， 赴发射场现场观摩发射 往届夏令营剪影 夏令营时间",
    "contactInfo": "edu@csu.ac.cn / 010-82981400",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "双一流",
      "北京",
      "理工",
      "导师联系"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52433",
    "schoolName": "中国科学院",
    "departmentName": "上海光学精密机械研究所",
    "projectName": "2026年中国科学院上海光学精密机械研究所招生宣传手册",
    "projectType": "夏令营",
    "discipline": "理工",
    "publishDate": "2026-04-08",
    "deadlineDate": "",
    "eventStartDate": "",
    "eventEndDate": "",
    "applyLink": "https://mp.weixin.qq.com/s/ofFGoCswDH6BLCRjnuVLGg?scene=1&click_id=9",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52433",
    "requirements": "点击上方“上光教育”关注本公众号 上海光机所简介 中国科学院上海光学精密机械研究所（简称：上海光机所）成立于1964年，是我国建立最早、规模最大的激光科学技术专业研究所。现已成为以现代光学重大基础前沿探索、强激光科技装置建设、激光与光电子系统开拓为重点的综合性研究所。研究所重点学科领域为：强激光技术、强场物理与强光光学、空间激光与时频技术、信息光学、量子光学、激光与光电子器件、光学材料等。 全所现有职工1000余人，专业技术人员900余人，先后有9位专家当选为中国科学院、中国工程院院士；2位专家当选中国科学院外籍院士。在读研究生900余人。拥有包括全国重点实验室的国家级科研平台4个、“中国科学院-中国工程物理研究院”联合实验室1个、上海市重点实验室2个。 建所以来，上海光机所恪守国家战略科技力量主力军使命定位，围绕国家重大需求，在超强激光科学与聚变新体系、空天激光信息网络技术与系统、自主可控光学核心材料和激光高端装备等主攻方向上，不断提升原始创新能力，突破关键核心技术，完成一系列重大科研项目，包括重大光学与激光前沿基础和应用基础研究项目、大型激光应用工程研究等，为推动我国超强激光与科学技术发展做出了重要贡献。 建成国内仅有、国际为数不多的兼具大能量短脉冲激光加载和主动探针光功能的“神光Ⅱ”综合高功率激光装置；达到世界最高水平峰值功率12.9拍瓦的超强超短激光装置；国际上首次观察到基于激光加速器的自由电子激光放大输出的新一代超强超短激光综合实验装置等大科学装置。成功研制国际首台在轨运行并开展科学实验的空间冷原子钟；国际上首次获得夜晚全球和南北两极二氧化碳柱浓度的国家空间基础设施“大气一号”主载荷大气探测激光雷达。截止2025年12月，共获国家级奖励49项，中国科学院奖励124项，省部级奖励161项。申请专利5850项，授权3760项。",
    "materialsRequired": [
      "以原通知材料要求为准"
    ],
    "examInterviewInfo": "原通知未明确笔试 / 面试安排，建议以原文和后续邮件为准。",
    "contactInfo": "以原通知中的联系方式为准",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "双一流",
      "北京",
      "理工",
      "导师联系"
    ],
    "status": "报名中",
    "year": 2026,
    "deadlineLevel": "future",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52132",
    "schoolName": "安徽医科大学",
    "departmentName": "第一临床医学院（第一附属医院）",
    "projectName": "2026年安徽医科大学第一临床医学院（第一附属医院）2025年全国优秀大学生暑期夏令营招生通知",
    "projectType": "夏令营",
    "discipline": "医农",
    "publishDate": "2026-03-04",
    "deadlineDate": "2025-07-10 23:59",
    "eventStartDate": "2025-07-05",
    "eventEndDate": "2025-07-10",
    "applyLink": "https://mp.weixin.qq.com/s/O6jvupsWxzc4tAUUf-A-1g",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52132",
    "requirements": "拥护中国共产党的领导，品德良好，遵纪守法；",
    "materialsRequired": [
      "（逾期不予受理）",
      "2025年7月10-13日："
    ],
    "examInterviewInfo": "评价等级A+，连续13年入围中国最佳医院百强榜，科研学术排名全国38位，在《2022年中国医院科技量值排名》中排行全国第60位，有30个学科进入全国前100位，16个学科居安徽省第一。 医院坚持“一院多区”战略发展格局，统筹推进多院区一体化高质量发展，目前共有绩溪路院区、高新院区、南区三个同质化管理的院区，省公卫临床中心（北区）顺利移交，着力打造国家重大传染病防治基地，国家心血管病区域医疗中心—北京安贞医院安徽医院依托医院建设，预计2026年年初开诊。目前，医院占地总面积44.4万平方米，建筑面积89.14万平方米，共开放床位6038张，年度门诊量699万人次，出院病人31.74万人次，手术（含部分操作）24.49万台次。固定资产总值51.5亿元，设备总值21.69亿元，配套有GE SIGNA PET/MR、GE Revolution Apex 超高端CT、GE SIGNA Premier 3.0T磁共振、西门子ARTIS pheno DSA 、第四代达芬奇手术机器人Xi、天玑TiRobot骨科手术机器人、ECMO等高端医疗设备。 医院已建成各级临床与科研平台45个，拥有教育部重点实验室、医药基础研究创新中心、工程研究中心、国际合作联合实验室4个，国家卫健委重点实验室1个，国家中医药管理局三级实验室1个，省级重点实验室7个，安徽省工程研究中心、工程技术研究中心、国际联合研究中心等…",
    "contactInfo": "ayfypyb3665@163.com / 0551-62923665",
    "remarks": "被录取的营员请带好相关材料在指定时间进行报到；",
    "tags": [
      "双非",
      "安徽",
      "医农",
      "导师联系"
    ],
    "status": "已截止",
    "year": 2026,
    "deadlineLevel": "expired",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-28204",
    "schoolName": "北京大学",
    "departmentName": "国际关系学院",
    "projectName": "2025年北京大学国际关系学院巴黎政治大学项目2026年推荐免试硕士研究生通知",
    "projectType": "预推免",
    "discipline": "文法",
    "publishDate": "2025-09-03",
    "deadlineDate": "2026-02-20 23:59",
    "eventStartDate": "",
    "eventEndDate": "2026-02-20",
    "applyLink": "https://www.sis.pku.edu.cn/message27/1386840.htm",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/28204",
    "requirements": "参加北大国际关系学院2026年研究生推免，并申请北京大学国际关系学院-巴黎政治大学国际关系双硕士学位项目（PKU - Sciences Po Dual Master’s Degree in International Relations，以下简称北大-巴政项目）的学生，请首先参照《北京大学国际关系学院推荐和接收2026年免试攻读硕士研究生实施办法》，网址https://www.sis.pku.edu.cn/index.htm，在规定时间内按要求完成推免资格申请、网上申报，与申请普通序列项目一样参加复试。 复试结束后，收到推免拟录取通知并确认接受录取的学生需在2026年1月25日前完成巴黎政治大学项目申请（巴政网申地址为： https://www.sciencespo.fr/admissions/en/graduate/dual-degrees/）。 请于2026年2月20日上午9:00前将以下材料的英文件电子版，材料请按以下顺序排列，合并至一个PDF文件内，并将文件命名为本人姓名，发送电邮至：sis@pku.edu.cn 2.成绩单（盖章正式成绩单，需已包含4分制或5分制GPA成绩，或另行提供学校的换算标准以及换算后的GPA成绩）",
    "materialsRequired": [
      "简历",
      "成绩单",
      "个人陈述",
      "英语成绩"
    ],
    "examInterviewInfo": "预计在来年春季学期开学后进行。 特别提醒：",
    "contactInfo": "sis@pku.edu.cn / 010-62759199",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "985",
      "211",
      "双一流",
      "自划线",
      "北京",
      "文法",
      "需面试"
    ],
    "status": "已截止",
    "year": 2026,
    "deadlineLevel": "expired",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-24601",
    "schoolName": "香港大学",
    "departmentName": "经管学院",
    "projectName": "2026年香港大学经管学院2026年博士研究生招募营",
    "projectType": "夏令营",
    "discipline": "经管",
    "publishDate": "2026-01-31",
    "deadlineDate": "2026-03-01 23:59",
    "eventStartDate": "2026-01-31",
    "eventEndDate": "2026-03-01",
    "applyLink": "https://mp.weixin.qq.com/s/iPbbK-GHtPI86CLgojObcg",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/24601",
    "requirements": "Eligibility 申请者应已取得或预计于2027年秋季前取得大学本科学历，不限专业；本科学习成绩平均分需达85分（以100分为满分计算）或以上；或平均积点（GPA）需达到3.6或以上（以4.0为满分计算）；或总评成绩排名在该校同年级专业前10%以内。 具同等学历并預计于2027年秋季前毕业的硕士在读学生亦可报名参加。 参加者将有机会获得 Benefits 免试预录取资格 相等于首年学费金额的入学奖学金 学院提名竞逐奖学金高达160万港元",
    "materialsRequired": [
      "以原通知材料要求为准"
    ],
    "examInterviewInfo": "原通知未明确笔试 / 面试安排，建议以原文和后续邮件为准。",
    "contactInfo": "fbephd@hku.hk",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "双非",
      "香港",
      "经管"
    ],
    "status": "已截止",
    "year": 2026,
    "deadlineLevel": "expired",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52136",
    "schoolName": "南开大学",
    "departmentName": "国家创新与金融研究院",
    "projectName": "2026年南开大学国家创新与金融研究院卓越金融人才培养项目研究生选拔公告",
    "projectType": "夏令营",
    "discipline": "经管",
    "publishDate": "2026-03-24",
    "deadlineDate": "2026-03-30 23:59",
    "eventStartDate": "2026-03-24",
    "eventEndDate": "2026-03-30",
    "applyLink": "https://mp.weixin.qq.com/s/u9RzDz8XNSJQBKEwRhoFJA",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52136",
    "requirements": "进入金融学院金融专业复试的考生均可申请。有金融学、经济学相关专业及人工智能、数学、物理学、计算机科学、统计学等理工科交叉学习背景或经验者优先；具有较高外语水平者优先。",
    "materialsRequired": [
      "以原通知材料要求为准"
    ],
    "examInterviewInfo": "与计划",
    "contactInfo": "以原通知中的联系方式为准",
    "remarks": "具体申请报名、考核等信息，请考生关注金融学院、国家创新与金融研究院网站（https://finance.nankai.edu.cn，https://inif.nankai.edu.cn）。",
    "tags": [
      "985",
      "211",
      "双一流",
      "自划线",
      "天津",
      "经管",
      "导师联系"
    ],
    "status": "已截止",
    "year": 2026,
    "deadlineLevel": "expired",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52184",
    "schoolName": "北京大学",
    "departmentName": "国际法学院",
    "projectName": "2026年北京大学国际法学院2027研招开放日报名启动",
    "projectType": "夏令营",
    "discipline": "文法",
    "publishDate": "2026-03-30",
    "deadlineDate": "2026-04-07 23:59",
    "eventStartDate": "",
    "eventEndDate": "2026-04-07",
    "applyLink": "https://mp.weixin.qq.com/s/oo4zCHqBmZJfJfd6mSsNcA?scene=1",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52184",
    "requirements": "北京大学国际法学院（STL）将于2026年4月11日举办2027级研招首场开放日。 关于STL，你也许已经听说过一些标签：中国唯一提供完整美国法教育的法学院、全球唯一将普通法（J.D.)教育与中国法硕(J.M.)教育相结合的法学院。但在标签之外，它究竟是一所怎样的学院？四年的学习强度是否适合自己？跨专业背景在法律学习中会遇到怎样的挑战？ 我们希望通过这场开放日，帮你找到这些问题的答案。",
    "materialsRequired": [
      "以原通知材料要求为准"
    ],
    "examInterviewInfo": "原通知未明确笔试 / 面试安排，建议以原文和后续邮件为准。",
    "contactInfo": "以原通知中的联系方式为准",
    "remarks": "本次活动安排紧凑，建议考生本人报名参加。陪同来访的家长可自行安排校园参观。 关于后续招生活动： 无法参加本次开放日的同学不必担心。4月至6月，我们将在北京、上海、南京、武汉、长沙、成都、重庆、西安等城市举办巡回宣讲会。具体场次安排请关注后续通知。点击 “ 阅读原文 ”可前往官网查看部分已经确定时间地点的场次。",
    "tags": [
      "985",
      "211",
      "双一流",
      "自划线",
      "北京",
      "文法"
    ],
    "status": "已截止",
    "year": 2026,
    "deadlineLevel": "expired",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  },
  {
    "id": "baoyantongzhi-52152",
    "schoolName": "澳门大学",
    "departmentName": "健康科学学院",
    "projectName": "2026年澳门大学健康科学学院内地优秀大学生健康科学夏令营",
    "projectType": "夏令营",
    "discipline": "理工",
    "publishDate": "2026-03-24",
    "deadlineDate": "2026-04-12 23:59",
    "eventStartDate": "2026-03-24",
    "eventEndDate": "2026-04-12",
    "applyLink": "https://mp.weixin.qq.com/s/fpbDZtx89_esblaKbo_W3g?scene=25&click_id=8&sessionid=#wechat_redirect",
    "sourceLink": "https://www.baoyantongzhi.com/notice/detail/52152",
    "requirements": "內地優秀大學生健康科學夏令營 為促進內地優秀大學生的溝通和交流，幫助廣大青年學子瞭解澳門大學健康科學的科研教學環境和當前學科發展前沿問題，激發他們的研究興趣，吸引有培養潛質的優秀學生繼續深造，澳門大學健康科學學院將於2026年7月27日至30日舉辦“2026年內地優秀大學生健康科學夏令營”活動。 Prof. Wang, as a bachelor graduate of Nanchang Uniersity, shared his expertise and experience with thestudents, and invigorated them to widen their perspectives for new ways of seeing. FHS PhD student Jiaheng LI, who is the alumnus of Nanchang University, shared his academic path with the students, and introduced the doctoral study of FHS. He encouraged the students to quench curiosity for truth through research, not to underestimate their abilities and dare to jump out of the comfort zone, where the students can find new opportunit rof. Wang, as a bachelor graduate of Nanchang Uniersity, shared his expertise and experience with thestudents, and invigorated them to widen their perspectives for new ways of seeing. FHS PhD student Jiaheng LI, who is the alumnus of Nanchang University, shared his academic path with the students, and introduc…",
    "materialsRequired": [
      "以原通知材料要求为准"
    ],
    "examInterviewInfo": "原通知未明确笔试 / 面试安排，建议以原文和后续邮件为准。",
    "contactInfo": "以原通知中的联系方式为准",
    "remarks": "该项目由保研通知网同步，建议结合原文再次确认关键时间和要求。",
    "tags": [
      "澳门",
      "理工"
    ],
    "status": "已截止",
    "year": 2026,
    "deadlineLevel": "expired",
    "sourceSite": "保研通知网",
    "collectedAt": "2026-04-14 08:00",
    "updatedAt": "2026-04-14 08:00",
    "lastCheckedAt": "2026-04-14 08:00",
    "isVerified": false,
    "changeLog": [],
    "historyRecords": []
  }
]
```

## hooks/use-user-session.ts

```ts
'use client';

import { useEffect, useState } from 'react';
import { getUserSession, watchUserSession, type UserSession } from '@/lib/user-session';

export function useUserSessionState() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = () => {
      setSession(getUserSession());
      setReady(true);
    };

    load();
    const dispose = watchUserSession(load);

    return () => dispose();
  }, []);

  return {
    session,
    ready,
    loggedIn: Boolean(session?.loggedIn)
  };
}

```

## lib/cloudbase-data.ts

```ts
'use client';

import {
  materialChecklistDefinitions,
  sampleUserProjects,
  type DeadlineLevel,
  type ProjectType,
  type MaterialChecklistKey,
  type PublicNoticeProject,
  type UserProjectRecord,
  type UserProjectStatus
} from './mock-data';
import { baseNoticeProjects } from './notice-source';

const APPLICATION_STORAGE_KEY = 'seekoffer-my-application-table';
const MANUAL_PROJECT_STORAGE_KEY = 'seekoffer-manual-projects';
const APPLICATION_EVENT_NAME = 'seekoffer-applications-updated';

export type ApplicationRow = {
  item: UserProjectRecord;
  project: PublicNoticeProject;
};

export type ManualProjectInput = {
  schoolName: string;
  departmentName: string;
  projectName: string;
  projectType: ProjectType;
  discipline: string;
  deadlineDate: string;
  eventStartDate?: string;
  eventEndDate?: string;
  applyLink?: string;
};

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function emitApplicationUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(APPLICATION_EVENT_NAME));
  }
}

function parseDeadline(deadlineDate: string) {
  const normalized = deadlineDate.includes('T') ? deadlineDate : deadlineDate.replace(' ', 'T');
  const value = new Date(`${normalized}:00+08:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function resolveDeadlineLevel(deadlineDate: string): DeadlineLevel {
  const value = parseDeadline(deadlineDate);
  if (!value) return 'future';

  const diff = value.getTime() - Date.now();
  const day = 1000 * 60 * 60 * 24;

  if (diff <= 0) return 'expired';
  if (diff <= day) return 'today';
  if (diff <= day * 3) return 'within3days';
  if (diff <= day * 7) return 'within7days';
  return 'future';
}

function resolvePublicStatus(level: DeadlineLevel): PublicNoticeProject['status'] {
  if (level === 'expired') return '已截止';
  if (level === 'today' || level === 'within3days') return '即将截止';
  return '报名中';
}

export function calculateMaterialsProgress(record: Pick<UserProjectRecord, MaterialChecklistKey>) {
  const total = materialChecklistDefinitions.length;
  const completed = materialChecklistDefinitions.filter(({ key }) => record[key]).length;
  return Math.round((completed / total) * 100);
}

function buildDefaultRecord(projectId: string): UserProjectRecord {
  const base: UserProjectRecord = {
    userProjectId: `user-${projectId}`,
    userId: 'demo-user',
    projectId,
    isFavorited: true,
    myStatus: '已收藏',
    priorityLevel: '中',
    materialsProgress: 0,
    cvReady: false,
    transcriptReady: false,
    rankingProofReady: false,
    recommendationReady: false,
    personalStatementReady: false,
    contactSupervisorDone: false,
    submittedAt: '',
    interviewTime: '',
    resultStatus: '未出结果',
    myNotes: '',
    customReminderEnabled: true
  };

  return {
    ...base,
    materialsProgress: calculateMaterialsProgress(base)
  };
}

function normalizeManualProject(project: Partial<PublicNoticeProject>) {
  const deadlineDate = project.deadlineDate || '';
  const deadlineLevel = resolveDeadlineLevel(deadlineDate);
  const today = new Date().toISOString().slice(0, 10);

  return {
    id: project.id || `custom-${Date.now()}`,
    schoolName: project.schoolName || '手动录入项目',
    departmentName: project.departmentName || '待补充',
    projectName: project.projectName || '未命名项目',
    projectType: project.projectType || '夏令营',
    discipline: project.discipline || '待补充',
    publishDate: project.publishDate || today,
    deadlineDate,
    eventStartDate: project.eventStartDate || '',
    eventEndDate: project.eventEndDate || '',
    applyLink: project.applyLink || '',
    sourceLink: project.sourceLink || '',
    requirements: project.requirements || '用户手动录入，后续可在备注中继续补充要求。',
    materialsRequired: project.materialsRequired || ['简历', '成绩单'],
    examInterviewInfo: project.examInterviewInfo || '待补充',
    contactInfo: project.contactInfo || '待补充',
    remarks: project.remarks || '用户手动录入项目',
    tags: project.tags || ['手动录入'],
    status: project.status || resolvePublicStatus(deadlineLevel),
    year: project.year || new Date().getFullYear(),
    deadlineLevel,
    sourceSite: project.sourceSite || '用户手动录入',
    collectedAt: project.collectedAt || '',
    updatedAt: project.updatedAt || '',
    lastCheckedAt: project.lastCheckedAt || '',
    isVerified: project.isVerified || false,
    changeLog: project.changeLog || [],
    historyRecords: project.historyRecords || []
  } satisfies PublicNoticeProject;
}

function normalizeRecord(record: Partial<UserProjectRecord>) {
  const base = buildDefaultRecord(record.projectId || '');
  const merged = {
    ...base,
    ...record
  } as UserProjectRecord;

  return {
    ...merged,
    materialsProgress: calculateMaterialsProgress(merged)
  };
}

function readStoredManualProjects() {
  if (!canUseBrowserStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(MANUAL_PROJECT_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is Partial<PublicNoticeProject> => Boolean(item && typeof item === 'object'))
      .map((item) => normalizeManualProject(item));
  } catch {
    return [];
  }
}

function writeStoredManualProjects(projects: PublicNoticeProject[]) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(MANUAL_PROJECT_STORAGE_KEY, JSON.stringify(projects));
  emitApplicationUpdate();
}

function getAllProjects() {
  return [...baseNoticeProjects, ...readStoredManualProjects()];
}

function readStoredRecords() {
  if (!canUseBrowserStorage()) {
    return sampleUserProjects.map((item) => normalizeRecord(item));
  }

  try {
    const raw = window.localStorage.getItem(APPLICATION_STORAGE_KEY);
    if (!raw) {
      const seeded = sampleUserProjects.map((item) => normalizeRecord(item));
      window.localStorage.setItem(APPLICATION_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return sampleUserProjects.map((item) => normalizeRecord(item));
    }

    return parsed
      .filter((item): item is Partial<UserProjectRecord> => Boolean(item && typeof item === 'object'))
      .map((item) => normalizeRecord(item));
  } catch {
    return sampleUserProjects.map((item) => normalizeRecord(item));
  }
}

function writeStoredRecords(records: UserProjectRecord[]) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(APPLICATION_STORAGE_KEY, JSON.stringify(records));
  emitApplicationUpdate();
}

export function watchApplicationTable(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handler = () => callback();
  window.addEventListener(APPLICATION_EVENT_NAME, handler);
  window.addEventListener('storage', handler);

  return () => {
    window.removeEventListener(APPLICATION_EVENT_NAME, handler);
    window.removeEventListener('storage', handler);
  };
}

export async function fetchPublicNotices() {
  return baseNoticeProjects;
}

export async function fetchNoticeById(id: string) {
  return getAllProjects().find((item) => item.id === id) || null;
}

export async function fetchDeadlineNotices() {
  return baseNoticeProjects.filter((item) => item.deadlineLevel !== 'future');
}

export async function fetchUserProjects() {
  return readStoredRecords();
}

export async function fetchApplicationRows() {
  const records = readStoredRecords();
  const projects = getAllProjects();
  const rows = records.reduce<ApplicationRow[]>((list, item) => {
    const project = projects.find((notice) => notice.id === item.projectId);
    if (project) {
      list.push({ item, project });
    }
    return list;
  }, []);

  return rows.sort((left, right) => left.project.deadlineDate.localeCompare(right.project.deadlineDate));
}

export async function addProjectToApplicationTable(projectId: string) {
  const current = readStoredRecords();
  const existing = current.find((item) => item.projectId === projectId);

  if (existing) {
    return existing;
  }

  const created = buildDefaultRecord(projectId);
  writeStoredRecords([...current, created]);
  return created;
}

export async function createManualApplicationEntry(input: ManualProjectInput) {
  const manualProjects = readStoredManualProjects();
  const projectId = `custom-${Date.now()}`;
  const nowText = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const project = normalizeManualProject({
    id: projectId,
    schoolName: input.schoolName.trim(),
    departmentName: input.departmentName.trim() || '待补充',
    projectName: input.projectName.trim(),
    projectType: input.projectType,
    discipline: input.discipline.trim() || '待补充',
    publishDate: nowText.slice(0, 10),
    deadlineDate: input.deadlineDate.trim(),
    eventStartDate: input.eventStartDate?.trim() || '',
    eventEndDate: input.eventEndDate?.trim() || '',
    applyLink: input.applyLink?.trim() || '',
    sourceLink: input.applyLink?.trim() || '',
    remarks: '用户手动录入项目',
    sourceSite: '用户手动录入',
    collectedAt: nowText,
    updatedAt: nowText,
    lastCheckedAt: nowText,
    tags: ['手动录入']
  });

  writeStoredManualProjects([...manualProjects, project]);

  const current = readStoredRecords();
  const record = normalizeRecord({
    ...buildDefaultRecord(project.id),
    projectId: project.id
  });
  writeStoredRecords([...current, record]);
  return { item: record, project };
}

export async function updateUserProject(userProjectId: string, patch: Partial<UserProjectRecord>) {
  const current = readStoredRecords();
  const next = current.map((item) => {
    if (item.userProjectId !== userProjectId) {
      return item;
    }

    const merged = normalizeRecord({ ...item, ...patch });

    if (patch.myStatus === '已提交' && !merged.submittedAt) {
      return {
        ...merged,
        submittedAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
      };
    }

    return merged;
  });

  writeStoredRecords(next);
  return next.find((item) => item.userProjectId === userProjectId) || null;
}

export async function updateUserProjectStatus(userProjectId: string, myStatus: UserProjectStatus) {
  return updateUserProject(userProjectId, { myStatus });
}

export function getApplicationProject(projectId: string): PublicNoticeProject | null {
  return getAllProjects().find((item) => item.id === projectId) || null;
}

```

## lib/cloudbase-env.ts

```ts
export const CLOUDBASE_ENV_ID =
  process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID || 'cloudbase-4gonuep215f23af4';

export const CLOUDBASE_REGION = process.env.NEXT_PUBLIC_CLOUDBASE_REGION || 'ap-shanghai';

```

## lib/cloudbase-web.ts

```ts
'use client';

import cloudbase from '@cloudbase/js-sdk';
import { CLOUDBASE_ENV_ID, CLOUDBASE_REGION } from './cloudbase-env';

type CloudbaseApp = ReturnType<typeof cloudbase.init>;

let appPromise: Promise<CloudbaseApp> | null = null;

async function initCloudbaseApp() {
  const app = cloudbase.init({
    env: CLOUDBASE_ENV_ID,
    region: CLOUDBASE_REGION
  });

  const auth = app.auth({ persistence: 'local' });
  const loginState = await auth.getLoginState();

  if (!loginState) {
    await auth.anonymousAuthProvider().signIn();
  }

  return app;
}

export async function getCloudbaseApp() {
  if (typeof window === 'undefined') {
    throw new Error('CloudBase Web SDK 只能在浏览器端初始化。');
  }

  if (!appPromise) {
    appPromise = initCloudbaseApp();
  }

  return appPromise;
}

```

## lib/mock-data.ts

```ts
export type ProjectType = '夏令营' | '预推免' | '正式推免';

export type PublicProjectStatus =
  | '未开始'
  | '报名中'
  | '即将截止'
  | '已截止'
  | '活动中'
  | '已结束';

export type DeadlineLevel = 'today' | 'within3days' | 'within7days' | 'future' | 'expired';

export type UserProjectStatus =
  | '已收藏'
  | '准备材料中'
  | '已提交'
  | '待考核'
  | '已通过'
  | '未通过'
  | '已放弃';

export type PriorityLevel = '高' | '中' | '低';

export type ResultStatus = '未出结果' | '待确认' | '已通过' | '未通过';

export type MaterialChecklistKey =
  | 'cvReady'
  | 'transcriptReady'
  | 'rankingProofReady'
  | 'recommendationReady'
  | 'personalStatementReady'
  | 'contactSupervisorDone';

export type ChangeLogEntry = {
  date: string;
  field: string;
  change: string;
};

export type HistoryRecord = {
  year: number;
  publishDate: string;
  deadlineDate: string;
  summary: string;
};

export type PublicNoticeProject = {
  id: string;
  schoolName: string;
  departmentName: string;
  projectName: string;
  projectType: ProjectType;
  discipline: string;
  publishDate: string;
  deadlineDate: string;
  eventStartDate: string;
  eventEndDate: string;
  applyLink: string;
  sourceLink: string;
  requirements: string;
  materialsRequired: string[];
  examInterviewInfo: string;
  contactInfo: string;
  remarks: string;
  tags: string[];
  status: PublicProjectStatus;
  year: number;
  deadlineLevel: DeadlineLevel;
  sourceSite: string;
  collectedAt: string;
  updatedAt: string;
  lastCheckedAt: string;
  isVerified: boolean;
  changeLog: ChangeLogEntry[];
  historyRecords: HistoryRecord[];
};

export type UserProjectRecord = {
  userProjectId: string;
  userId: string;
  projectId: string;
  isFavorited: boolean;
  myStatus: UserProjectStatus;
  priorityLevel: PriorityLevel;
  materialsProgress: number;
  cvReady: boolean;
  transcriptReady: boolean;
  rankingProofReady: boolean;
  recommendationReady: boolean;
  personalStatementReady: boolean;
  contactSupervisorDone: boolean;
  submittedAt: string;
  interviewTime: string;
  resultStatus: ResultStatus;
  myNotes: string;
  customReminderEnabled: boolean;
};

export type FieldGuideCategory = '公共项目字段' | '个人申请字段' | '系统字段';

export type FieldGuideItem = {
  key: string;
  label: string;
  category: FieldGuideCategory;
  description: string;
  example: string;
};

export type ApplicationColumnPreset = {
  key: string;
  label: string;
  description: string;
  sample: string;
  required: boolean;
};

export type StatusDefinition = {
  label: string;
  meaning: string;
  nextAction: string;
};

export const projectTypeOptions: Array<'全部类型' | ProjectType> = [
  '全部类型',
  '夏令营',
  '预推免',
  '正式推免'
];

export const publicStatusOptions: Array<'全部状态' | PublicProjectStatus> = [
  '全部状态',
  '未开始',
  '报名中',
  '即将截止',
  '已截止',
  '活动中',
  '已结束'
];

export const userStatusOptions: UserProjectStatus[] = [
  '已收藏',
  '准备材料中',
  '已提交',
  '待考核',
  '已通过',
  '未通过',
  '已放弃'
];

export const priorityOptions: PriorityLevel[] = ['高', '中', '低'];

export const materialChecklistDefinitions: Array<{ key: MaterialChecklistKey; label: string }> = [
  { key: 'cvReady', label: '简历' },
  { key: 'transcriptReady', label: '成绩单' },
  { key: 'rankingProofReady', label: '排名证明' },
  { key: 'recommendationReady', label: '推荐信' },
  { key: 'personalStatementReady', label: '个人陈述' },
  { key: 'contactSupervisorDone', label: '导师联系' }
];

export const applicationColumnPresets: ApplicationColumnPreset[] = [
  {
    key: 'school_name',
    label: '学校',
    description: '一眼识别这个项目属于哪所学校，是整张申请表最基础的定位列。',
    sample: '北京大学',
    required: true
  },
  {
    key: 'department_name',
    label: '学院 / 实验室',
    description: '尽量细化到学院、中心或实验室，避免同校多个项目混淆。',
    sample: '生命科学联合中心（北大方面）',
    required: true
  },
  {
    key: 'project_type',
    label: '项目类型',
    description: '统一使用夏令营、预推免、正式推免三种口径。',
    sample: '夏令营',
    required: true
  },
  {
    key: 'deadline_date',
    label: '截止时间',
    description: '必须精确到日期和时分，后续所有提醒和待办都围绕它生成。',
    sample: '2026-04-13 18:00',
    required: true
  },
  {
    key: 'my_status',
    label: '我的状态',
    description: '替代学生自己 Excel 里最混乱的状态列，用统一状态体系保证可跟踪。',
    sample: '准备材料中',
    required: true
  },
  {
    key: 'materials_progress',
    label: '材料完成度',
    description: '系统根据材料清单自动汇总为百分比，用来生成材料待办。',
    sample: '67%',
    required: true
  },
  {
    key: 'priority_level',
    label: '优先级',
    description: '按高、中、低排序，方便在同一周内明确先做哪些项目。',
    sample: '高',
    required: true
  },
  {
    key: 'custom_reminder_enabled',
    label: '提醒开关',
    description: '决定是否对这个项目开启 7 天、3 天、当天提醒。',
    sample: '开启',
    required: true
  },
  {
    key: 'my_notes',
    label: '个人备注',
    description: '记录导师反馈、策略判断、提交结果等个性化信息。',
    sample: '推荐信周一催老师，周二前提交',
    required: false
  }
];

export const statusDefinitions: StatusDefinition[] = [
  {
    label: '已收藏',
    meaning: '这个项目值得跟踪，但你还没开始正式准备材料。',
    nextAction: '先看材料要求，把关键文档列进待办。'
  },
  {
    label: '准备材料中',
    meaning: '已经确认要报，正在补简历、成绩单、推荐信等材料。',
    nextAction: '优先补齐未完成材料，并检查截止时间。'
  },
  {
    label: '已提交',
    meaning: '材料已经提交，后续关注面试、入营和补充材料通知。',
    nextAction: '等待结果，同时留意邮件和官网更新。'
  },
  {
    label: '待考核',
    meaning: '已经进入笔试、面试、入营确认等后续流程。',
    nextAction: '确认时间安排，处理面试和确认事项。'
  },
  {
    label: '已通过',
    meaning: '已经拿到正向结果，可以作为志愿管理的重要备份。',
    nextAction: '及时记录结果和后续确认节点。'
  },
  {
    label: '未通过',
    meaning: '该项目已结束，不再占用当前申请精力。',
    nextAction: '沉淀经验，转向其他更优先项目。'
  },
  {
    label: '已放弃',
    meaning: '主动放弃该项目，用来避免继续占用待办和提醒位。',
    nextAction: '保留记录即可，不再提醒。'
  }
];

export const guideTips = [
  '公共字段由平台统一维护，解决不同学生自己建表时字段命名不一致的问题。',
  '个人字段由学生自己填写，目标是把原本零散的 Excel 在线化，后续提醒和待办才能自动生成。',
  '系统字段展示来源、核验和变更记录，这一层是普通表格做不到、但网站可以持续提供的价值。'
];

export const noticeProjects: PublicNoticeProject[] = [
  {
    id: 'notice-pku-lsc-2026-summer',
    schoolName: '北京大学',
    departmentName: '生命科学联合中心（北大方面）',
    projectName: '2026 年暑期培训班招生简介',
    projectType: '夏令营',
    discipline: '生命科学',
    publishDate: '2026-03-19',
    deadlineDate: '2026-04-11 23:59',
    eventStartDate: '2026-06-20',
    eventEndDate: '2026-06-24',
    applyLink: 'https://mp.weixin.qq.com/s/c4HLevuAyljhRHrCI-PuzQ?scene=1&click_id=1',
    sourceLink: 'https://www.baoyantongzhi.com/notice/detail/24691',
    requirements:
      '欢迎生命科学、医学、化学、计算机、数学等相关背景本科生报名，要求成绩优秀、学术兴趣明确，并能在暑期全程参与课程与交流活动。',
    materialsRequired: ['简历', '成绩单', '排名证明', '英语成绩证明', '个人陈述'],
    examInterviewInfo: '以材料审核为主，是否安排面试以后续邮件或官网通知为准。',
    contactInfo: '见原文通知页面中的官方联系方式',
    remarks: '原文为微信图文，建议先保存原文链接，再把材料准备拆到自己的申请表里。',
    tags: ['985', '211', '双一流', '生命科学', '材料要求复杂'],
    status: '即将截止',
    year: 2026,
    deadlineLevel: 'today',
    sourceSite: '保研通知网',
    collectedAt: '2026-04-11 10:30',
    updatedAt: '2026-04-11 10:30',
    lastCheckedAt: '2026-04-11 10:30',
    isVerified: true,
    changeLog: [
      { date: '2026-04-10 22:10', field: '初次录入', change: '从保研通知网录入基础项目字段。' },
      { date: '2026-04-11 10:30', field: '材料要求', change: '补充简历、成绩单、排名证明、英语成绩与个人陈述。' }
    ],
    historyRecords: [
      { year: 2025, publishDate: '2025-03-17', deadlineDate: '2025-04-10 23:59', summary: '发布时间相近，截止时间略早。' },
      { year: 2024, publishDate: '2024-03-21', deadlineDate: '2024-04-12 23:59', summary: '往年同样要求生命科学与交叉背景。' }
    ]
  },
  {
    id: 'notice-sjtu-ai-2026-pre',
    schoolName: '上海交通大学',
    departmentName: '人工智能学院',
    projectName: '2026 年预推免报名通知',
    projectType: '预推免',
    discipline: '人工智能',
    publishDate: '2026-04-08',
    deadlineDate: '2026-04-13 18:00',
    eventStartDate: '2026-06-18',
    eventEndDate: '2026-06-20',
    applyLink: 'https://www.baoyantongzhi.com/notice',
    sourceLink: 'https://www.baoyantongzhi.com/notice/detail/24801',
    requirements:
      '面向人工智能、计算机、自动化等方向优秀本科生，建议具备算法、工程项目或科研训练经历。',
    materialsRequired: ['简历', '成绩单', '个人陈述', '项目经历说明', '英语成绩'],
    examInterviewInfo: '往年通常以材料审核加综合面试为主，今年以学院后续通知为准。',
    contactInfo: '建议优先通过学院官网或原文通知确认联系渠道',
    remarks: '适合作为高优先级项目尽快推进，尤其要留意项目经历说明与英语材料。',
    tags: ['985', '上海', '强 com', '需面试'],
    status: '即将截止',
    year: 2026,
    deadlineLevel: 'within3days',
    sourceSite: '保研通知网',
    collectedAt: '2026-04-11 10:30',
    updatedAt: '2026-04-11 10:30',
    lastCheckedAt: '2026-04-11 10:30',
    isVerified: true,
    changeLog: [
      { date: '2026-04-11 09:50', field: '初次录入', change: '补录截止时间和项目类型。' },
      { date: '2026-04-11 10:30', field: '申请条件', change: '补充算法与科研经历要求。' }
    ],
    historyRecords: [
      { year: 2025, publishDate: '2025-04-07', deadlineDate: '2025-04-12 18:00', summary: '去年同样属于 3 天内就要推进的高压项目。' }
    ]
  },
  {
    id: 'notice-zju-cs-2026-summer',
    schoolName: '浙江大学',
    departmentName: '计算机科学与技术学院',
    projectName: '2026 年优秀大学生夏令营通知',
    projectType: '夏令营',
    discipline: '计算机科学与技术',
    publishDate: '2026-04-09',
    deadlineDate: '2026-04-16 23:59',
    eventStartDate: '2026-06-28',
    eventEndDate: '2026-06-30',
    applyLink: 'https://www.baoyantongzhi.com/notice',
    sourceLink: 'https://www.baoyantongzhi.com/notice/detail/24816',
    requirements:
      '欢迎计算机、软件、网络安全等方向优秀学生申请，建议具备项目经历或科研经历。',
    materialsRequired: ['简历', '成绩单', '排名证明', '项目经历说明'],
    examInterviewInfo: '往年常见机试与综合面试，今年需重点关注原文是否有笔试安排。',
    contactInfo: '以学院官方渠道发布为准',
    remarks: '强 com 热门项目，建议尽早确定是否需要额外准备机试。',
    tags: ['985', '杭州', '强 com', '需笔试'],
    status: '报名中',
    year: 2026,
    deadlineLevel: 'within7days',
    sourceSite: '保研通知网',
    collectedAt: '2026-04-11 10:30',
    updatedAt: '2026-04-11 10:30',
    lastCheckedAt: '2026-04-11 10:30',
    isVerified: true,
    changeLog: [{ date: '2026-04-11 10:30', field: '初次录入', change: '录入项目基础字段与笔试提醒。' }],
    historyRecords: [
      { year: 2025, publishDate: '2025-04-11', deadlineDate: '2025-04-18 23:59', summary: '去年发布时间相近，机试安排更早公布。' }
    ]
  },
  {
    id: 'notice-ustc-auto-2026-pre',
    schoolName: '中国科学技术大学',
    departmentName: '自动化系',
    projectName: '2026 年预推免预报名通知',
    projectType: '预推免',
    discipline: '控制科学与工程',
    publishDate: '2026-04-04',
    deadlineDate: '2026-04-14 12:00',
    eventStartDate: '2026-07-03',
    eventEndDate: '2026-07-04',
    applyLink: 'https://www.baoyantongzhi.com/notice',
    sourceLink: 'https://www.baoyantongzhi.com/notice/detail/24766',
    requirements:
      '自动化、机器人、电子信息相关专业优秀学生均可申请，鼓励提前了解导师与研究方向。',
    materialsRequired: ['简历', '成绩单', '排名证明', '导师联系情况说明'],
    examInterviewInfo: '材料审核通过后安排面试，后续事项多通过邮件通知。',
    contactInfo: '以自动化系研究生招生通知为准',
    remarks: '这一类项目适合把“是否联系导师”单独作为待办，不要埋在备注里。',
    tags: ['985', '合肥', '导师联系', '预推免'],
    status: '即将截止',
    year: 2026,
    deadlineLevel: 'within3days',
    sourceSite: '保研通知网',
    collectedAt: '2026-04-11 10:30',
    updatedAt: '2026-04-11 10:30',
    lastCheckedAt: '2026-04-11 10:30',
    isVerified: true,
    changeLog: [{ date: '2026-04-11 10:30', field: '备注', change: '补充导师联系是关键动作。' }],
    historyRecords: [
      { year: 2025, publishDate: '2025-04-02', deadlineDate: '2025-04-13 12:00', summary: '往年同样需要尽快确认导师联系节奏。' }
    ]
  },
  {
    id: 'notice-fudan-econ-2026-formal',
    schoolName: '复旦大学',
    departmentName: '经济学院',
    projectName: '2026 年正式推免预接收通知',
    projectType: '正式推免',
    discipline: '应用经济学',
    publishDate: '2026-04-10',
    deadlineDate: '2026-04-20 17:00',
    eventStartDate: '2026-09-18',
    eventEndDate: '2026-09-21',
    applyLink: 'https://www.baoyantongzhi.com/notice',
    sourceLink: 'https://www.baoyantongzhi.com/notice/detail/24855',
    requirements:
      '欢迎经管相关专业学生申请，要求成绩优秀、英语能力良好，并具备较好的专业基础。',
    materialsRequired: ['简历', '成绩单', '英语成绩', '个人陈述', '获奖证明'],
    examInterviewInfo: '预计以综合面试为主，是否增加笔试以后续通知为准。',
    contactInfo: '建议保存原文链接，后续再核对学院官网',
    remarks: '偏长期跟踪项目，可先入表后分配优先级。',
    tags: ['985', '正式推免', '经管', '英语要求高'],
    status: '报名中',
    year: 2026,
    deadlineLevel: 'future',
    sourceSite: '保研通知网',
    collectedAt: '2026-04-11 10:30',
    updatedAt: '2026-04-11 10:30',
    lastCheckedAt: '2026-04-11 10:30',
    isVerified: false,
    changeLog: [{ date: '2026-04-11 10:30', field: '人工校验', change: '已同步待校验版本。' }],
    historyRecords: [
      { year: 2025, publishDate: '2025-04-08', deadlineDate: '2025-04-21 17:00', summary: '去年正式推免预接收通知节奏基本一致。' }
    ]
  },
  {
    id: 'notice-nju-business-2026-formal',
    schoolName: '南京大学',
    departmentName: '商学院',
    projectName: '2026 年正式推免接收通知',
    projectType: '正式推免',
    discipline: '应用经济学',
    publishDate: '2026-04-07',
    deadlineDate: '2026-04-25 17:00',
    eventStartDate: '2026-09-20',
    eventEndDate: '2026-09-22',
    applyLink: 'https://www.baoyantongzhi.com/notice',
    sourceLink: 'https://www.baoyantongzhi.com/notice/detail/24823',
    requirements:
      '要求具备较好的英语能力和专业基础，欢迎长期规划正式推免的同学提前关注。',
    materialsRequired: ['简历', '成绩单', '英语成绩', '个人陈述'],
    examInterviewInfo: '预计以面试为主，正式安排以后续通知为准。',
    contactInfo: '见原文通知中的学院招生联系方式',
    remarks: '属于相对后周期项目，适合在申请表里做长期跟踪与风险平衡。',
    tags: ['正式推免', '经管', '长期跟踪'],
    status: '报名中',
    year: 2026,
    deadlineLevel: 'future',
    sourceSite: '保研通知网',
    collectedAt: '2026-04-11 10:30',
    updatedAt: '2026-04-11 10:30',
    lastCheckedAt: '2026-04-11 10:30',
    isVerified: false,
    changeLog: [{ date: '2026-04-11 10:30', field: '初次录入', change: '录入正式推免接收通知。' }],
    historyRecords: [
      { year: 2025, publishDate: '2025-04-06', deadlineDate: '2025-04-24 17:00', summary: '往年截止时间同样处于 4 月下旬。' }
    ]
  },
  {
    id: 'notice-whu-cyber-2026-summer',
    schoolName: '武汉大学',
    departmentName: '国家网络安全学院',
    projectName: '2026 年优秀大学生暑期夏令营',
    projectType: '夏令营',
    discipline: '网络空间安全',
    publishDate: '2026-03-30',
    deadlineDate: '2026-04-08 23:59',
    eventStartDate: '2026-05-25',
    eventEndDate: '2026-05-27',
    applyLink: 'https://www.baoyantongzhi.com/notice',
    sourceLink: 'https://www.baoyantongzhi.com/notice/detail/24688',
    requirements:
      '要求网络安全相关背景，欢迎有科研、竞赛或工程经历的学生申请。',
    materialsRequired: ['简历', '成绩单', '竞赛证明', '个人陈述'],
    examInterviewInfo: '项目已截止，可以作为历史节奏和字段拆解参考。',
    contactInfo: '见原文通知',
    remarks: '已截止项目保留在库里，方便学生参考往年发布时间和材料结构。',
    tags: ['网安', '竞赛加分', '已截止'],
    status: '已截止',
    year: 2026,
    deadlineLevel: 'expired',
    sourceSite: '保研通知网',
    collectedAt: '2026-04-11 10:30',
    updatedAt: '2026-04-11 10:30',
    lastCheckedAt: '2026-04-11 10:30',
    isVerified: true,
    changeLog: [{ date: '2026-04-11 10:30', field: '状态', change: '标记为已截止并保留历史参考。' }],
    historyRecords: [
      { year: 2025, publishDate: '2025-03-28', deadlineDate: '2025-04-07 23:59', summary: '往年同样在 4 月上旬截止。' },
      { year: 2024, publishDate: '2024-03-29', deadlineDate: '2024-04-09 23:59', summary: '网安方向持续稳定在 4 月上旬开放。' }
    ]
  }
];

export const sampleUserProjects: UserProjectRecord[] = [
  {
    userProjectId: 'user-demo-pku',
    userId: 'demo-user',
    projectId: 'notice-pku-lsc-2026-summer',
    isFavorited: true,
    myStatus: '准备材料中',
    priorityLevel: '高',
    materialsProgress: 67,
    cvReady: true,
    transcriptReady: true,
    rankingProofReady: true,
    recommendationReady: false,
    personalStatementReady: true,
    contactSupervisorDone: false,
    submittedAt: '',
    interviewTime: '',
    resultStatus: '未出结果',
    myNotes: '今天优先补推荐信，并确认原文里是否需要额外英语证明。',
    customReminderEnabled: true
  },
  {
    userProjectId: 'user-demo-sjtu',
    userId: 'demo-user',
    projectId: 'notice-sjtu-ai-2026-pre',
    isFavorited: true,
    myStatus: '已收藏',
    priorityLevel: '高',
    materialsProgress: 33,
    cvReady: true,
    transcriptReady: false,
    rankingProofReady: false,
    recommendationReady: false,
    personalStatementReady: true,
    contactSupervisorDone: false,
    submittedAt: '',
    interviewTime: '',
    resultStatus: '未出结果',
    myNotes: '还差成绩单、排名证明和推荐信，48 小时内必须推进。',
    customReminderEnabled: true
  },
  {
    userProjectId: 'user-demo-zju',
    userId: 'demo-user',
    projectId: 'notice-zju-cs-2026-summer',
    isFavorited: true,
    myStatus: '已提交',
    priorityLevel: '中',
    materialsProgress: 100,
    cvReady: true,
    transcriptReady: true,
    rankingProofReady: true,
    recommendationReady: true,
    personalStatementReady: true,
    contactSupervisorDone: true,
    submittedAt: '2026-04-10 20:30',
    interviewTime: '2026-04-20 09:00',
    resultStatus: '待确认',
    myNotes: '已提交，等面试安排进一步确认。',
    customReminderEnabled: true
  },
  {
    userProjectId: 'user-demo-ustc',
    userId: 'demo-user',
    projectId: 'notice-ustc-auto-2026-pre',
    isFavorited: true,
    myStatus: '准备材料中',
    priorityLevel: '高',
    materialsProgress: 50,
    cvReady: true,
    transcriptReady: true,
    rankingProofReady: false,
    recommendationReady: false,
    personalStatementReady: true,
    contactSupervisorDone: false,
    submittedAt: '',
    interviewTime: '',
    resultStatus: '未出结果',
    myNotes: '导师联系还没做，建议今晚先发第一封邮件。',
    customReminderEnabled: true
  }
];

export const fieldGuideItems: FieldGuideItem[] = [
  {
    key: 'school_name',
    label: '学校名称',
    category: '公共项目字段',
    description: '项目所属学校，是所有筛选与统计的第一层维度。',
    example: '北京大学'
  },
  {
    key: 'department_name',
    label: '学院 / 系 / 实验室',
    category: '公共项目字段',
    description: '尽量定位到学院、中心或实验室层级，避免同校不同项目混淆。',
    example: '生命科学联合中心（北大方面）'
  },
  {
    key: 'project_type',
    label: '项目类型',
    category: '公共项目字段',
    description: '统一使用夏令营、预推免、正式推免三类口径。',
    example: '预推免'
  },
  {
    key: 'discipline',
    label: '学科方向',
    category: '公共项目字段',
    description: '用于快速筛掉不相关项目，也方便后续做方向聚合。',
    example: '人工智能'
  },
  {
    key: 'deadline_date',
    label: '截止时间',
    category: '公共项目字段',
    description: '建议精确到日和时分，这样网站才能做 7 天、3 天、当天提醒。',
    example: '2026-04-13 18:00'
  },
  {
    key: 'materials_required',
    label: '材料要求',
    category: '公共项目字段',
    description: '把原通知里的材料要求拆成列表，便于学生逐项勾选完成。',
    example: '简历、成绩单、推荐信、个人陈述'
  },
  {
    key: 'apply_link',
    label: '原文链接',
    category: '公共项目字段',
    description: '无论网站怎么结构化，最终都要保留原始官方入口，避免信息失真。',
    example: 'https://mp.weixin.qq.com/...'
  },
  {
    key: 'my_status',
    label: '我的状态',
    category: '个人申请字段',
    description: '记录你当前对这个项目的推进阶段，替代原来 Excel 里的手填状态列。',
    example: '准备材料中'
  },
  {
    key: 'priority_level',
    label: '优先级',
    category: '个人申请字段',
    description: '用高、中、低表达当周处理顺序，避免所有项目一起堆着看。',
    example: '高'
  },
  {
    key: 'materials_progress',
    label: '材料完成度',
    category: '个人申请字段',
    description: '系统根据材料勾选自动汇总为百分比，方便生成待办。',
    example: '67%'
  },
  {
    key: 'recommendation_ready',
    label: '推荐信是否完成',
    category: '个人申请字段',
    description: '推荐信往往最容易拖延，拆成单独字段后提醒会更准确。',
    example: 'false'
  },
  {
    key: 'contact_supervisor_done',
    label: '是否联系导师',
    category: '个人申请字段',
    description: '对于强调导师联系的项目，单独做成字段比塞进备注更有用。',
    example: 'true'
  },
  {
    key: 'my_notes',
    label: '个人备注',
    category: '个人申请字段',
    description: '记录导师反馈、提交感受、面试安排和个人判断。',
    example: '周二前催老师出推荐信'
  },
  {
    key: 'is_verified',
    label: '是否人工校验',
    category: '系统字段',
    description: '告诉学生这条通知是否已经经过人工复核。',
    example: 'true'
  },
  {
    key: 'last_checked_at',
    label: '最近核验时间',
    category: '系统字段',
    description: '显示平台最近一次复查这条通知的时间。',
    example: '2026-04-11 10:30'
  },
  {
    key: 'change_log',
    label: '变更记录',
    category: '系统字段',
    description: '记录截止时间、材料要求、活动时间等变化，方便学生判断是否需要补操作。',
    example: '补充科研经历说明字段'
  }
];

export const allSchoolOptions = ['全部学校', ...Array.from(new Set(noticeProjects.map((item) => item.schoolName)))];

export const allDisciplineOptions = ['全部方向', ...Array.from(new Set(noticeProjects.map((item) => item.discipline)))];

export const allTagOptions = ['全部标签', ...Array.from(new Set(noticeProjects.flatMap((item) => item.tags)))];

```

## lib/notice-source.ts

```ts
import generatedNoticeProjects from '@/data/baoyantongzhi-notices-2026.json';
import { noticeProjects, type PublicNoticeProject } from '@/lib/mock-data';

const generatedProjects = (generatedNoticeProjects as PublicNoticeProject[]).filter(Boolean);

export const baseNoticeProjects: PublicNoticeProject[] = generatedProjects.length ? generatedProjects : noticeProjects;

export function inferSchoolRange(project: Pick<PublicNoticeProject, 'tags'>) {
  const tags = project.tags || [];
  if (tags.includes('985')) return '985';
  if (tags.includes('211')) return '211';
  if (tags.includes('双一流')) return '双一流';
  return '其他';
}

export function inferDisciplineCategory(discipline: string) {
  const value = discipline || '';

  if (/(生命|生物|医学|药学|公共卫生|护理|口腔|健康)/.test(value)) return '生命医学';
  if (/(经济|金融|管理|工商|会计|统计|经管|市场)/.test(value)) return '经管';
  if (/(法学|政治|社会|教育|中文|历史|哲学|新闻|外语|国际关系|马克思)/.test(value)) return '人文社科';
  if (/(数学|物理|化学|地理|地球|天文|理学)/.test(value)) return '理学';
  if (/(计算机|人工智能|软件|网安|电子|信息|通信|自动化|控制|机械|材料|化工|工程|建筑|土木|能源|航空|仪器)/.test(value)) {
    return '工学';
  }

  return '交叉其他';
}

```

## lib/portal-data.ts

```ts
export type PortalLink = {
  title: string;
  description: string;
  href: string;
  badge: string;
  external?: boolean;
};

export type ResourceSection = {
  title: string;
  description: string;
  links: PortalLink[];
};

export type FeaturedCollege = {
  name: string;
  city: string;
  level: string[];
  focus: string;
  website: string;
  domain: string;
};

export type OfferFeedItem = {
  id: string;
  author: string;
  avatar: string;
  verified: boolean;
  time: string;
  giveUp: string;
  goTo: string;
  message: string;
  tags: string[];
  likes: number;
};

export const homePortalCards: PortalLink[] = [
  {
    title: '通知库',
    description: '查看完整保研通知列表，按发布时间或截止时间快速筛选和排序。',
    href: '/notices',
    badge: '核心入口'
  },
  {
    title: '资源库',
    description: '集中放官方入口、学术检索与效率工具，减少来回搜索的时间成本。',
    href: '/resources',
    badge: '高频资源'
  },
  {
    title: '院校库',
    description: '按院校目录快速直达学校官网，优先收录 985 / 211 / 双一流院校。',
    href: '/colleges',
    badge: '学校官网'
  },
  {
    title: 'Offer 池',
    description: '查看真实释放 Offer 与候补动态，辅助判断补录窗口和流动节奏。',
    href: '/offers',
    badge: '候补动态'
  },
  {
    title: 'AI 定位',
    description: '当前先作为待完善能力入口，后续再接院校定位和材料建议。',
    href: '/ai',
    badge: '规划中'
  },
  {
    title: '研招网',
    description: '保留官方入口，随时回到权威站点交叉核对政策和招生信息。',
    href: 'https://yz.chsi.com.cn/',
    badge: '官方',
    external: true
  }
];

export const officialResourceSections: ResourceSection[] = [
  {
    title: '官方入口',
    description: '优先放真正高频、真正权威、适合长期回访的官方网站。',
    links: [
      {
        title: '中国研究生招生信息网',
        description: '查院校库、专业目录、网报公告和硕士招生政策。',
        href: 'https://yz.chsi.com.cn/',
        badge: '官方',
        external: true
      },
      {
        title: '学信网',
        description: '学历学籍、在线验证报告和信息核验常用入口。',
        href: 'https://www.chsi.com.cn/',
        badge: '官方',
        external: true
      },
      {
        title: '教育部',
        description: '查看最新政策、通知公告和高教信息。',
        href: 'http://www.moe.gov.cn/',
        badge: '政策',
        external: true
      },
      {
        title: '中国科学院',
        description: '跟进研究所动态、招生公告和科研机构入口。',
        href: 'https://www.cas.cn/',
        badge: '科研机构',
        external: true
      }
    ]
  },
  {
    title: '学术检索',
    description: '做套磁、写文书、准备面试材料时，最常回访的是论文与科研平台。',
    links: [
      {
        title: '中国知网',
        description: '检索中文论文、学位论文和期刊文章。',
        href: 'https://www.cnki.net/',
        badge: '论文',
        external: true
      },
      {
        title: '万方数据',
        description: '补充中文检索渠道，适合交叉查找综述和学位论文。',
        href: 'https://www.wanfangdata.com.cn/',
        badge: '数据库',
        external: true
      },
      {
        title: 'Web of Science',
        description: '英文论文与引用网络检索。',
        href: 'https://www.webofscience.com/',
        badge: '英文检索',
        external: true
      },
      {
        title: 'ResearchGate',
        description: '快速查看导师与课题组公开科研动态。',
        href: 'https://www.researchgate.net/',
        badge: '科研画像',
        external: true
      }
    ]
  },
  {
    title: '效率工具',
    description: '把写文书、翻译、排版和知识整理工具集中起来，方便保研周期反复使用。',
    links: [
      {
        title: 'Overleaf',
        description: '适合论文、简历和学术材料的在线 LaTeX 编辑。',
        href: 'https://www.overleaf.com/',
        badge: '排版',
        external: true
      },
      {
        title: 'DeepL',
        description: '翻译文书、论文摘要和英文邮件更顺手。',
        href: 'https://www.deepl.com/',
        badge: '翻译',
        external: true
      },
      {
        title: 'Notion',
        description: '管理申请进度、面试题库和任务清单。',
        href: 'https://www.notion.so/',
        badge: '规划',
        external: true
      },
      {
        title: 'Obsidian',
        description: '沉淀个人知识库、院校笔记和导师调研结果。',
        href: 'https://obsidian.md/',
        badge: '知识库',
        external: true
      }
    ]
  }
];

export const collegeDirectory: FeaturedCollege[] = [
  {
    name: '清华大学',
    city: '北京',
    level: ['985', '211', '双一流'],
    focus: '工科、理科与交叉信息方向关注度高，适合作为官网总入口保留在目录前列。',
    website: 'https://www.tsinghua.edu.cn/',
    domain: 'tsinghua.edu.cn'
  },
  {
    name: '北京大学',
    city: '北京',
    level: ['985', '211', '双一流'],
    focus: '综合学科覆盖广，官网入口适合做全校学院与通知的总导航。',
    website: 'https://www.pku.edu.cn/',
    domain: 'pku.edu.cn'
  },
  {
    name: '复旦大学',
    city: '上海',
    level: ['985', '211', '双一流'],
    focus: '文理医工兼具，适合作为跨院系检索的起点。',
    website: 'https://www.fudan.edu.cn/',
    domain: 'fudan.edu.cn'
  },
  {
    name: '上海交通大学',
    city: '上海',
    level: ['985', '211', '双一流'],
    focus: '电院、计算机与人工智能方向热度高，学校官网适合作为统一入口。',
    website: 'https://www.sjtu.edu.cn/',
    domain: 'sjtu.edu.cn'
  },
  {
    name: '浙江大学',
    city: '杭州',
    level: ['985', '211', '双一流'],
    focus: '计算机、控制、医工交叉等方向关注度高，官网入口长期高频。',
    website: 'https://www.zju.edu.cn/',
    domain: 'zju.edu.cn'
  },
  {
    name: '南京大学',
    city: '南京',
    level: ['985', '211', '双一流'],
    focus: '理学、人文与计算机方向都很活跃，官网适合作为学院导航总入口。',
    website: 'https://www.nju.edu.cn/',
    domain: 'nju.edu.cn'
  },
  {
    name: '中国科学技术大学',
    city: '合肥',
    level: ['985', '211', '双一流'],
    focus: '理工和科研导向项目强，适合用官网入口统一回访学校动态。',
    website: 'https://www.ustc.edu.cn/',
    domain: 'ustc.edu.cn'
  },
  {
    name: '武汉大学',
    city: '武汉',
    level: ['985', '211', '双一流'],
    focus: '综合门类完整，适合从学校官网进入学院和研究生招生系统。',
    website: 'https://www.whu.edu.cn/',
    domain: 'whu.edu.cn'
  },
  {
    name: '华中科技大学',
    city: '武汉',
    level: ['985', '211', '双一流'],
    focus: '工科与医学方向强势，学校官网适合做长期入口。',
    website: 'https://www.hust.edu.cn/',
    domain: 'hust.edu.cn'
  },
  {
    name: '哈尔滨工业大学',
    city: '哈尔滨',
    level: ['985', '211', '双一流'],
    focus: '工科强校，官网适合快速进入院系与科研平台。',
    website: 'https://www.hit.edu.cn/',
    domain: 'hit.edu.cn'
  },
  {
    name: '北京航空航天大学',
    city: '北京',
    level: ['985', '211', '双一流'],
    focus: '航空航天、计算机、自动化方向热度高，适合高频回访。',
    website: 'https://www.buaa.edu.cn/',
    domain: 'buaa.edu.cn'
  },
  {
    name: '同济大学',
    city: '上海',
    level: ['985', '211', '双一流'],
    focus: '工科、建筑与经管交叉方向关注度持续较高。',
    website: 'https://www.tongji.edu.cn/',
    domain: 'tongji.edu.cn'
  },
  {
    name: '西安交通大学',
    city: '西安',
    level: ['985', '211', '双一流'],
    focus: '工科和能动方向突出，学校官网适合做全校通知总入口。',
    website: 'https://www.xjtu.edu.cn/',
    domain: 'xjtu.edu.cn'
  },
  {
    name: '中山大学',
    city: '广州',
    level: ['985', '211', '双一流'],
    focus: '医科、理科与经管方向布局完整，官网直达价值高。',
    website: 'https://www.sysu.edu.cn/',
    domain: 'sysu.edu.cn'
  },
  {
    name: '厦门大学',
    city: '厦门',
    level: ['985', '211', '双一流'],
    focus: '经管、化学与海洋方向关注度高，官网适合作为统一入口。',
    website: 'https://www.xmu.edu.cn/',
    domain: 'xmu.edu.cn'
  },
  {
    name: '四川大学',
    city: '成都',
    level: ['985', '211', '双一流'],
    focus: '综合门类大而全，学校官网适合作为院系导航入口。',
    website: 'https://www.scu.edu.cn/',
    domain: 'scu.edu.cn'
  },
  {
    name: '天津大学',
    city: '天津',
    level: ['985', '211', '双一流'],
    focus: '传统工科强势，官网适合快速查找学院与招生页。',
    website: 'https://www.tju.edu.cn/',
    domain: 'tju.edu.cn'
  },
  {
    name: '东南大学',
    city: '南京',
    level: ['985', '211', '双一流'],
    focus: '电子信息、建筑、自动化方向高频关注。',
    website: 'https://www.seu.edu.cn/',
    domain: 'seu.edu.cn'
  },
  {
    name: '华南理工大学',
    city: '广州',
    level: ['985', '211', '双一流'],
    focus: '工科与经管方向兼具，适合纳入官网目录。',
    website: 'https://www.scut.edu.cn/',
    domain: 'scut.edu.cn'
  },
  {
    name: '吉林大学',
    city: '长春',
    level: ['985', '211', '双一流'],
    focus: '综合门类广，官网入口适合统一回看学校层面通知。',
    website: 'https://www.jlu.edu.cn/',
    domain: 'jlu.edu.cn'
  },
  {
    name: '山东大学',
    city: '济南',
    level: ['985', '211', '双一流'],
    focus: '综合学科完整，适合保留为常用官网入口。',
    website: 'https://www.sdu.edu.cn/',
    domain: 'sdu.edu.cn'
  },
  {
    name: '兰州大学',
    city: '兰州',
    level: ['985', '211', '双一流'],
    focus: '理科和基础学科特色鲜明，官网入口便于查找全校信息。',
    website: 'https://www.lzu.edu.cn/',
    domain: 'lzu.edu.cn'
  },
  {
    name: '重庆大学',
    city: '重庆',
    level: ['985', '211', '双一流'],
    focus: '工科与建筑方向稳定热门，学校官网作为统一入口更清晰。',
    website: 'https://www.cqu.edu.cn/',
    domain: 'cqu.edu.cn'
  },
  {
    name: '大连理工大学',
    city: '大连',
    level: ['985', '211', '双一流'],
    focus: '工科方向关注度高，官网入口适合作为院系导航总入口。',
    website: 'https://www.dlut.edu.cn/',
    domain: 'dlut.edu.cn'
  }
];

export const offerMetrics = [
  { label: '今日新增释放 Offer', value: '38', hint: '便于追踪候补流动' },
  { label: '活跃院校', value: '112', hint: '覆盖主流工科与理科方向' },
  { label: '高频关键词', value: '清华 / 上交 / 浙大', hint: '适合电脑端持续检索' }
];

export const hotKeywords = ['清华', '上交', '浙大', '计算机', '电院', '预推免'];

export const offerFeedItems: OfferFeedItem[] = [
  {
    id: 'offer-1',
    author: '小鹿同学',
    avatar: '鹿',
    verified: true,
    time: '2 分钟前',
    giveUp: '复旦大学 · 软件工程',
    goTo: '上海交通大学 · 电院',
    message: '老师确认今天还会继续顺延，候补同学注意电话、短信和系统通知。',
    tags: ['985', '上海', '电子信息'],
    likes: 128
  },
  {
    id: 'offer-2',
    author: 'AI 冲刺党',
    avatar: 'A',
    verified: true,
    time: '18 分钟前',
    giveUp: '中国科学技术大学 · 自动化',
    goTo: '清华大学 · 电子系',
    message: '我这边已经正式放弃该 offer，老师说今晚前会补录，大家及时查邮件。',
    tags: ['顶尖院校', '自动化', '候补补录'],
    likes: 94
  },
  {
    id: 'offer-3',
    author: '保研打工人',
    avatar: '保',
    verified: false,
    time: '1 小时前',
    giveUp: '武汉大学 · 网安',
    goTo: '浙江大学 · 计算机',
    message: '刚刚电话确认不去，后面应该会继续往下放，祝后面的同学接好运。',
    tags: ['网安', '浙大', '电话确认'],
    likes: 57
  }
];

```

## lib/user-session.ts

```ts
'use client';

export type UserProfile = {
  nickname: string;
  age: string;
  undergraduateSchool: string;
  major: string;
  grade: string;
  targetMajor: string;
  targetRegion: string;
};

export type UserSession = {
  loggedIn: boolean;
  authProvider: 'wechat';
  profile: UserProfile;
};

const SESSION_STORAGE_KEY = 'seekoffer-user-session';
const SESSION_EVENT_NAME = 'seekoffer-user-session-updated';

const defaultProfile: UserProfile = {
  nickname: '微信用户',
  age: '',
  undergraduateSchool: '',
  major: '',
  grade: '大四',
  targetMajor: '',
  targetRegion: ''
};

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function emitSessionUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_EVENT_NAME));
  }
}

export function getUserSession(): UserSession | null {
  if (!canUseBrowserStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<UserSession>;
    if (!parsed || !parsed.loggedIn) {
      return null;
    }

    return {
      loggedIn: true,
      authProvider: 'wechat',
      profile: {
        ...defaultProfile,
        ...(parsed.profile || {})
      }
    };
  } catch {
    return null;
  }
}

function writeUserSession(session: UserSession | null) {
  if (!canUseBrowserStorage()) {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } else {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  emitSessionUpdate();
}

export function signInWithWechatDemo() {
  const current = getUserSession();
  const session: UserSession = {
    loggedIn: true,
    authProvider: 'wechat',
    profile: {
      ...defaultProfile,
      ...(current?.profile || {})
    }
  };

  writeUserSession(session);
  return session;
}

export function signOutUser() {
  writeUserSession(null);
}

export function updateUserProfile(patch: Partial<UserProfile>) {
  const current = getUserSession();
  if (!current) {
    return null;
  }

  const next: UserSession = {
    ...current,
    profile: {
      ...current.profile,
      ...patch
    }
  };

  writeUserSession(next);
  return next;
}

export function watchUserSession(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handler = () => callback();
  window.addEventListener(SESSION_EVENT_NAME, handler);
  window.addEventListener('storage', handler);

  return () => {
    window.removeEventListener(SESSION_EVENT_NAME, handler);
    window.removeEventListener('storage', handler);
  };
}

```

