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

export function generateStaticParams() {
  return baseNoticeProjects.map((item) => ({
    id: item.id
  }));
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
    <SiteShell>
      <PageSectionTitle
        eyebrow="Project Detail"
        title={`${project.schoolName} · ${project.projectName}`}
        subtitle="查看项目详情、截止时间、材料要求与原文入口，并可一键加入我的申请表。"
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
