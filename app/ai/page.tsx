'use client';

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  FileText,
  Flag,
  Layers3,
  LoaderCircle,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  UserRoundCheck
} from 'lucide-react';
import { ApplicationActionButton } from '@/components/application-action-button';
import { SiteShell } from '@/components/site-shell';
import { useUserSessionState } from '@/hooks/use-user-session';
import {
  fetchApplicationRows,
  fetchPublicNotices,
  readStoredAiPositioningReport,
  saveAiPositioningReport,
  submitAiWaitlistLead,
  type AiWaitlistNeed,
  type ApplicationRow
} from '@/lib/cloudbase-data';
import {
  buildAiPositioningReport,
  createDefaultAiPositioningInput,
  type AiActionItem,
  type AiMaterialGap,
  type AiPositioningInput,
  type AiPositioningReport,
  type AiProjectTier,
  type AiRecommendedProject
} from '@/lib/ai-positioning';
import { materialChecklistDefinitions, type ProjectType, type PublicNoticeProject } from '@/lib/mock-data';
import { formatNoticeDateOnly, getDisplayNoticeDepartment, getDisplaySchoolName, normalizeNoticeTitle } from '@/lib/notice-display';
import { buildNoticeDetailHref } from '@/lib/notice-links';

const projectTypeChoices: ProjectType[] = ['夏令营', '预推免', '正式推免'];
const needOptions: AiWaitlistNeed[] = ['申请风险评估', '材料短板提示', '提炼简章要求'];
const inputClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brand/40 focus:ring-4 focus:ring-brand/8';

export default function AiPage() {
  const { ready, loggedIn, session } = useUserSessionState();
  const [input, setInput] = useState<AiPositioningInput>(() => createDefaultAiPositioningInput());
  const [loadedProfileKey, setLoadedProfileKey] = useState('');
  const [publicProjects, setPublicProjects] = useState<PublicNoticeProject[]>([]);
  const [applicationRows, setApplicationRows] = useState<ApplicationRow[]>([]);
  const [report, setReport] = useState<AiPositioningReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [wechatId, setWechatId] = useState('');
  const [primaryNeed, setPrimaryNeed] = useState<AiWaitlistNeed>('申请风险评估');
  const [feedbackDetails, setFeedbackDetails] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  useEffect(() => {
    const profileKey = session?.userId || session?.email || session?.phone || 'guest';
    if (!ready || loadedProfileKey === profileKey) {
      return;
    }

    const profileInput = createDefaultAiPositioningInput(session?.profile);
    let active = true;
    queueMicrotask(() => {
      if (!active) {
        return;
      }

      setInput((current) => ({
        ...current,
        undergraduateSchool: current.undergraduateSchool || profileInput.undergraduateSchool,
        major: current.major || profileInput.major,
        grade: current.grade || profileInput.grade,
        targetMajor: current.targetMajor || profileInput.targetMajor,
        targetRegion: current.targetRegion || profileInput.targetRegion
      }));
      setLoadedProfileKey(profileKey);
    });

    return () => {
      active = false;
    };
  }, [loadedProfileKey, ready, session]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      const [projectsResult, rowsResult] = await Promise.allSettled([
        fetchPublicNotices(),
        loggedIn ? fetchApplicationRows() : Promise.resolve([] as ApplicationRow[])
      ]);

      if (!active) {
        return;
      }

      setPublicProjects(projectsResult.status === 'fulfilled' ? projectsResult.value : []);
      setApplicationRows(rowsResult.status === 'fulfilled' ? rowsResult.value : []);
      setReport((current) => current || readStoredAiPositioningReport());
      setLoading(false);
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [loggedIn]);

  const materialSnapshot = useMemo(() => getMaterialSnapshot(applicationRows), [applicationRows]);
  const highPriorityActions = report?.actionItems.filter((item) => item.priority === 'high').length || 0;

  function updateInput<Key extends keyof AiPositioningInput>(key: Key, value: AiPositioningInput[Key]) {
    setInput((current) => ({
      ...current,
      [key]: value
    }));
  }

  function syncProfile() {
    setInput((current) => ({
      ...current,
      ...createDefaultAiPositioningInput(session?.profile),
      gpa: current.gpa,
      rankPercent: current.rankPercent,
      englishLevel: current.englishLevel,
      researchExperience: current.researchExperience,
      paperExperience: current.paperExperience,
      competitionExperience: current.competitionExperience,
      preferredProjectTypes: current.preferredProjectTypes,
      targetSchoolKeywords: current.targetSchoolKeywords,
      notes: current.notes
    }));
    setMessage('已带入你填写过的基础信息，可以继续补充成绩、科研和目标偏好。');
  }

  function toggleProjectType(type: ProjectType) {
    setInput((current) => {
      const exists = current.preferredProjectTypes.includes(type);
      const preferredProjectTypes = exists
        ? current.preferredProjectTypes.filter((item) => item !== type)
        : [...current.preferredProjectTypes, type];

      return {
        ...current,
        preferredProjectTypes
      };
    });
  }

  async function handleGenerate() {
    setGenerating(true);
    setMessage('');

    try {
      const nextReport = buildAiPositioningReport(input, publicProjects, applicationRows);
      setReport(nextReport);
      await saveAiPositioningReport(nextReport, input);
      setMessage('定位方案已更新。建议先看申请组合，再处理高优先级材料。');
    } finally {
      setGenerating(false);
    }
  }

  async function handleFeedbackSubmit() {
    if (!wechatId.trim()) {
      setFeedbackMessage('请先留下微信号，方便后续回访。');
      return;
    }

    setFeedbackSubmitting(true);
    setFeedbackMessage('');

    try {
      const result = await submitAiWaitlistLead({
        wechatId,
        primaryNeed,
        details: feedbackDetails || report?.summary || ''
      });

      setFeedbackMessage(result.ok ? '已收到你的复盘需求，我们会优先围绕你选择的问题看。' : '已记录你的复盘需求。');
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  return (
    <SiteShell>
      <section className="page-hero grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center lg:px-8">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">AI 申请定位助手</h1>
          <p className="mt-4 text-base leading-8 text-slate-600">
            把背景、目标和材料进度整理成一份可执行的申请方案，帮你判断冲刺、稳妥和保底项目怎么排，本周先推进什么。
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-4 text-sm font-semibold text-white shadow-float transition hover:-translate-y-0.5 hover:bg-brand-deep disabled:opacity-60"
        >
          {generating ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <BrainCircuit className="h-5 w-5" />}
          {generating ? '生成中...' : '生成方案'}
        </button>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="可选项目" value={loading ? '...' : publicProjects.length.toString()} hint="从近期通知里筛选" icon={Search} tone="brand" />
        <MetricCard label="已跟进" value={loading ? '...' : applicationRows.length.toString()} hint={loggedIn ? '来自你的申请清单' : '登录后纳入判断'} icon={ClipboardList} tone="green" />
        <MetricCard label="准备度" value={report ? `${report.readinessScore}` : '--'} hint={report ? report.applicantBand : '生成后显示'} icon={BarChart3} tone="blue" />
        <MetricCard label="优先事项" value={report ? highPriorityActions.toString() : '--'} hint="先处理最影响结果的事" icon={ShieldAlert} tone="orange" />
      </section>

      {message ? (
        <section className="rounded-[28px] border border-brand/15 bg-white/86 px-5 py-4 text-sm text-brand shadow-sm backdrop-blur">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="leading-7">{message}</div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-[30px] border border-black/5 bg-white/96 shadow-soft backdrop-blur">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <SectionHeading icon={SlidersHorizontal} eyebrow="定位输入" title="背景与目标" />
              {session?.profile ? (
                <button
                  type="button"
                  onClick={syncProfile}
                  className="inline-flex items-center gap-2 rounded-2xl border border-brand/25 bg-white px-3 py-2 text-xs font-semibold text-brand shadow-sm"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  带入档案
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-6 px-6 py-6">
            <div className="rounded-2xl bg-brand/5 px-4 py-3 text-sm leading-7 text-slate-600">
              不需要一次填满。优先补排名、语言成绩、科研经历和目标方向，结果会更贴近真实申请策略。
            </div>

            <InputGroup title="基础背景" icon={UserRoundCheck}>
              <Field label="本科院校">
                <input
                  value={input.undergraduateSchool}
                  onChange={(event) => updateInput('undergraduateSchool', event.target.value)}
                  placeholder="例如 华东师范大学 / 211 / 双一流"
                  className={inputClassName}
                />
              </Field>
              <Field label="本科专业">
                <input
                  value={input.major}
                  onChange={(event) => updateInput('major', event.target.value)}
                  placeholder="例如 计算机科学与技术"
                  className={inputClassName}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="GPA / 均分">
                  <input
                    value={input.gpa}
                    onChange={(event) => updateInput('gpa', event.target.value)}
                    placeholder="3.7/4 或 88"
                    className={inputClassName}
                  />
                </Field>
                <Field label="专业排名">
                  <input
                    value={input.rankPercent}
                    onChange={(event) => updateInput('rankPercent', event.target.value)}
                    placeholder="前 10%"
                    className={inputClassName}
                  />
                </Field>
              </div>
            </InputGroup>

            <InputGroup title="目标偏好" icon={Target}>
              <Field label="目标方向">
                <input
                  value={input.targetMajor}
                  onChange={(event) => updateInput('targetMajor', event.target.value)}
                  placeholder="例如 人工智能 / 金融科技 / 生物医学"
                  className={inputClassName}
                />
              </Field>
              <Field label="目标地区">
                <input
                  value={input.targetRegion}
                  onChange={(event) => updateInput('targetRegion', event.target.value)}
                  placeholder="例如 北京 / 上海 / 长三角"
                  className={inputClassName}
                />
              </Field>
              <Field label="项目类型">
                <div className="grid grid-cols-3 gap-2">
                  {projectTypeChoices.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleProjectType(type)}
                      className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${
                        input.preferredProjectTypes.includes(type)
                          ? 'border-brand bg-brand-cream text-brand'
                          : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="目标院校关键词">
                <input
                  value={input.targetSchoolKeywords}
                  onChange={(event) => updateInput('targetSchoolKeywords', event.target.value)}
                  placeholder="例如 复旦、上交、浙大"
                  className={inputClassName}
                />
              </Field>
            </InputGroup>

            <InputGroup title="经历材料" icon={BookOpenCheck}>
              <Field label="英语 / 语言成绩">
                <input
                  value={input.englishLevel}
                  onChange={(event) => updateInput('englishLevel', event.target.value)}
                  placeholder="例如 六级 560 / 雅思 7.0"
                  className={inputClassName}
                />
              </Field>
              <Field label="科研经历">
                <textarea
                  rows={3}
                  value={input.researchExperience}
                  onChange={(event) => updateInput('researchExperience', event.target.value)}
                  placeholder="实验室、课程项目、毕业设计或实习研究经历"
                  className={`${inputClassName} resize-none`}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="论文 / 专利">
                  <input
                    value={input.paperExperience}
                    onChange={(event) => updateInput('paperExperience', event.target.value)}
                    placeholder="没有可留空"
                    className={inputClassName}
                  />
                </Field>
                <Field label="竞赛 / 奖项">
                  <input
                    value={input.competitionExperience}
                    onChange={(event) => updateInput('competitionExperience', event.target.value)}
                    placeholder="国奖 / 竞赛 / 奖学金"
                    className={inputClassName}
                  />
                </Field>
              </div>
            </InputGroup>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-5">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-float transition hover:bg-brand-deep disabled:opacity-60"
            >
              {generating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? '生成中...' : '生成方案'}
            </button>
            <div className="mt-3 text-xs leading-6 text-slate-500">
              信息越完整，组合建议越接近你的真实申请进度。
            </div>
          </div>
        </section>

        <section className="grid content-start gap-5">
          {report ? (
            <>
              <ReportOverview report={report} loggedIn={loggedIn} />
              <section className="grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                <TierPlanPanel report={report} />
                <MaterialPanel gaps={report.materialGaps} snapshot={materialSnapshot} />
              </section>
              <ActionPanel actions={report.actionItems} warnings={report.portfolioWarnings} />
            </>
          ) : (
            <EmptyReport loading={loading} />
          )}
        </section>
      </section>

      {report ? <RecommendationPanel projects={report.recommendedProjects} /> : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="overflow-hidden rounded-[30px] border border-black/5 bg-white/96 shadow-soft backdrop-blur">
          <div className="border-b border-slate-100 px-6 py-5">
            <SectionHeading icon={Route} eyebrow="推进路径" title="下一步怎么做" />
          </div>
          <div className="grid gap-4 px-6 py-6 md:grid-cols-3">
            <DataSourceCard title="补齐背景" value="01" detail="先确认排名、语言、科研和目标方向。" icon={FileText} />
            <DataSourceCard title="检查组合" value="02" detail="看冲刺、稳妥、保底是否数量均衡。" icon={Layers3} />
            <DataSourceCard title="推进项目" value="03" detail="把最合适的项目加入清单，按截止时间处理材料。" icon={Route} />
          </div>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-black/5 bg-white/96 shadow-soft backdrop-blur">
          <div className="border-b border-slate-100 px-6 py-5">
            <SectionHeading icon={Flag} eyebrow="人工复盘" title="提交复核需求" />
          </div>
          <div className="grid gap-3 px-6 py-6">
            <input
              value={wechatId}
              onChange={(event) => setWechatId(event.target.value)}
              placeholder="微信号"
              className={inputClassName}
            />
            <div className="grid gap-2">
              {needOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPrimaryNeed(option)}
                  className={`rounded-2xl border px-4 py-2.5 text-left text-sm font-semibold ${
                    primaryNeed === option ? 'border-brand bg-brand-cream text-brand' : 'border-slate-100 bg-slate-50 text-slate-600'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              value={feedbackDetails}
              onChange={(event) => setFeedbackDetails(event.target.value)}
              placeholder="补充你最担心的院校、材料或方向"
              className={`${inputClassName} resize-none`}
            />
            <button
              type="button"
              onClick={handleFeedbackSubmit}
              disabled={feedbackSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {feedbackSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              提交复盘需求
            </button>
            {feedbackMessage ? <div className="text-sm leading-6 text-slate-500">{feedbackMessage}</div> : null}
          </div>
        </section>
      </section>
    </SiteShell>
  );
}

function ReportOverview({ report, loggedIn }: { report: AiPositioningReport; loggedIn: boolean }) {
  return (
    <section className="overflow-hidden rounded-[30px] border border-black/5 bg-white/96 shadow-soft backdrop-blur">
      <div className="grid gap-0 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="bg-ink px-6 py-6 text-white">
          <div className="text-sm font-semibold text-white/70">申请准备度</div>
          <div className="mt-3 text-6xl font-semibold tracking-tight">{report.readinessScore}</div>
          <div className="mt-2 text-sm text-white/70">/ 100</div>
          <div className="mt-5 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold">{report.applicantBand}</div>
        </div>
        <div className="px-6 py-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">背景分 {report.applicantScore}</Badge>
            <Badge tone="blue">档案完整度 {report.profileCompleteness}%</Badge>
            <Badge tone="green">匹配项目 {report.stats.matchedProjectCount}</Badge>
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-ink">定位结论</h2>
          <p className="mt-3 text-sm leading-8 text-slate-600">{cleanUserFacingText(report.summary)}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <MiniStat label="公开项目" value={report.stats.publicProjectCount.toString()} />
            <MiniStat label="已跟进" value={report.stats.trackedProjectCount.toString()} />
            <MiniStat label="7 天内截止" value={report.stats.urgentTrackedCount.toString()} />
          </div>
          {!loggedIn ? (
            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
              当前方案暂未结合你已跟进的项目。登录后重新生成，组合判断会更贴近真实进度。
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function TierPlanPanel({ report }: { report: AiPositioningReport }) {
  return (
    <section className="product-card rounded-[30px] p-5">
      <SectionHeading icon={Layers3} eyebrow="组合" title="目标层级" />
      <div className="mt-4 grid gap-3">
        {report.tierPlan.map((item) => (
          <div key={item.tier} className="rounded-2xl bg-white px-4 py-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className={`rounded-xl px-3 py-1 text-xs font-semibold ${getTierTone(item.tier)}`}>{item.tier}</span>
              <span className="text-sm font-semibold text-ink">
                {item.currentCount} / {item.targetCount}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">{cleanUserFacingText(item.advice)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MaterialPanel({ gaps, snapshot }: { gaps: AiMaterialGap[]; snapshot: Array<{ label: string; ready: boolean }> }) {
  return (
    <section className="product-card rounded-[30px] p-5">
      <SectionHeading icon={BookOpenCheck} eyebrow="材料" title="短板清单" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {snapshot.map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm shadow-sm">
            <span className="font-semibold text-ink">{item.label}</span>
            <span className={item.ready ? 'text-brand' : 'text-slate-400'}>{item.ready ? '已覆盖' : '待补'}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3">
        {gaps.slice(0, 4).map((gap) => (
          <div key={gap.title} className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink">{gap.title}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getPriorityTone(gap.priority)}`}>
                {formatPriority(gap.priority)}
              </span>
            </div>
            <p className="mt-2 text-xs leading-6 text-slate-500">{cleanUserFacingText(gap.detail)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecommendationPanel({ projects }: { projects: AiRecommendedProject[] }) {
  return (
    <section className="overflow-hidden rounded-[30px] border border-black/5 bg-white/96 shadow-soft backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
        <SectionHeading icon={TrendingUp} eyebrow="推荐" title="优先核对项目" />
        <Link href="/notices" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand">
          通知库
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 px-6 py-6">
        {projects.length ? (
          projects.map((project) => <RecommendedProjectCard key={project.id} project={project} />)
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-10 text-center text-sm text-slate-500">
            当前筛选条件下暂无高匹配项目，放宽目标地区或专业关键词后重新生成。
          </div>
        )}
      </div>
    </section>
  );
}

function RecommendedProjectCard({ project }: { project: AiRecommendedProject }) {
  const href = buildNoticeDetailHref(project.id);

  return (
    <article className="rounded-[26px] border border-slate-100 bg-white px-5 py-5 shadow-sm">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_150px_150px] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-xl px-2.5 py-1 text-xs font-semibold ${getTierTone(project.tier)}`}>{project.tier}</span>
            <span className="rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{project.schoolRange}</span>
            <span className="rounded-xl bg-brand/8 px-2.5 py-1 text-xs font-semibold text-brand">匹配 {project.score}</span>
            {project.alreadyTracked ? <span className="rounded-xl bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-brand">已跟进</span> : null}
          </div>
          <Link href={href} className="mt-3 block text-lg font-semibold text-ink hover:text-brand">
            {getDisplaySchoolName(project.schoolName)} · {getDisplayNoticeDepartment(project)}
          </Link>
          <p className="mt-2 line-clamp-2 text-sm leading-7 text-slate-600">{normalizeNoticeTitle(project.projectName, 88)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {project.reasons.map((reason) => (
              <span key={reason} className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
                {cleanUserFacingText(reason)}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
          <div className="text-xs font-semibold text-slate-400">截止时间</div>
          <div className="mt-2 font-semibold text-ink">{formatNoticeDateOnly(project.deadlineDate) || '待确认'}</div>
          <div className="mt-1 text-xs text-slate-500">
            {project.daysLeft === null ? '官网待补充' : project.daysLeft <= 0 ? '今天截止' : `剩余 ${project.daysLeft} 天`}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <ApplicationActionButton projectId={project.id} variant="secondary" label="加入清单" addedLabel="已在清单" />
          <Link href={href} className="inline-flex justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:border-brand/30 hover:text-brand">
            查看通知
          </Link>
        </div>
      </div>
    </article>
  );
}

function ActionPanel({ actions, warnings }: { actions: AiActionItem[]; warnings: string[] }) {
  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <section className="product-card rounded-[30px] p-5">
        <SectionHeading icon={CheckCircle2} eyebrow="行动" title="本周动作" />
        <div className="mt-4 grid gap-3">
          {actions.map((item, index) => (
            <div key={`${item.title}-${index}`} className="flex gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-semibold ${getPriorityTone(item.priority)}`}>
                {index + 1}
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">{cleanUserFacingText(item.title)}</span>
                <span className="mt-1 block text-xs leading-6 text-slate-500">{cleanUserFacingText(item.detail)}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="product-card rounded-[30px] p-5">
        <SectionHeading icon={ShieldAlert} eyebrow="风险" title="风险提示" />
        <div className="mt-4 grid gap-3">
          {warnings.length ? (
            warnings.map((warning) => (
              <div key={warning} className="rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-700">
                {cleanUserFacingText(warning)}
              </div>
            ))
          ) : (
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm leading-7 text-brand">
              当前组合没有明显结构性风险，继续按截止时间推进即可。
            </div>
          )}
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500">
            结果仅用于申请规划，不构成录取承诺，也不能替代院校官网通知。
          </div>
        </div>
      </section>
    </section>
  );
}

function EmptyReport({ loading }: { loading: boolean }) {
  return (
    <section className="overflow-hidden rounded-[30px] border border-black/5 bg-white/96 shadow-soft backdrop-blur">
      <div className="flex min-h-[500px] flex-col items-center justify-center px-8 py-12 text-center">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-brand/8 text-brand">
          {loading ? <LoaderCircle className="h-7 w-7 animate-spin" /> : <Sparkles className="h-7 w-7" />}
        </span>
        <h2 className="mt-5 text-2xl font-semibold text-ink">{loading ? '正在整理申请线索' : '生成你的第一份申请方案'}</h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-slate-500">
          方案会结合目标方向、申请清单和材料状态，输出目标组合、推荐项目、短板和本周动作。
        </p>
        <div className="mt-6 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
          {[
            ['1', '填写背景'],
            ['2', '生成方案'],
            ['3', '加入项目']
          ].map(([step, label]) => (
            <div key={step} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              <span className="mr-2 text-brand">{step}</span>
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone
}: {
  label: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
}) {
  const toneClass =
    tone === 'orange'
      ? 'bg-orange-50 text-orange-600'
      : tone === 'blue'
        ? 'bg-blue-50 text-blue-600'
        : tone === 'green'
          ? 'bg-emerald-50 text-emerald-600'
          : 'bg-brand/8 text-brand';

  return (
    <div className="product-card rounded-[24px] p-6">
      <div className="flex items-center gap-5">
        <span className={`inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${toneClass}`}>
          <Icon className="h-7 w-7" />
        </span>
        <div>
          <div className="text-sm font-semibold text-slate-600">{label}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-ink">{value}</div>
          <div className="mt-2 text-sm text-slate-500">{hint}</div>
        </div>
      </div>
    </div>
  );
}

function DataSourceCard({
  title,
  value,
  detail,
  icon: Icon
}: {
  title: string;
  value: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 px-5 py-5">
      <Icon className="h-5 w-5 text-brand" />
      <div className="mt-3 text-lg font-semibold text-ink">{value}</div>
      <div className="mt-1 text-sm font-semibold text-slate-600">{title}</div>
      <div className="mt-2 text-xs leading-6 text-slate-500">{detail}</div>
    </div>
  );
}

function InputGroup({
  title,
  icon: Icon,
  children
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon className="h-4 w-4 text-brand" />
        {title}
      </div>
      {children}
    </section>
  );
}

function SectionHeading({
  icon: Icon,
  eyebrow,
  title
}: {
  icon: ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
}) {
  return (
    <div>
      <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
        <Icon className="h-4 w-4" />
        {eyebrow}
      </div>
      <h2 className="mt-2 text-xl font-semibold text-ink">{title}</h2>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-slate-600">{label}</div>
      {children}
    </label>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-ink">{value}</div>
    </div>
  );
}

function Badge({ tone, children }: { tone: 'brand' | 'blue' | 'green'; children: ReactNode }) {
  const className =
    tone === 'blue'
      ? 'bg-blue-50 text-blue-600'
      : tone === 'green'
        ? 'bg-emerald-50 text-brand'
        : 'bg-brand/8 text-brand';

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}

function getMaterialSnapshot(rows: ApplicationRow[]) {
  return materialChecklistDefinitions.map((item) => ({
    label: item.label,
    ready: rows.some((row) => Boolean(row.item[item.key]))
  }));
}

function getTierTone(tier: AiProjectTier) {
  if (tier === '冲刺') return 'bg-violet-50 text-violet-600';
  if (tier === '保底') return 'bg-slate-100 text-slate-600';
  return 'bg-emerald-50 text-brand';
}

function getPriorityTone(priority: 'high' | 'medium' | 'low') {
  if (priority === 'high') return 'bg-rose-50 text-rose-600';
  if (priority === 'low') return 'bg-slate-100 text-slate-500';
  return 'bg-amber-50 text-amber-700';
}

function formatPriority(priority: 'high' | 'medium' | 'low') {
  if (priority === 'high') return '高';
  if (priority === 'low') return '低';
  return '中';
}

function cleanUserFacingText(value: string) {
  return value
    .replace(/Supabase/g, 'Seekoffer')
    .replace(/云端/g, '账号')
    .replace(/本机/g, '这里')
    .replace(/同步/g, '更新')
    .replace(/数据链路/g, '推进路径')
    .replace(/已接入/g, '已纳入')
    .replace(/申请表/g, '申请清单')
    .replace(/定位报告/g, '定位方案')
    .replace(/报告/g, '方案');
}
