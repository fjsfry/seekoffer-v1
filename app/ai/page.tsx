'use client';

import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Crown,
  FileCheck2,
  Flag,
  Info,
  Layers3,
  LoaderCircle,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
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
const workflowSteps = [
  {
    title: '填写 5 项核心背景',
    detail: '本科院校、专业、成绩、目标方向和地区先决定初版定位。',
    icon: UserRoundCheck
  },
  {
    title: '生成冲稳保组合',
    detail: '系统按背景竞争力、方向匹配和截止时间筛出候选项目。',
    icon: ShieldCheck
  },
  {
    title: '加入清单推进',
    detail: '把合适项目加入申请表，再按材料和截止日期持续跟进。',
    icon: ClipboardList
  }
];

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
  const [showAdvancedInput, setShowAdvancedInput] = useState(false);
  const inputPanelRef = useRef<HTMLElement | null>(null);

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
  const quickInputItems = useMemo(
    () => [
      { label: '本科院校', done: Boolean(input.undergraduateSchool.trim()) },
      { label: '本科专业', done: Boolean(input.major.trim()) },
      { label: 'GPA/排名', done: Boolean(input.gpa.trim() || input.rankPercent.trim()) },
      { label: '目标方向', done: Boolean(input.targetMajor.trim()) },
      { label: '目标地区', done: Boolean(input.targetRegion.trim()) }
    ],
    [input.gpa, input.major, input.rankPercent, input.targetMajor, input.targetRegion, input.undergraduateSchool]
  );
  const quickInputCount = quickInputItems.filter((item) => item.done).length;
  const quickInputReady = quickInputCount === quickInputItems.length;
  const quickMissingLabels = quickInputItems.filter((item) => !item.done).map((item) => item.label);

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
    if (!quickInputReady) {
      const missingText = quickMissingLabels.slice(0, 3).join('、');
      setMessage(`先补齐快速定位的 ${quickMissingLabels.length} 项：${missingText}。填完 5 项即可生成初版方案。`);
      inputPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    setGenerating(true);
    setMessage('');

    try {
      const nextReport = buildAiPositioningReport(input, publicProjects, applicationRows);
      setReport(nextReport);
      await saveAiPositioningReport(nextReport, input);
      setMessage('定位方案已自动保存。建议先核对前 5 个项目，再把合适项目加入申请清单。');
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

      setFeedbackMessage(result.ok ? '已收到你的人工复核需求，我们会优先围绕你选择的问题看。' : '已记录你的人工复核需求。');
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  return (
    <SiteShell>
      <section className="grid gap-6 rounded-[34px] border border-white/70 bg-white/92 px-6 py-7 shadow-soft backdrop-blur lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] lg:items-center lg:px-8">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">AI 保研定位</h1>
          <p className="mt-4 text-lg font-semibold leading-8 text-ink">先判断你适合冲哪里，再给出能执行的项目组合。</p>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            这不是聊天窗口。按步骤填完 5 个核心信息后，系统会输出综合适配度、冲稳保建议、风险短板和可加入申请清单的项目。
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => inputPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-float transition hover:bg-brand-deep"
            >
              开始定位
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              href={report ? '#ai-results' : '#ai-input'}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-sm transition hover:border-brand/30 hover:text-brand"
            >
              {report ? '查看已保存方案' : '先看需要填写什么'}
              <ChevronDown className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="grid gap-3">
          {workflowSteps.map((step, index) => (
            <ProductFlowCard key={step.title} step={index + 1} title={step.title} detail={step.detail} icon={step.icon} />
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <TopMetricCard label="当前通知池" value={loading ? '...' : publicProjects.length.toLocaleString('zh-CN')} hint="按公开通知实时匹配" icon={ClipboardList} tone="green" />
        <TopMetricCard label="定位档案" value={`${quickInputCount}/5`} hint={quickInputReady ? '核心信息已完成' : '补齐后可生成'} icon={FileCheck2} tone="brand" />
        <TopMetricCard label="本轮推荐" value={report ? report.recommendedProjects.length.toString() : '--'} hint={report ? `稳妥 ${countRecommendationTier(report.recommendedProjects, '稳妥')} 个候选` : '生成后显示'} icon={ShieldCheck} tone="orange" />
      </section>

      {message ? (
        <section className="rounded-[28px] border border-brand/15 bg-white/86 px-5 py-4 text-sm text-brand shadow-sm backdrop-blur">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="leading-7">{message}</div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(380px,0.84fr)_minmax(0,1.16fr)]">
        <PositioningInputPanel
          input={input}
          quickInputCount={quickInputCount}
          quickInputItems={quickInputItems}
          loading={loading}
          generating={generating}
          showAdvancedInput={showAdvancedInput}
          hasProfile={Boolean(session?.profile)}
          onSyncProfile={syncProfile}
          onToggleAdvanced={() => setShowAdvancedInput((current) => !current)}
          onGenerate={handleGenerate}
          onToggleProjectType={toggleProjectType}
          onUpdateInput={updateInput}
          inputPanelRef={inputPanelRef}
        />

        <AnalysisResultPanel
          report={report}
          loading={loading}
          materialSnapshot={materialSnapshot}
          trackedProjectCount={applicationRows.length}
        />
      </section>

      {report ? <RecommendationPanel projects={report.recommendedProjects} /> : null}

      {report ? (
        <NextActionCards
          report={report}
          loggedIn={loggedIn}
          trackedProjectCount={applicationRows.length}
          materialSnapshot={materialSnapshot}
          wechatId={wechatId}
          primaryNeed={primaryNeed}
          feedbackDetails={feedbackDetails}
          feedbackMessage={feedbackMessage}
          feedbackSubmitting={feedbackSubmitting}
          onWechatChange={setWechatId}
          onNeedChange={setPrimaryNeed}
          onDetailsChange={setFeedbackDetails}
          onSubmit={handleFeedbackSubmit}
        />
      ) : null}

      <div className="fixed inset-x-4 bottom-4 z-30 lg:hidden">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-float disabled:opacity-60"
        >
          {generating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
          {generating ? '生成中...' : quickInputReady ? '生成定位方案' : `补齐快速定位 ${quickInputCount}/5`}
        </button>
      </div>
    </SiteShell>
  );
}

function PositioningInputPanel({
  input,
  quickInputCount,
  quickInputItems,
  loading,
  generating,
  showAdvancedInput,
  hasProfile,
  onSyncProfile,
  onToggleAdvanced,
  onGenerate,
  onToggleProjectType,
  onUpdateInput,
  inputPanelRef
}: {
  input: AiPositioningInput;
  quickInputCount: number;
  quickInputItems: Array<{ label: string; done: boolean }>;
  loading: boolean;
  generating: boolean;
  showAdvancedInput: boolean;
  hasProfile: boolean;
  onSyncProfile: () => void;
  onToggleAdvanced: () => void;
  onGenerate: () => void;
  onToggleProjectType: (type: ProjectType) => void;
  onUpdateInput: <Key extends keyof AiPositioningInput>(key: Key, value: AiPositioningInput[Key]) => void;
  inputPanelRef: RefObject<HTMLElement | null>;
}) {
  const completion = quickInputCount * 20;

  return (
    <section id="ai-input" ref={inputPanelRef} className="scroll-mt-6 overflow-hidden rounded-[30px] border border-black/5 bg-white/96 shadow-soft backdrop-blur">
      <div className="border-b border-slate-100 px-5 py-5 lg:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">1. 建立定位档案</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">先填 5 个必填项即可生成初版；科研、论文和奖项会让推荐更精细。</p>
          </div>
          {hasProfile ? (
            <button
              type="button"
              onClick={onSyncProfile}
              className="inline-flex items-center gap-2 rounded-2xl border border-brand/25 bg-white px-4 py-2.5 text-xs font-semibold text-brand shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              带入档案
            </button>
          ) : null}
        </div>

        <div className="mt-5 rounded-[24px] border border-brand/10 bg-brand/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-ink">生成前还需要</div>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {quickInputCount === 5 ? '核心信息已完成，可以生成定位方案。' : `补齐 ${5 - quickInputCount} 项：${quickInputItems.filter((item) => !item.done).map((item) => item.label).join('、')}`}
              </p>
            </div>
            <span className="rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-brand shadow-sm">{quickInputCount}/5</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-xs font-semibold">
          {['填写背景', 'AI 分析', '查看结果'].map((step, index) => (
            <FragmentStep key={step} label={step} index={index + 1} active={index === 0} done={quickInputCount === 5 && index === 0} />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {quickInputItems.map((item) => (
            <span
              key={item.label}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                item.done ? 'bg-brand/8 text-brand' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-6 px-5 py-5 lg:px-6">
        <section>
          <PanelTitle icon={UserRoundCheck} title="基本信息" />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="本科院校">
              <input
                value={input.undergraduateSchool}
                onChange={(event) => onUpdateInput('undergraduateSchool', event.target.value)}
                placeholder="请输入本科学校名称"
                className={inputClassName}
              />
            </Field>
            <Field label="本科专业">
              <input
                value={input.major}
                onChange={(event) => onUpdateInput('major', event.target.value)}
                placeholder="请输入本科专业"
                className={inputClassName}
              />
            </Field>
            <Field label="GPA / 均分">
              <input
                value={input.gpa}
                onChange={(event) => onUpdateInput('gpa', event.target.value)}
                placeholder="如：3.72 / 4.0 或 88"
                className={inputClassName}
              />
            </Field>
            <Field label="专业排名">
              <input
                value={input.rankPercent}
                onChange={(event) => onUpdateInput('rankPercent', event.target.value)}
                placeholder="如：前 10%"
                className={inputClassName}
              />
            </Field>
            <Field label="英语成绩" className="md:col-span-2">
              <input
                value={input.englishLevel}
                onChange={(event) => onUpdateInput('englishLevel', event.target.value)}
                placeholder="如：TOEFL 100 / IELTS 7.0 / 六级 560"
                className={inputClassName}
              />
            </Field>
          </div>
        </section>

        <section>
          <PanelTitle icon={SlidersHorizontal} title="申请偏好" />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="目标方向">
              <input
                value={input.targetMajor}
                onChange={(event) => onUpdateInput('targetMajor', event.target.value)}
                placeholder="如：人工智能 / 金融 / 生物医学"
                className={inputClassName}
              />
            </Field>
            <Field label="意向地区">
              <input
                value={input.targetRegion}
                onChange={(event) => onUpdateInput('targetRegion', event.target.value)}
                placeholder="如：北京 / 上海 / 长三角 / 不限"
                className={inputClassName}
              />
            </Field>
            <Field label="目标院校关键词" className="md:col-span-2">
              <input
                value={input.targetSchoolKeywords}
                onChange={(event) => onUpdateInput('targetSchoolKeywords', event.target.value)}
                placeholder="如：清华、北大、上交、浙大"
                className={inputClassName}
              />
            </Field>
          </div>
        </section>

        <section>
          <PanelTitle icon={BookOpenCheck} title="经历与能力" />
          <div className="mt-4 grid gap-4">
            <Field label="科研 / 竞赛 / 项目经历">
              <textarea
                rows={3}
                value={input.researchExperience}
                onChange={(event) => onUpdateInput('researchExperience', event.target.value)}
                placeholder="请简要描述你的科研、竞赛、实习或项目经历"
                className={`${inputClassName} resize-none`}
              />
            </Field>
            <Field label="备注补充（选填）">
              <textarea
                rows={3}
                value={input.notes}
                onChange={(event) => onUpdateInput('notes', event.target.value)}
                placeholder="如有其他补充信息，可在此说明"
                className={`${inputClassName} resize-none`}
              />
            </Field>
          </div>
        </section>

        {showAdvancedInput ? (
          <section className="rounded-[24px] border border-slate-100 bg-slate-50/80 p-4">
            <PanelTitle icon={Layers3} title="高级补充" />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="项目类型" className="md:col-span-2">
                <div className="grid grid-cols-3 gap-2">
                  {projectTypeChoices.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onToggleProjectType(type)}
                      className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                        input.preferredProjectTypes.includes(type)
                          ? 'border-brand bg-brand-cream text-brand'
                          : 'border-slate-100 bg-white text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="论文 / 专利">
                <input
                  value={input.paperExperience}
                  onChange={(event) => onUpdateInput('paperExperience', event.target.value)}
                  placeholder="没有可留空"
                  className={inputClassName}
                />
              </Field>
              <Field label="竞赛 / 奖项">
                <input
                  value={input.competitionExperience}
                  onChange={(event) => onUpdateInput('competitionExperience', event.target.value)}
                  placeholder="国奖 / 竞赛 / 奖学金"
                  className={inputClassName}
                />
              </Field>
            </div>
          </section>
        ) : null}

        <div className="rounded-[24px] bg-slate-50/80 p-4">
          <div className="flex items-center justify-between gap-4 text-sm font-semibold text-ink">
            <span>信息完整度</span>
            <span>{completion}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${completion}%` }} />
          </div>
        </div>

        <button
          type="button"
          onClick={onGenerate}
          disabled={generating || loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-4 text-sm font-semibold text-white shadow-float transition hover:bg-brand-deep disabled:opacity-60"
        >
          {generating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? '生成中...' : quickInputCount === 5 ? '生成定位分析' : `补齐快速定位 ${quickInputCount}/5`}
        </button>

        <button
          type="button"
          onClick={onToggleAdvanced}
          className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-brand"
        >
          {showAdvancedInput ? '收起高级补充' : '展开高级补充'}
          {showAdvancedInput ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
    </section>
  );
}

function AnalysisResultPanel({
  report,
  loading,
  materialSnapshot,
  trackedProjectCount
}: {
  report: AiPositioningReport | null;
  loading: boolean;
  materialSnapshot: Array<{ label: string; ready: boolean }>;
  trackedProjectCount: number;
}) {
  const generatedAt = report
    ? new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(report.generatedAt))
    : '--';

  return (
    <section id="ai-results" className="scroll-mt-6 overflow-hidden rounded-[30px] border border-black/5 bg-white/96 shadow-soft backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-5 lg:px-6">
        <div>
          <h2 className="text-xl font-semibold text-ink">2. 查看定位结论</h2>
          <p className="mt-2 text-sm text-slate-500">{report ? '基于你提供的信息生成' : loading ? '正在整理申请线索' : '生成后展示定位结论和风险提示'}</p>
        </div>
        <div className="inline-flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
          分析时间：{generatedAt}
          <RotateCw className="h-4 w-4 text-slate-400" />
        </div>
      </div>

      {report ? (
        <div className="grid gap-5 px-5 py-5 lg:px-6">
          <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
            <div className="rounded-[24px] border border-slate-100 bg-slate-50/80 p-5">
              <div className="text-sm font-semibold text-slate-500">综合适配度</div>
              <div className="mt-4 flex items-end gap-1">
                <span className="text-5xl font-semibold tracking-tight text-brand">{report.readinessScore}</span>
                <span className="pb-1 text-lg font-semibold text-slate-500">/100</span>
              </div>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-ink">
                <span className="h-2 w-2 rounded-full bg-brand" />
                {report.applicantBand}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-100 bg-white p-5">
              <div className="text-sm font-semibold text-ink">定位结论</div>
              <p className="mt-3 text-sm leading-8 text-slate-600">{cleanUserFacingText(report.summary)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="brand">背景分 {report.applicantScore}</Badge>
                <Badge tone="blue">档案完整度 {report.profileCompleteness}%</Badge>
                <Badge tone="green">匹配项目 {report.stats.matchedProjectCount}</Badge>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {report.tierPlan.map((item) => (
              <AnalysisMetric key={item.tier} label={`${item.tier}项目数`} value={countRecommendationTier(report.recommendedProjects, item.tier)} hint={item.advice} tier={item.tier} />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <InsightListCard
              icon={AlertTriangle}
              title="风险提示 / 短板分析"
              items={
                report.portfolioWarnings.length
                  ? report.portfolioWarnings.slice(0, 5).map((warning, index) => ({
                      label: cleanUserFacingText(warning),
                      tag: index === 0 ? '高风险' : index <= 2 ? '中风险' : '低风险',
                      tone: index === 0 ? 'danger' : index <= 2 ? 'warning' : 'safe'
                    }))
                  : [{ label: '当前组合没有明显结构性风险，继续按截止时间推进即可。', tag: '低风险', tone: 'safe' }]
              }
            />
            <InsightListCard
              icon={FileCheck2}
              title="材料与准备建议"
              items={buildMaterialInsightItems(report, materialSnapshot, trackedProjectCount)}
            />
          </div>
        </div>
      ) : (
        <div className="flex min-h-[560px] flex-col items-center justify-center px-8 py-12 text-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-brand/8 text-brand">
            {loading ? <LoaderCircle className="h-7 w-7 animate-spin" /> : <Sparkles className="h-7 w-7" />}
          </span>
          <h3 className="mt-5 text-2xl font-semibold text-ink">{loading ? '正在整理申请线索' : '填完左侧信息后生成方案'}</h3>
          <p className="mt-3 max-w-lg text-sm leading-7 text-slate-500">
            生成后你会看到一份可执行的申请定位：你的竞争力区间、冲稳保项目比例、主要风险和下一步动作。
          </p>
          <div className="mt-6 grid w-full max-w-xl gap-3 text-left sm:grid-cols-3">
            {[
              ['定位结论', '判断当前背景更适合冲刺、稳妥还是补强。'],
              ['风险短板', '指出成绩、方向、材料或清单结构上的问题。'],
              ['项目推荐', '把可申请项目按匹配度和截止时间排序。']
            ].map(([title, detail]) => (
              <div key={title} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="text-sm font-semibold text-ink">{title}</div>
                <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function NextActionCards({
  report,
  loggedIn,
  trackedProjectCount,
  materialSnapshot,
  wechatId,
  primaryNeed,
  feedbackDetails,
  feedbackMessage,
  feedbackSubmitting,
  onWechatChange,
  onNeedChange,
  onDetailsChange,
  onSubmit
}: {
  report: AiPositioningReport | null;
  loggedIn: boolean;
  trackedProjectCount: number;
  materialSnapshot: Array<{ label: string; ready: boolean }>;
  wechatId: string;
  primaryNeed: AiWaitlistNeed;
  feedbackDetails: string;
  feedbackMessage: string;
  feedbackSubmitting: boolean;
  onWechatChange: (value: string) => void;
  onNeedChange: (value: AiWaitlistNeed) => void;
  onDetailsChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const nextStepPlan = buildAdaptiveNextStepPlan(report, materialSnapshot, trackedProjectCount, loggedIn);
  const explanationPlan = buildAdaptiveExplanationPlan(report, trackedProjectCount);

  return (
    <section className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(380px,1.08fr)]">
      <ActionSummaryCard
        icon={Flag}
        eyebrow="申请推进"
        title="下一步怎么做"
        description={nextStepPlan.description}
        tone="green"
        items={nextStepPlan.items}
        footerLabel={nextStepPlan.footerLabel}
        footerValue={nextStepPlan.footerValue}
        actionLabel="查看申请全流程指南"
        href="/guide"
      />
      <ActionSummaryCard
        icon={Info}
        eyebrow="可信边界"
        title="结果说明"
        description={explanationPlan.description}
        tone="blue"
        items={explanationPlan.items}
        footerLabel={explanationPlan.footerLabel}
        footerValue={explanationPlan.footerValue}
        actionLabel="了解定位模型与算法"
        href="/disclaimer"
      />
      <section className="relative flex h-full flex-col overflow-hidden rounded-[32px] border border-orange-200/80 bg-white shadow-soft">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400" />
        <div className="bg-gradient-to-br from-orange-50 via-white to-white px-5 pb-4 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-600">人工复核</div>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight text-ink">找老师进一步优化定位</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                专业导师 1V1 复核你的背景、目标和材料，给出更稳的项目组合。
              </p>
            </div>
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-orange-100 text-orange-500">
              <Crown className="h-7 w-7" />
            </span>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {['背景诊断', '项目清单', '材料建议'].map((item) => (
              <div key={item} className="rounded-2xl border border-orange-100 bg-white/85 px-3 py-2 text-center text-xs font-semibold text-orange-700">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 px-5 py-5">
          <div className="grid gap-3">
            {['深度分析背景与短板', '定制院校与项目清单', '文书与材料优化建议'].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl bg-orange-50/70 px-3 py-2.5 text-sm font-semibold text-slate-700">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-orange-500 shadow-sm">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                {item}
              </div>
            ))}
          </div>

          <div className="mt-auto grid gap-3 rounded-[24px] border border-orange-100 bg-white p-4 shadow-sm">
            <label className="grid gap-2">
              <span className="text-xs font-semibold text-slate-500">联系方式</span>
              <input value={wechatId} onChange={(event) => onWechatChange(event.target.value)} placeholder="微信号" className={inputClassName} />
            </label>

            <div className="grid gap-2">
              <span className="text-xs font-semibold text-slate-500">主要需求</span>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {needOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onNeedChange(option)}
                    className={`rounded-2xl border px-3 py-2.5 text-center text-sm font-semibold transition ${
                  primaryNeed === option ? 'border-orange-300 bg-orange-50 text-orange-600 shadow-sm' : 'border-slate-100 bg-slate-50 text-slate-600 hover:bg-white'
                }`}
              >
                {option}
              </button>
            ))}
              </div>
            </div>

            <label className="grid gap-2">
              <span className="text-xs font-semibold text-slate-500">补充说明</span>
              <textarea
                rows={3}
                value={feedbackDetails}
                onChange={(event) => onDetailsChange(event.target.value)}
                placeholder="补充你最担心的院校、材料或方向"
                className={`${inputClassName} resize-none`}
              />
            </label>

          <button
            type="button"
            onClick={onSubmit}
            disabled={feedbackSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-60"
          >
            {feedbackSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            提交人工定位需求
          </button>
          {feedbackMessage ? <div className="text-xs leading-6 text-slate-500">{feedbackMessage}</div> : null}
          </div>
        </div>
      </section>
    </section>
  );
}

function buildAdaptiveNextStepPlan(
  report: AiPositioningReport | null,
  materialSnapshot: Array<{ label: string; ready: boolean }>,
  trackedProjectCount: number,
  loggedIn: boolean
) {
  if (!report) {
    return {
      description: '还没有生成定位结论，下一步只围绕信息采集和状态记录，不判断材料是否完成。',
      items: [
        '先补齐左侧 5 个快速定位字段',
        '已有目标项目时，先加入申请清单',
        '已完成的简历、成绩单等材料，在清单里标记状态',
        loggedIn ? '生成定位后再看项目组合和材料短板' : '登录后可结合你的申请清单持续更新'
      ],
      footerLabel: '当前状态',
      footerValue: '等待定位'
    };
  }

  const items: string[] = [];
  const firstProject = report.recommendedProjects[0];

  if (!trackedProjectCount) {
    items.push('先把前 5 个推荐项目加入申请清单');
    items.push('在申请清单里标记简历、成绩单、排名证明等材料状态');
  } else {
    const pendingMaterials = materialSnapshot.filter((item) => !item.ready).map((item) => item.label);
    if (pendingMaterials.length) {
      items.push(`确认或补齐材料状态：${pendingMaterials.slice(0, 3).join('、')}`);
    } else {
      items.push('材料状态已记录齐全，下一步核对截止时间和面试要求');
    }
  }

  if (firstProject) {
    items.push(`优先核对 ${firstProject.schoolName} 的官网通知`);
  }

  report.actionItems.forEach((item) => {
    const text = cleanUserFacingText(`${item.title}：${item.detail}`);
    if (!items.some((entry) => entry.includes(item.title))) {
      items.push(text);
    }
  });

  items.push('材料质量目前不自动评分，已完成材料可提交人工复核');

  return {
    description: trackedProjectCount
      ? '以下建议基于你已记录的申请清单和材料状态生成，不会假设未记录材料一定没做。'
      : '当前没有可判断材料状态的申请清单，因此先建议建立清单并记录材料状态。',
    items: items.slice(0, 4),
    footerLabel: trackedProjectCount ? '已记录项目' : '材料状态',
    footerValue: trackedProjectCount ? `${trackedProjectCount} 个项目` : '尚未记录'
  };
}

function buildMaterialInsightItems(
  report: AiPositioningReport,
  materialSnapshot: Array<{ label: string; ready: boolean }>,
  trackedProjectCount: number
) {
  if (!trackedProjectCount) {
    return [
      { label: '材料状态未记录：先把目标项目加入申请清单，再标记简历、成绩单等状态', tag: '未知', tone: 'neutral' },
      ...report.materialGaps
        .filter((gap) => !materialChecklistDefinitions.some((item) => item.label === gap.title))
        .slice(0, 4)
        .map((gap) => ({
          label: cleanUserFacingText(gap.title),
          tag: formatPriority(gap.priority),
          tone: gap.priority === 'high' ? 'danger' : gap.priority === 'medium' ? 'warning' : 'safe'
        }))
    ].slice(0, 5);
  }

  const pending = materialSnapshot
    .filter((item) => !item.ready)
    .slice(0, 3)
    .map((item) => ({ label: `确认或补齐${item.label}`, tag: '待确认', tone: 'warning' }));

  const gapItems = report.materialGaps.slice(0, 4).map((gap) => ({
    label: cleanUserFacingText(gap.title),
    tag: formatPriority(gap.priority),
    tone: gap.priority === 'high' ? 'danger' : gap.priority === 'medium' ? 'warning' : 'safe'
  }));

  return [...pending, ...gapItems].slice(0, 5);
}

function buildAdaptiveExplanationPlan(report: AiPositioningReport | null, trackedProjectCount: number) {
  return {
    description: report
      ? '定位结果只基于已填写背景、推荐项目和已记录的清单状态；未记录的信息不会被当成已完成或未完成。'
      : '生成定位前，系统只展示说明，不会提前判断你的简历、文书或材料质量。',
    items: [
      '综合适配度是规划参考，不等同于录取概率',
      trackedProjectCount ? '材料建议来自申请清单里的勾选状态' : '未建立申请清单时，材料完成度显示为未知',
      '简历和文书质量目前不自动评分，需要人工或自查复核',
      '最终申请要求以院校官网通知和邮件为准'
    ],
    footerLabel: '判断边界',
    footerValue: trackedProjectCount ? '基于已记录状态' : '材料状态未知'
  };
}

function TopMetricCard({
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
  tone: 'brand' | 'green' | 'orange' | 'blue';
}) {
  const toneClass =
    tone === 'orange'
      ? 'bg-orange-50 text-orange-500'
      : tone === 'blue'
        ? 'bg-blue-50 text-blue-500'
        : tone === 'green'
          ? 'bg-emerald-50 text-brand'
          : 'bg-brand/8 text-brand';

  return (
    <div className="flex items-center gap-3 rounded-[22px] bg-white/80 px-3 py-3">
      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${toneClass}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-500">{label}</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</div>
        <div className="mt-1 truncate text-xs text-slate-400">{hint}</div>
      </div>
    </div>
  );
}

function ProductFlowCard({
  step,
  title,
  detail,
  icon: Icon
}: {
  step: number;
  title: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-4 rounded-[26px] border border-slate-100 bg-white px-4 py-4 shadow-sm">
      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/8 text-brand">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">{step}</span>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function FragmentStep({ label, index, active, done }: { label: string; index: number; active: boolean; done: boolean }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
            active || done ? 'bg-brand text-white shadow-sm' : 'bg-slate-100 text-slate-400'
          }`}
        >
          {index}
        </span>
        <span className={active || done ? 'text-ink' : 'text-slate-400'}>{label}</span>
      </div>
      {index < 3 ? <div className="h-px bg-slate-200" /> : null}
    </>
  );
}

function PanelTitle({ icon: Icon, title }: { icon: ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-ink">
      <Icon className="h-4 w-4 text-brand" />
      {title}
    </div>
  );
}

function AnalysisMetric({
  label,
  value,
  hint,
  tier
}: {
  label: string;
  value: number;
  hint: string;
  tier: AiProjectTier;
}) {
  return (
    <div className="rounded-[24px] border border-slate-100 bg-slate-50/80 p-5 text-center">
      <div className="text-sm font-semibold text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-ink">
        {value}
        <span className="ml-1 text-base text-slate-500">个</span>
      </div>
      <div className={`mx-auto mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getTierTone(tier)}`}>{tier}</div>
      <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">{cleanUserFacingText(hint)}</p>
    </div>
  );
}

function InsightListCard({
  icon: Icon,
  title,
  items
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  items: Array<{ label: string; tag: string; tone: string }>;
}) {
  return (
    <div className="rounded-[24px] border border-slate-100 bg-slate-50/70 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon className="h-4 w-4 text-brand" />
        {title}
      </div>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <div key={`${item.label}-${item.tag}`} className="flex items-start justify-between gap-3 text-sm">
            <span className="min-w-0 leading-6 text-slate-600">› {item.label}</span>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${getInsightTone(item.tone)}`}>{item.tag}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionSummaryCard({
  icon: Icon,
  eyebrow,
  title,
  description,
  tone,
  items,
  footerLabel,
  footerValue,
  actionLabel,
  href
}: {
  icon: ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  description: string;
  tone: 'green' | 'blue';
  items: string[];
  footerLabel: string;
  footerValue: string;
  actionLabel: string;
  href: string;
}) {
  const iconClass = tone === 'blue' ? 'bg-blue-50 text-blue-500' : 'bg-emerald-50 text-brand';
  const buttonClass = tone === 'blue' ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'bg-emerald-50 text-brand hover:bg-emerald-100';
  const lineClass = tone === 'blue' ? 'from-blue-400 to-blue-500' : 'from-brand to-emerald-400';

  return (
    <section className="relative flex h-full min-h-[430px] flex-col overflow-hidden rounded-[32px] border border-black/5 bg-white/96 shadow-soft backdrop-blur">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${lineClass}`} />
      <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-6">
        <div>
          <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${iconClass}`}>{eyebrow}</div>
          <h3 className="mt-4 text-2xl font-semibold tracking-tight text-ink">{title}</h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
        </div>
        <span className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl ${iconClass}`}>
          <Icon className="h-7 w-7" />
        </span>
      </div>

      <div className="grid gap-2 px-5">
        {items.map((item, index) => (
          <div key={item} className="flex items-center gap-3 rounded-2xl bg-slate-50/85 px-3 py-3 text-sm font-semibold text-slate-700">
            <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs shadow-sm ${tone === 'blue' ? 'text-blue-500' : 'text-brand'}`}>
              {index + 1}
            </span>
            {item}
          </div>
        ))}
      </div>

      <div className="mt-auto px-5 pb-5 pt-4">
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm shadow-sm">
          <span className="font-semibold text-slate-500">{footerLabel}</span>
          <span className="font-semibold text-ink">{footerValue}</span>
        </div>
        <Link href={href} className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${buttonClass}`}>
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function countRecommendationTier(projects: AiRecommendedProject[], tier: AiProjectTier) {
  return projects.filter((project) => project.tier === tier).length;
}

function RecommendationPanel({ projects }: { projects: AiRecommendedProject[] }) {
  const [showAll, setShowAll] = useState(false);
  const visibleProjects = showAll ? projects : projects.slice(0, 5);
  const tierSummary = [
    { label: '冲刺', value: countRecommendationTier(projects, '冲刺') },
    { label: '稳妥', value: countRecommendationTier(projects, '稳妥') },
    { label: '保底', value: countRecommendationTier(projects, '保底') }
  ];

  return (
    <section className="overflow-hidden rounded-[30px] border border-black/5 bg-white/96 shadow-soft backdrop-blur">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <SectionHeading icon={TrendingUp} eyebrow="3. 选项目" title="优先推荐项目" />
          <p className="mt-2 text-sm leading-6 text-slate-500">按匹配度和截止时间排序；先核对前 5 个，再把合适项目加入申请清单。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tierSummary.map((item) => (
            <span key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
              {item.label} {item.value}
            </span>
          ))}
        </div>
      </div>

      <div className="px-5 py-5">
        {projects.length ? (
          <div className="overflow-x-auto">
            <div className="min-w-[920px] divide-y divide-slate-100 overflow-hidden rounded-[24px] border border-slate-100">
              {visibleProjects.map((project) => <RecommendedProjectRow key={project.id} project={project} />)}
            </div>
            {projects.length > 5 ? (
              <button
                type="button"
                onClick={() => setShowAll((current) => !current)}
                className="mx-auto mt-5 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-ink hover:text-brand"
              >
                {showAll ? '收起项目' : `展开更多 ${projects.length - 5} 个`}
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-10 text-center text-sm text-slate-500">
            当前筛选条件下暂无高匹配项目，放宽目标地区或专业关键词后重新生成。
          </div>
        )}
      </div>
    </section>
  );
}

function RecommendedProjectRow({ project }: { project: AiRecommendedProject }) {
  const href = buildNoticeDetailHref(project.id);
  const schoolName = getDisplaySchoolName(project.schoolName);
  const departmentName = getDisplayNoticeDepartment(project);

  return (
    <article className="grid grid-cols-[minmax(260px,1.25fr)_minmax(230px,1fr)_120px_140px_150px] items-center gap-4 bg-white px-5 py-4 transition hover:bg-slate-50/70">
      <div className="flex min-w-0 items-center gap-4">
        <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-brand/10 bg-brand/8 text-xl font-semibold text-brand">
          {getSchoolInitial(schoolName)}
        </span>
        <div className="min-w-0">
          <Link href={href} className="block truncate text-base font-semibold text-ink hover:text-brand">
            {schoolName}
          </Link>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[project.schoolRange, project.projectType, project.discipline].filter(Boolean).slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <Link href={href} className="block truncate text-sm font-semibold text-ink hover:text-brand">
          {normalizeNoticeTitle(project.projectName, 42)}
        </Link>
        <div className="mt-1 truncate text-xs text-slate-500">{departmentName}</div>
      </div>

      <div>
        <span className={`inline-flex rounded-xl px-3 py-1 text-xs font-semibold ${getTierTone(project.tier)}`}>{project.tier}</span>
        <div className="mt-2 text-xs text-slate-500">{project.fitLabel}</div>
      </div>

      <div>
        <div className="text-xs text-slate-500">匹配度</div>
        <div className="mt-1 text-xl font-semibold text-ink">{project.score}%</div>
      </div>

      <div className="grid gap-2">
        <div>
          <div className="text-xs text-slate-500">申请截止</div>
          <div className="mt-1 text-sm font-semibold text-ink">{formatNoticeDateOnly(project.deadlineDate) || '待确认'}</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {project.daysLeft === null ? '官网待补充' : project.daysLeft <= 0 ? '今天截止' : `剩余 ${project.daysLeft} 天`}
          </div>
        </div>
        <div className="grid gap-2">
          <ApplicationActionButton projectId={project.id} variant="secondary" label="加入申请表" addedLabel="已在清单" />
          <Link href={href} className="inline-flex justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-brand/30 hover:text-brand">
            查看通知
          </Link>
        </div>
      </div>
    </article>
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

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <div className="mb-2 text-sm font-semibold text-slate-600">{label}</div>
      {children}
    </label>
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

function formatPriority(priority: 'high' | 'medium' | 'low') {
  if (priority === 'high') return '高';
  if (priority === 'low') return '低';
  return '中';
}

function getInsightTone(tone: string) {
  if (tone === 'danger') return 'bg-rose-50 text-rose-600';
  if (tone === 'warning') return 'bg-amber-50 text-amber-700';
  if (tone === 'safe') return 'bg-emerald-50 text-brand';
  return 'bg-slate-100 text-slate-500';
}

function getSchoolInitial(name: string) {
  return name.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '').slice(0, 1) || '校';
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
