'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Bell,
  Bug,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Compass,
  Copy,
  ExternalLink,
  EyeOff,
  FileStack,
  FolderKanban,
  Info,
  Keyboard,
  Library,
  Lightbulb,
  ListChecks,
  MessageCircle,
  Search,
  ShieldCheck,
  UsersRound,
  X,
  type LucideIcon
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react';
import { useAccessibleModal } from '@/hooks/use-accessible-modal';
import { QQ_GROUP_NUMBER } from '@/lib/contact';
import { applicationJourneyStages } from '@/lib/desktop-application-flow';
import styles from './guide.module.css';

export type GuideSectionId =
  | 'quick-start'
  | 'application-flow'
  | 'core-modules'
  | 'materials-reminders'
  | 'trust-boundary'
  | 'shortcuts'
  | 'common-questions';

type GuideTone = 'teal' | 'blue' | 'violet' | 'amber' | 'cyan' | 'slate' | 'orange';

export type GuideNavItem = {
  id: GuideSectionId;
  label: string;
  title: string;
  description: string;
  keywords: string;
  tone: GuideTone;
  icon: LucideIcon;
};

export const guideNavigation: GuideNavItem[] = [
  {
    id: 'quick-start',
    label: '快速开始',
    title: '从第一条申请开始',
    description: '按四个步骤找到项目、核对信息并进入申请管理。',
    keywords: '第一次 上手 通知 加入申请 今日事项',
    tone: 'teal',
    icon: Compass
  },
  {
    id: 'application-flow',
    label: '申请推进',
    title: '用下一步驱动申请进度',
    description: '理解七个申请阶段，每次只处理当前最重要的一个行动。',
    keywords: '进度 阶段 发现 关注 材料 提交 面试 结果',
    tone: 'blue',
    icon: ListChecks
  },
  {
    id: 'core-modules',
    label: '功能地图',
    title: '四个核心功能如何分工',
    description: '全部申请负责决策，日程与导师联系负责执行，资源中心负责查找工具。',
    keywords: '全部申请 日程提醒 导师联系 资源中心 隐藏截止',
    tone: 'violet',
    icon: FolderKanban
  },
  {
    id: 'materials-reminders',
    label: '材料与提醒',
    title: '材料版本与截止提醒要分别确认',
    description: '材料管理降低误交风险，提醒帮你看见节点，但两者都不代替学校正式要求。',
    keywords: '材料清单 版本 提交状态 截止 导师跟进 Windows横幅',
    tone: 'amber',
    icon: Bell
  },
  {
    id: 'trust-boundary',
    label: '数据与安全',
    title: '使用前需要知道的数据边界',
    description: '寻鹿帮助整理与推进申请，不代替学校正式要求和你的最终判断。',
    keywords: '学校页面 报名系统 通知正文 报名入口 本机保存',
    tone: 'cyan',
    icon: ShieldCheck
  },
  {
    id: 'shortcuts',
    label: '快捷键',
    title: '高频操作可以直接用键盘完成',
    description: '掌握搜索、新建、设置和界面导航快捷键，减少鼠标往返。',
    keywords: '键盘 Ctrl F1 F6 Alt Esc 搜索 新建 设置',
    tone: 'slate',
    icon: Keyboard
  },
  {
    id: 'common-questions',
    label: '常见问题',
    title: '先确认数据是否仍在，再判断问题来源',
    description: '这里集中回答筛选、截止时间、Windows 提醒和本机数据问题。',
    keywords: '问题 FAQ 隐藏截止 时间不一致 没有提醒 换电脑 反馈',
    tone: 'orange',
    icon: CircleHelp
  }
];

const guideSectionIds = new Set<string>(guideNavigation.map((item) => item.id));

const quickActions = [
  { label: '查找通知', href: '/notices', icon: Search },
  { label: '打开全部申请', href: '/', icon: FolderKanban },
  { label: '查看日程', href: '/me?view=schedule', icon: CalendarDays }
] as const;

const firstApplicationSteps = [
  {
    title: '先在通知库找到项目',
    description: '按学校、学院或项目关键词筛选，优先处理截止时间更近的通知。',
    action: '进入通知库',
    href: '/notices',
    icon: Search
  },
  {
    title: '核对学校页面与报名入口',
    description: '确认截止时间、材料要求和报名方式；正式提交以学校页面与报名系统为准。',
    action: '查看数据说明',
    href: '/data-quality',
    icon: ExternalLink
  },
  {
    title: '加入全部申请',
    description: '在通知详情中加入申请，项目会进入桌面端申请列表统一推进。',
    action: '打开全部申请',
    href: '/',
    icon: FolderKanban
  },
  {
    title: '只处理当前最该做的事',
    description: '先完成项目顶部给出的主要行动，再继续材料、日程或导师联系。',
    action: '查看今日事项',
    href: '/todos',
    icon: CheckCircle2
  }
] as const;

const primaryActions = [
  '核对截止时间与报名入口',
  '补齐成绩单或推荐信',
  '记录提交状态',
  '更新导师联系进展'
] as const;

const coreModules = [
  {
    title: '全部申请',
    description: '集中查看项目状态、下一步、材料完成度和截止节点。',
    href: '/',
    tone: 'teal',
    icon: FolderKanban
  },
  {
    title: '日程提醒',
    description: '把申请截止、材料准备和面试等关键节点放进同一份日程。',
    href: '/me?view=schedule',
    tone: 'amber',
    icon: CalendarDays
  },
  {
    title: '导师联系',
    description: '记录联系渠道、当前状态、沟通结果和下一次跟进日期。',
    href: '/me?view=contacts',
    tone: 'blue',
    icon: UsersRound
  },
  {
    title: '资源中心',
    description: '查找材料模板、学术工具和常用官方入口。',
    href: '/resources',
    tone: 'violet',
    icon: Library
  }
] as const;

const materialFacts = [
  ['材料要求', '区分必交、可选和待确认，避免把不适用材料加入当前项目。'],
  ['版本信息', '记录版本备注与最近修改时间；版本备注只保存在当前设备。'],
  ['提交状态', '标记是否已提交，以及提交后是否还能修改，防止覆盖最终版本。'],
  ['材料包清单', '按当前项目生成材料包清单，提交前仍需逐项核对学校要求。']
] as const;

const reminderFacts = [
  ['截止节点', '日程和项目详情会持续显示；已截止项目不会因此自动删除。'],
  ['导师跟进', '设置下一次联系日期后，可在导师联系页和提醒中心继续处理。'],
  ['Windows 横幅', '仅在寻鹿运行期间请求发送；提醒中心中的内容会继续保留。']
] as const;

const trustFacts = [
  {
    title: '学校页面是最终依据',
    description: '正式报名、材料要求、截止时间和结果确认，请在提交前再次核对学校页面与报名系统。'
  },
  {
    title: '通知正文与报名入口不是同一个入口',
    description: '完整通知用于理解要求，报名入口可能是学校系统、第三方系统或问卷，请分别核对。'
  },
  {
    title: '部分偏好只保存在当前设备',
    description: '资源收藏、最近使用和材料版本备注不会作为跨设备同步数据，请勿把本机备注当作唯一备份。'
  }
] as const;

const shortcuts = [
  ['搜索全部功能', 'Ctrl + K / F1'],
  ['搜索当前列表', 'Ctrl + F'],
  ['在可新增页面新建内容', 'Ctrl + N'],
  ['打开设置', 'Ctrl + ,'],
  ['后退 / 前进', 'Alt + ← / →'],
  ['在界面区域间移动焦点', 'F6 / Shift + F6'],
  ['查看全部快捷键', 'Ctrl + /'],
  ['关闭当前面板', 'Esc']
] as const;

export const commonQuestions = [
  {
    question: '如何手动添加一条申请？',
    answer: '打开“全部申请”，点击左上角的“添加”，填写学校、学院、项目名称和截止时间后保存。手动添加的项目与从通知库加入的项目一样可以维护材料和状态。'
  },
  {
    question: '隐藏已截止项目会删除申请吗？',
    answer: '不会。它只隐藏列表中已经截止的项目，关闭开关后可以重新看到，项目记录和材料状态不会被删除。'
  },
  {
    question: '材料完成状态保存在哪里？',
    answer: '材料勾选状态会跟随当前申请记录保存。材料版本备注和资源收藏目前属于本机偏好，换电脑前请自行备份重要文件。'
  },
  {
    question: '如何检查和安装软件更新？',
    answer: '打开左下角“设置”，进入“关于与更新”中的“软件更新”。检查到新版本后可在 App 内下载，下载完成后按提示重启安装。'
  },
  {
    question: '为什么通知里的时间与学校页面不一致？',
    answer: `通知可能在发布后调整。请以学校页面和报名系统的最新要求为准，并在 QQ 群 ${QQ_GROUP_NUMBER} 说明需要核对的内容。`
  },
  {
    question: 'Windows 没有弹出提醒，是不是日程丢了？',
    answer: '不一定。Windows 横幅仅在寻鹿运行期间请求发送；请先打开提醒中心或日程确认事项是否仍在，再检查系统通知权限。'
  },
  {
    question: '换一台电脑后，为什么看不到资源收藏或材料版本备注？',
    answer: '这两类信息目前属于当前设备的本机偏好，不会随账号跨设备同步。重要材料请自行保留可靠备份。'
  }
] as const;

export const featuredGuideIds: GuideSectionId[] = ['quick-start', 'application-flow', 'common-questions'];

const supportIssueTypes = [
  { label: '信息错误', icon: Info },
  { label: '功能异常', icon: Bug },
  { label: '使用建议', icon: Lightbulb },
  { label: '账号问题', icon: UsersRound }
] as const;

const supportSuggestions: Record<(typeof supportIssueTypes)[number]['label'], GuideSectionId[]> = {
  信息错误: ['trust-boundary', 'common-questions'],
  功能异常: ['common-questions', 'shortcuts'],
  使用建议: ['quick-start', 'core-modules'],
  账号问题: ['trust-boundary', 'common-questions']
};

function CopyQqGroupButton() {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  const copyGroupNumber = async () => {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(QQ_GROUP_NUMBER);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }

    resetTimerRef.current = window.setTimeout(() => {
      setCopyState('idle');
      resetTimerRef.current = null;
    }, 3200);
  };

  const buttonLabel = copyState === 'copied' ? '已复制群号' : copyState === 'failed' ? '复制失败' : '复制群号';
  const statusMessage =
    copyState === 'copied'
      ? `QQ群号 ${QQ_GROUP_NUMBER} 已复制。`
      : copyState === 'failed'
        ? `未能写入剪贴板，请手动选择群号 ${QQ_GROUP_NUMBER}。`
        : '';

  return (
    <span className={`${styles.copyGroupControl} desktop-guide-copy-group`}>
      <button
        type="button"
        onClick={() => void copyGroupNumber()}
        aria-label={`复制 QQ 群号 ${QQ_GROUP_NUMBER}`}
      >
        <Copy aria-hidden="true" />
        {buttonLabel}
      </button>
      <span className={styles.copyStatus} role="status" aria-live="polite">
        {statusMessage}
      </span>
    </span>
  );
}

export function SupportDrawer({
  onClose,
  onOpenTopic
}: {
  onClose: () => void;
  onOpenTopic?: (id: GuideSectionId) => void;
}) {
  const [issueType, setIssueType] = useState<(typeof supportIssueTypes)[number]['label']>('功能异常');
  const [supportStage, setSupportStage] = useState<'suggestions' | 'template'>('suggestions');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const resetTimerRef = useRef<number | null>(null);
  const supportBodyRef = useRef<HTMLDivElement>(null);
  const supportTemplatePreviewRef = useRef<HTMLTextAreaElement>(null);
  const { dialogRef, overlayRef, handleModalKeyDown } = useAccessibleModal(onClose);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (supportStage !== 'template') return;
    window.requestAnimationFrame(() => {
      supportBodyRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      supportTemplatePreviewRef.current?.focus({ preventScroll: true });
    });
  }, [supportStage]);

  const theme = document.documentElement.dataset.desktopTheme || '系统';
  const zoom = document.documentElement.dataset.desktopZoomLevel || '100';
  const route = window.location.pathname + window.location.search;
  const platform = navigator.platform || 'Windows';
  const feedbackTemplate = `【问题类型】${issueType}\n【所在页面】${route}\n【执行的操作】\n【预期结果】\n【实际结果】\n【补充说明】\n\n环境：${platform}，${theme} 主题，UI 缩放 ${zoom}%`;
  const suggestedItems = supportSuggestions[issueType]
    .map((id) => guideNavigation.find((item) => item.id === id))
    .filter((item): item is GuideNavItem => Boolean(item));

  const copyFeedbackTemplate = async () => {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(feedbackTemplate);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }

    resetTimerRef.current = window.setTimeout(() => {
      setCopyState('idle');
      resetTimerRef.current = null;
    }, 3200);
  };

  return createPortal(
    <div
      ref={overlayRef}
      className="desktop-guide-support-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="desktop-guide-support-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="desktop-guide-support-title"
        tabIndex={-1}
        onKeyDown={handleModalKeyDown}
      >
        <header className="desktop-guide-support-header">
          <span className="desktop-guide-support-icon" aria-hidden="true">
            <MessageCircle />
          </span>
           <div>
             <h2 id="desktop-guide-support-title">联系支持</h2>
             <p>{supportStage === 'suggestions' ? '先尝试相关帮助，仍未解决再准备反馈。' : '复制模板后，补全问题细节并发送。'}</p>
          </div>
          <button type="button" aria-label="关闭联系支持" onClick={onClose} data-modal-initial-focus>
            <X aria-hidden="true" />
          </button>
        </header>

        <div ref={supportBodyRef} className="desktop-guide-support-body">
          {supportStage === 'suggestions' ? (
            <section aria-labelledby="desktop-guide-issue-type-title">
              <div className="desktop-guide-support-section-heading">
                <h3 id="desktop-guide-issue-type-title">选择问题类型</h3>
                <span>用于让反馈更容易被定位</span>
              </div>
              <div className="desktop-guide-issue-types">
                {supportIssueTypes.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      aria-pressed={issueType === item.label}
                      onClick={() => setIssueType(item.label)}
                    >
                      <Icon aria-hidden="true" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : (
            <div className="desktop-guide-selected-issue">
              <span>问题类型</span>
              <strong>{issueType}</strong>
              <button type="button" onClick={() => setSupportStage('suggestions')}>重新选择</button>
            </div>
          )}

          {supportStage === 'suggestions' ? (
            <section aria-labelledby="desktop-guide-suggestions-title">
              <div className="desktop-guide-support-section-heading">
                <h3 id="desktop-guide-suggestions-title">可能有用的帮助</h3>
                <span>先查看与当前问题最相关的内容</span>
              </div>
              <div className="desktop-guide-support-suggestions">
                {suggestedItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.id} type="button" onClick={() => onOpenTopic ? onOpenTopic(item.id) : onClose()}>
                      <span aria-hidden="true"><Icon /></span>
                      <span><strong>{item.label}</strong><small>{item.description}</small></span>
                      <ArrowRight aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
              <div className="desktop-guide-support-note">
                <ShieldCheck aria-hidden="true" />
                <p>如果帮助内容仍无法解决，再进入下一步准备反馈。内容不会自动上传。</p>
              </div>
            </section>
          ) : (
            <>
              <section aria-labelledby="desktop-guide-template-title">
                <div className="desktop-guide-support-section-heading">
                  <h3 id="desktop-guide-template-title">反馈模板</h3>
                  <span>复制后补全操作、预期结果和实际结果</span>
                </div>
                <textarea ref={supportTemplatePreviewRef} readOnly value={feedbackTemplate} aria-label="反馈模板预览" />
              </section>

              <details className="desktop-guide-environment-details">
                <summary>将附带当前页面、系统、主题和 UI 缩放信息<ChevronDown aria-hidden="true" /></summary>
                <dl className="desktop-guide-diagnostics">
                  <div><dt>页面</dt><dd>{route}</dd></div>
                  <div><dt>主题</dt><dd>{theme}</dd></div>
                  <div><dt>UI 缩放</dt><dd>{zoom}%</dd></div>
                  <div><dt>系统</dt><dd>{platform}</dd></div>
                </dl>
              </details>

              <div className="desktop-guide-support-note">
                <ShieldCheck aria-hidden="true" />
                <p>内容不会自动上传。请复制后在 QQ 群 <b>{QQ_GROUP_NUMBER}</b> 发送；数据错误请附学校页面或截图。</p>
              </div>
            </>
          )}
        </div>

        <footer className="desktop-guide-support-footer">
          <div>
            <span role="status" aria-live="polite">
              {copyState === 'copied'
                ? '反馈模板已复制。'
                : copyState === 'failed'
                  ? '复制失败，请手动选中模板。'
                  : ''}
            </span>
            {supportStage === 'template' ? (
              <button type="button" className="desktop-guide-support-back" onClick={() => setSupportStage('suggestions')}>
                返回相关帮助
              </button>
            ) : (
              <CopyQqGroupButton />
            )}
          </div>
          {supportStage === 'suggestions' ? (
            <button type="button" className="desktop-guide-copy-template" onClick={() => setSupportStage('template')}>
              仍未解决，准备反馈
              <ArrowRight aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className="desktop-guide-copy-template" onClick={() => void copyFeedbackTemplate()}>
              <Copy aria-hidden="true" />
              {copyState === 'copied' ? '已复制模板' : '复制反馈内容'}
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body
  );
}

export function GuideTopicContent({
  sectionId,
  openQuestion
}: {
  sectionId: GuideSectionId;
  openQuestion?: string | null;
}) {
  if (sectionId === 'quick-start') {
    return (
      <ol className={`${styles.startSteps} desktop-guide-start-steps`}>
        {firstApplicationSteps.map((step) => {
          const Icon = step.icon;
          return (
            <li key={step.title}>
              <span className={`${styles.rowIcon} desktop-guide-row-icon`}><Icon aria-hidden="true" /></span>
              <div className={styles.rowCopy}>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
              <Link href={step.href} className={styles.rowAction}>
                {step.action}
                <ArrowRight aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ol>
    );
  }

  if (sectionId === 'application-flow') {
    return (
      <>
        <ol className={`${styles.stageTrack} desktop-guide-stage-track`} aria-label="申请进度阶段">
          {applicationJourneyStages.map((stage, index) => (
            <li key={stage}>
              <span>{index + 1}</span>
              <strong>{stage}</strong>
            </li>
          ))}
        </ol>

        <div className={`${styles.nextActionPanel} desktop-guide-next-action`}>
          <div className={styles.nextActionCopy}>
            <span className={`${styles.rowIcon} desktop-guide-row-icon`}><CheckCircle2 aria-hidden="true" /></span>
            <div>
              <strong>项目顶部只突出一个主要行动</strong>
              <p>完成后再进入下一步，减少在多个页面之间来回判断。</p>
            </div>
          </div>
          <ul>
            {primaryActions.map((action) => <li key={action}>{action}</li>)}
          </ul>
        </div>
      </>
    );
  }

  if (sectionId === 'core-modules') {
    return (
      <>
        <ul className={`${styles.moduleList} desktop-guide-module-list`}>
          {coreModules.map((module) => {
            const Icon = module.icon;
            return (
              <li key={module.title} data-guide-tone={module.tone}>
                <Link href={module.href} className={`${styles.moduleRow} desktop-guide-module-card`}>
                  <span className={`${styles.rowIcon} desktop-guide-row-icon`}><Icon aria-hidden="true" /></span>
                  <div className={styles.rowCopy}>
                    <h3>{module.title}</h3>
                    <p>{module.description}</p>
                  </div>
                  <span className={styles.openLabel}>打开<ArrowRight aria-hidden="true" /></span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className={`${styles.hideExpiredHint} desktop-guide-hide-expired`}>
          <EyeOff aria-hidden="true" />
          <div>
            <strong>只看仍需处理的项目</strong>
            <p>在全部申请的筛选区开启“隐藏截止项目”。它只改变当前列表显示，不会删除申请记录。</p>
          </div>
          <Link href="/">打开全部申请<ArrowRight aria-hidden="true" /></Link>
        </div>
      </>
    );
  }

  if (sectionId === 'materials-reminders') {
    return (
      <div className={`${styles.twoColumnFacts} desktop-guide-fact-columns`}>
        <div className={styles.factGroup} data-guide-tone="violet">
          <div className={styles.factGroupHeading}>
            <FileStack aria-hidden="true" />
            <div><h3>材料管理</h3><span>项目级清单与版本信息</span></div>
          </div>
          <dl>
            {materialFacts.map(([term, description]) => (
              <div key={term}><dt>{term}</dt><dd>{description}</dd></div>
            ))}
          </dl>
        </div>

        <div className={styles.factGroup} data-guide-tone="amber">
          <div className={styles.factGroupHeading}>
            <Bell aria-hidden="true" />
            <div><h3>日程与提醒</h3><span>节点持续可见，横幅受系统限制</span></div>
          </div>
          <dl>
            {reminderFacts.map(([term, description]) => (
              <div key={term}><dt>{term}</dt><dd>{description}</dd></div>
            ))}
          </dl>
          <Link href="/me?view=schedule" className={styles.inlineAction}>
            打开日程提醒<ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  if (sectionId === 'trust-boundary') {
    return (
      <>
        <div className={`${styles.trustList} desktop-guide-trust-list`}>
          {trustFacts.map((fact, index) => (
            <article key={fact.title}>
              <span>{index + 1}</span>
              <div><h3>{fact.title}</h3><p>{fact.description}</p></div>
            </article>
          ))}
        </div>

        <div className={`${styles.boundaryAction} desktop-guide-boundary-action`}>
          <ShieldCheck aria-hidden="true" />
          <p>发现截止时间、入口或材料要求有误时，请保留学校页面，并在 QQ 群说明页面和问题。</p>
          <Link href="/data-quality">查看数据说明<ArrowRight aria-hidden="true" /></Link>
        </div>
      </>
    );
  }

  if (sectionId === 'shortcuts') {
    return (
      <dl className={`${styles.shortcutList} desktop-guide-shortcut-list`}>
        {shortcuts.map(([label, keys]) => (
          <div key={label}><dt>{label}</dt><dd><kbd>{keys}</kbd></dd></div>
        ))}
      </dl>
    );
  }

  return (
    <div className={`${styles.faqList} desktop-guide-faq-list`}>
      {commonQuestions.map((item) => (
        <details key={item.question} open={openQuestion === item.question}>
          <summary>{item.question}<ChevronDown aria-hidden="true" /></summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

export default function DesktopGuide() {
  const [activeSection, setActiveSection] = useState<GuideSectionId>('quick-start');
  const [query, setQuery] = useState('');
  const [supportOpen, setSupportOpen] = useState(false);
  const topicPanelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const syncSectionFromHash = (focusPanel: boolean) => {
      const hash = window.location.hash.slice(1);
      if (!guideSectionIds.has(hash)) return;
      setActiveSection(hash as GuideSectionId);

      if (focusPanel) {
        window.requestAnimationFrame(() => topicPanelRef.current?.focus({ preventScroll: true }));
      }
    };

    syncSectionFromHash(Boolean(window.location.hash));
    const handleHashChange = () => syncSectionFromHash(true);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
  const visibleNavigation = useMemo(() => {
    if (!normalizedQuery) return guideNavigation;
    return guideNavigation.filter((item) =>
      [item.label, item.title, item.description, item.keywords]
        .join(' ')
        .toLocaleLowerCase('zh-CN')
        .includes(normalizedQuery)
    );
  }, [normalizedQuery]);

  useEffect(() => {
    if (!normalizedQuery || visibleNavigation.length === 0) return;
    if (visibleNavigation.some((item) => item.id === activeSection)) return;

    const nextId = visibleNavigation[0].id;
    setActiveSection(nextId);
    window.history.replaceState(window.history.state, '', `#${nextId}`);
  }, [activeSection, normalizedQuery, visibleNavigation]);

  const activeItem = guideNavigation.find((item) => item.id === activeSection) ?? guideNavigation[0];
  const activeIndex = guideNavigation.findIndex((item) => item.id === activeItem.id);
  const activeTabVisible = visibleNavigation.some((item) => item.id === activeItem.id);
  const ActiveIcon = activeItem.icon;

  const activateSection = (id: GuideSectionId, focusPanel: boolean) => {
    setActiveSection(id);
    window.history.replaceState(window.history.state, '', `#${id}`);
    if (focusPanel) {
      window.requestAnimationFrame(() => topicPanelRef.current?.focus({ preventScroll: true }));
    }
  };

  const handleTopicKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, id: GuideSectionId) => {
    if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();

    const items = visibleNavigation.length > 0 ? visibleNavigation : guideNavigation;
    const index = Math.max(0, items.findIndex((item) => item.id === id));
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : event.key === 'ArrowDown' || event.key === 'ArrowRight'
            ? (index + 1) % items.length
            : (index - 1 + items.length) % items.length;
    const nextItem = items[nextIndex];
    activateSection(nextItem.id, false);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-guide-tab="${nextItem.id}"]`)?.focus();
    });
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={`desktop-route-content desktop-core-page desktop-core-page--scroll desktop-guide-page desktop-guide-center outline-none ${styles.guidePage}`}
      aria-labelledby="desktop-guide-title"
    >
      <header className={`${styles.pageHeader} desktop-core-page-header desktop-guide-hero`}>
        <div className={`${styles.headerCopy} desktop-guide-hero-copy`}>
          <span className="desktop-guide-hero-icon" aria-hidden="true"><CircleHelp /></span>
          <span>
            <h1 id="desktop-guide-title">帮助与反馈</h1>
            <p>按使用任务查找答案，需要人工帮助时生成可复制的反馈信息。</p>
          </span>
        </div>
        <div className="desktop-guide-hero-meta">
          <span className="desktop-guide-topic-total"><strong>{guideNavigation.length}</strong> 个主题</span>
          <button type="button" className="desktop-guide-support-trigger" onClick={() => setSupportOpen(true)}>
            <MessageCircle aria-hidden="true" />
            联系支持
          </button>
        </div>
      </header>

      <section className="desktop-guide-toolbar" aria-label="搜索帮助与快速前往">
        <label className="desktop-guide-search" htmlFor="desktop-guide-search-input">
          <Search aria-hidden="true" />
          <input
            id="desktop-guide-search-input"
            type="search"
            value={query}
            autoComplete="off"
            placeholder="搜索帮助主题、功能或问题"
            onChange={(event) => setQuery(event.target.value)}
          />
          {query ? (
            <button type="button" aria-label="清空帮助搜索" onClick={() => setQuery('')}>
              <X aria-hidden="true" />
            </button>
          ) : (
            <span>{guideNavigation.length} 个主题</span>
          )}
        </label>

        <nav className={`${styles.quickActions} desktop-guide-quick-actions`} aria-label="帮助页快速前往">
          {quickActions.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} href={item.href} className={`${styles.quickAction} desktop-guide-quick-action`}>
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
                <ArrowRight aria-hidden="true" />
              </Link>
            );
          })}
        </nav>
      </section>

      <div className={`${styles.guideWorkspace} desktop-guide-workspace`}>
        <aside className={`${styles.guideSidebar} desktop-guide-sidebar`}>
          <div className={`${styles.sidebarHeading} desktop-guide-sidebar-heading`}>
            <div><strong>帮助主题</strong><span>预计 5 分钟了解核心流程</span></div>
            <ListChecks aria-hidden="true" />
          </div>

          <nav
            className={`${styles.sectionNavigation} desktop-guide-topic-list`}
            role="tablist"
            aria-label="帮助与反馈主题"
            aria-orientation="vertical"
          >
            {visibleNavigation.length > 0 ? (
              visibleNavigation.map((item) => {
                const Icon = item.icon;
                const selected = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    id={`desktop-guide-tab-${item.id}`}
                    type="button"
                    role="tab"
                    data-guide-tab={item.id}
                    data-guide-tone={item.tone}
                    className={`desktop-guide-topic ${selected ? 'desktop-guide-topic--active' : ''}`}
                    aria-selected={selected}
                    aria-controls={`desktop-guide-panel-${item.id}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => activateSection(item.id, true)}
                    onKeyDown={(event) => handleTopicKeyDown(event, item.id)}
                  >
                    <span aria-hidden="true"><Icon /></span>
                    <span>{item.label}</span>
                    <ArrowRight aria-hidden="true" />
                  </button>
                );
              })
            ) : (
              <div className="desktop-guide-search-empty" role="status">
                <Search aria-hidden="true" />
                <strong>没有找到匹配主题</strong>
                <span>换一个功能名称或问题关键词试试。</span>
              </div>
            )}
          </nav>

          <div className={`${styles.sidebarSupport} desktop-guide-sidebar-support`}>
            <MessageCircle aria-hidden="true" />
            <div>
              <strong>仍然没有解决？</strong>
              <span>生成反馈模板，并复制 QQ 群号联系支持。</span>
            </div>
            <button type="button" onClick={() => setSupportOpen(true)}>联系支持<ArrowRight aria-hidden="true" /></button>
          </div>
        </aside>

        <section
          ref={topicPanelRef}
          id={`desktop-guide-panel-${activeItem.id}`}
          className={`${styles.guideContent} desktop-guide-topic-panel`}
          data-guide-tone={activeItem.tone}
          role="tabpanel"
          aria-labelledby={activeTabVisible ? `desktop-guide-tab-${activeItem.id}` : undefined}
          aria-label={activeTabVisible ? undefined : activeItem.title}
          tabIndex={-1}
        >
          <header className="desktop-guide-topic-header">
            <span className="desktop-guide-topic-icon" aria-hidden="true"><ActiveIcon /></span>
            <div>
              <span>主题 {activeIndex + 1} / {guideNavigation.length}</span>
              <h2>{activeItem.title}</h2>
              <p>{activeItem.description}</p>
            </div>
          </header>
          <div className={`${styles.guideSection} desktop-guide-topic-body`}>
            <GuideTopicContent sectionId={activeItem.id} />
          </div>
        </section>
      </div>

      {supportOpen ? <SupportDrawer onClose={() => setSupportOpen(false)} /> : null}
    </main>
  );
}
