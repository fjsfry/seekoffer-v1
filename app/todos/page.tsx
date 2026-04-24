'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BellRing, CalendarClock, CircleAlert } from 'lucide-react';
import { LoginRequiredCard } from '@/components/login-required-card';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { useUserSessionState } from '@/hooks/use-user-session';
import { fetchApplicationRows, watchApplicationTable, type ApplicationRow } from '@/lib/cloudbase-data';
import { buildNoticeDetailHref } from '@/lib/notice-links';

type TodoBlock = {
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

export default function TodosPage() {
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const { ready, loggedIn } = useUserSessionState();

  useEffect(() => {
    if (!loggedIn) {
      return () => undefined;
    }

    let active = true;

    const load = async () => {
      const merged = await fetchApplicationRows();
      if (active) {
        setRows(merged);
      }
    };

    void load();
    const dispose = watchApplicationTable(load);

    return () => {
      active = false;
      dispose();
    };
  }, [loggedIn]);

  const sections = useMemo<TodoBlock[]>(() => {
    const today = rows
      .filter(
        ({ item, project }) =>
          project.deadlineLevel === 'today' ||
          (Boolean(item.interviewTime) && item.interviewTime.startsWith(new Date().toISOString().slice(0, 10)))
      )
      .slice(0, 5)
      .map(({ item, project }) => ({
        id: `${item.userProjectId}-today`,
        title: `${project.schoolName} · ${project.projectName}`,
        description:
          project.deadlineLevel === 'today'
            ? `今天截止，当前状态是“${item.myStatus}”，请优先完成提交或确认动作。`
            : `今天有面试或确认安排：${item.interviewTime}。`,
        href: project.sourceSite === '用户手动录入' ? '/applications#manual-entry' : buildNoticeDetailHref(project.id)
      }));

    const thisWeek = rows
      .filter(
        ({ item, project }) =>
          project.deadlineLevel === 'within3days' ||
          project.deadlineLevel === 'within7days' ||
          item.resultStatus === '待确认'
      )
      .slice(0, 6)
      .map(({ item, project }) => ({
        id: `${item.userProjectId}-week`,
        title: `${project.schoolName} · ${project.projectName}`,
        description:
          item.resultStatus === '待确认'
            ? '项目已进入待确认阶段，请尽快处理后续动作。'
            : `本周有明确时间风险，截止时间是 ${project.deadlineDate}。`,
        href: project.sourceSite === '用户手动录入' ? '/applications#manual-entry' : buildNoticeDetailHref(project.id)
      }));

    const later = rows
      .filter(
        ({ item, project }) =>
          item.materialsProgress < 100 &&
          project.deadlineLevel !== 'today' &&
          project.deadlineLevel !== 'within3days'
      )
      .slice(0, 6)
      .map(({ item, project }) => ({
        id: `${item.userProjectId}-later`,
        title: `${project.schoolName} · 材料待补齐`,
        description: `当前材料完成度 ${item.materialsProgress}%，建议提前补齐简历、成绩单与推荐信。`,
        href: '/applications'
      }));

    return [
      {
        title: '今天必须处理',
        subtitle: '先看今天就会出风险的项目，比如今日截止、当天面试或当天确认。',
        tone: 'bg-rose-50 text-rose-700',
        items: today
      },
      {
        title: '本周要完成',
        subtitle: '把 7 天内有时间风险的项目集中起来，避免拖到最后一天。',
        tone: 'bg-amber-50 text-amber-700',
        items: thisWeek
      },
      {
        title: '可以稍后处理',
        subtitle: '这些项目暂时还没到最后关头，但材料和调研最好提前补齐。',
        tone: 'bg-emerald-50 text-emerald-700',
        items: later
      }
    ];
  }, [rows]);

  if (!ready) {
    return (
      <SiteShell>
        <PageSectionTitle
          eyebrow="My Todos"
          title="我的待办"
          subtitle="登录后系统会根据申请表自动生成优先级清单，帮你先处理今天和本周最该做的事。"
        />
        <LoginRequiredCard
          title="我的待办需要先登录"
          description="登录后系统会根据截止时间、材料进度、面试安排和结果状态自动生成行动清单。"
        />
      </SiteShell>
    );
  }

  if (!loggedIn) {
    return (
      <SiteShell>
        <PageSectionTitle
          eyebrow="My Todos"
          title="我的待办"
          subtitle="登录后系统会根据申请表自动生成优先级清单，帮你先处理今天和本周最该做的事。"
        />
        <LoginRequiredCard
          title="我的待办需要先登录"
          description="登录后系统会根据截止时间、材料进度、面试安排和结果状态自动生成行动清单。"
        />
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <PageSectionTitle
        eyebrow="My Todos"
        title="我的待办"
        subtitle="优先级不是靠感觉，而是由截止时间、面试安排、材料进度和确认节点一起决定。"
      />

      <section className="grid gap-6 lg:grid-cols-3">
        {sections.map((section) => (
          <div key={section.title} className="surface-card rounded-[34px] p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${section.tone}`}>{section.title}</span>
                <p className="mt-4 text-sm leading-7 text-slate-600">{section.subtitle}</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                {section.items.length}
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {section.items.length ? (
                section.items.map((item) => (
                  <Link key={item.id} href={item.href} className="rounded-[24px] bg-slate-50 px-4 py-4 transition hover:bg-slate-100">
                    <div className="text-sm font-semibold text-ink">{item.title}</div>
                    <div className="mt-2 text-sm leading-7 text-slate-500">{item.description}</div>
                  </Link>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-black/10 px-4 py-8 text-sm text-slate-500">
                  当前没有这一层级的待办，说明这一段时间的节奏还比较可控。
                </div>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="surface-card rounded-[34px] p-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: BellRing,
              title: '提醒逻辑',
              text: '根据今日截止、3 天内截止和 7 天内截止自动抬高优先级。'
            },
            {
              icon: CalendarClock,
              title: '节奏逻辑',
              text: '把面试、确认、提交这些真正影响结果的节点聚到同一个列表。'
            },
            {
              icon: CircleAlert,
              title: '材料逻辑',
              text: '只要材料未补齐，就会持续出现在“可以稍后处理”中提醒你提前推进。'
            }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-[28px] bg-slate-50 px-5 py-5">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                  <Icon className="h-4 w-4" />
                  {item.title}
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.text}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-6">
          <Link
            href="/applications"
            className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white"
          >
            去调整申请表
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
