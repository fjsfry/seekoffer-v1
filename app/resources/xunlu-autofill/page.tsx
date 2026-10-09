import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Cloud,
  CopyCheck,
  Eye,
  FileCheck2,
  FileLock2,
  FormInput,
  KeyRound,
  Laptop,
  Layers3,
  ListChecks,
  LockKeyhole,
  MousePointerClick,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  type LucideIcon
} from 'lucide-react';
import { SiteShell } from '@/components/site-shell';
import { buildPageMetadata, jsonLdScript } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: '寻鹿闪填｜保研报名页信息填充助手',
  description:
    '寻鹿闪填是面向保研夏令营、预推免与推免报名页的 Chrome / Edge 扩展，按“识别—核对—选择—填入”复用申请信息，绝不自动提交。',
  path: '/resources/xunlu-autofill'
});

const workflowSteps = [
  {
    step: '01',
    title: '先整理申请档案',
    description: '在浏览器中维护身份、教育、成绩、科研、论文、获奖和申请方向等高频信息。',
    icon: Layers3
  },
  {
    step: '02',
    title: '打开学校报名页',
    description: '由你本人完成学校登录并展开要填写的表单步骤，插件不会绕过账号或验证码。',
    icon: Laptop
  },
  {
    step: '03',
    title: '识别并逐项核对',
    description: '点击扩展后才扫描当前页可见表单，并展示字段来源、匹配置信度与已有内容。',
    icon: Eye
  },
  {
    step: '04',
    title: '只填入你勾选的内容',
    description: '选择确认无误的字段后再填入；验证码、附件、志愿选择和最终提交仍由你完成。',
    icon: CopyCheck
  }
] as const;

const capabilities: Array<{
  title: string;
  description: string;
  detail: string;
  icon: LucideIcon;
  tone: string;
}> = [
  {
    title: '结构化申请档案',
    description: '把反复出现的信息整理一次，在不同报名页中按需复用。',
    detail: '覆盖基础信息及教育、科研、论文、专利、获奖、实践、学生工作和家庭联系人等记录。',
    icon: Layers3,
    tone: 'bg-emerald-50 text-brand'
  },
  {
    title: '可见表单智能识别',
    description: '只在你主动打开侧边栏后，识别当前标签页的可见表单。',
    detail: '支持文本、多行文本、原生单选、下拉、日期和部分常见复杂组件。',
    icon: FormInput,
    tone: 'bg-sky-50 text-sky-600'
  },
  {
    title: '人工核对优先',
    description: '每个候选字段都先展示，再由你选择是否填入。',
    detail: '低置信、歧义、已有内容和高敏感字段会被明确标记，不会静默处理。',
    icon: ListChecks,
    tone: 'bg-violet-50 text-violet-600'
  },
  {
    title: '已有内容保护',
    description: '页面中已经填写的内容默认不覆盖，降低误改风险。',
    detail: '证件号、学号和详细地址等高敏感字段每次使用都需要重新授权。',
    icon: FileLock2,
    tone: 'bg-amber-50 text-amber-700'
  },
  {
    title: '本轮填入可撤销',
    description: '页面未刷新或跳转前，可以撤销当前一轮填入。',
    detail: '撤销是复核辅助，不替代提交前逐项检查，也不能跨页面恢复。',
    icon: RotateCcw,
    tone: 'bg-cyan-50 text-cyan-700'
  },
  {
    title: '可选加密云备份',
    description: '登录寻鹿账号后，可由用户主动使用 Pro 云保险箱。',
    detail: '档案先加密再备份；保险箱口令由你保管，只有主动开启备份时才会保存。',
    icon: Cloud,
    tone: 'bg-teal-50 text-teal-700'
  }
];

const supportedActions = [
  '点击扩展后，临时读取当前页可见表单结构',
  '展示字段来源、匹配置信度、敏感状态与页面已有值',
  '只填入用户主动勾选并确认的字段',
  '在页面未刷新或跳转前撤销本轮填入',
  '由用户主动导出脱敏兼容报告并自行检查'
];

const excludedActions = [
  '不读取密码、验证码、附件内容或网站登录凭据',
  '不绕过登录、验证码、访问控制或学校安全机制',
  '不点击保存、下一步、确认或最终提交',
  '不默认覆盖页面中已经存在的内容',
  '不把通用识别包装成“所有高校都已兼容”'
];

const faqs = [
  {
    question: '它会自动提交报名吗？',
    answer: '不会。寻鹿闪填只负责把你确认过的字段填入页面，不会点击保存、下一步、确认或提交。最后检查与提交必须由本人完成。'
  },
  {
    question: '档案会自动同步吗？',
    answer: '不会。档案默认保存在当前浏览器中；只有你登录后主动开启备份，才会进行加密同步。'
  },
  {
    question: '是否支持所有高校报名系统？',
    answer: '不能这样承诺。学校页面会持续变化，登录后流程也可能不同。插件会按当前页面证据提示公开结构、专用规则、通用识别或未知站点；无法可靠处理时会要求手填。'
  },
  {
    question: '当前可以在哪些浏览器使用？',
    answer: '支持 Chrome 116+ 和基于 Chromium 的新版 Microsoft Edge，安装后即可按页面提示使用。'
  }
] as const;

const productJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: '寻鹿闪填',
  applicationCategory: 'BrowserApplication',
  operatingSystem: 'Chrome 116+; Microsoft Edge',
  softwareVersion: '1.12.0',
  description:
    '面向保研报名页的浏览器扩展，通过识别、核对、选择和填入减少重复录入，不自动提交。',
  isAccessibleForFree: true
};

function ExtensionWorkflowPreview() {
  const formRows = [
    { label: '姓名', value: '林小鹿', status: '已匹配' },
    { label: '本科学校', value: '示例大学', status: '已匹配' },
    { label: '申请方向', value: '人工智能', status: '需核对' },
    { label: '证件号码', value: '••••••••••••', status: '已锁定' }
  ];

  return (
    <div
      className="relative overflow-hidden rounded-[30px] border border-white/80 bg-white/82 p-3 shadow-[0_28px_80px_rgba(23,73,77,0.18)] backdrop-blur"
      aria-hidden="true"
    >
      <div className="flex h-9 items-center gap-2 rounded-t-[22px] border-b border-slate-100 bg-slate-50/90 px-4">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        <div className="ml-2 flex min-w-0 flex-1 items-center justify-center rounded-full bg-white px-3 py-1 text-[10px] font-medium text-slate-400">
          apply.example.edu.cn/profile
        </div>
      </div>

      <div className="grid min-h-[390px] gap-3 bg-[#f6f8f8] p-3 md:grid-cols-[minmax(0,1fr)_minmax(250px,0.82fr)]">
        <div className="rounded-[20px] border border-slate-100 bg-white p-4">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="text-[11px] font-semibold text-slate-400">申请信息</div>
              <div className="mt-1 text-sm font-bold text-slate-800">基本资料</div>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-semibold text-slate-500">第 2 步 / 4</span>
          </div>
          <div className="mt-4 space-y-3">
            {formRows.map((row) => (
              <div key={row.label}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px]">
                  <span className="font-semibold text-slate-500">{row.label}</span>
                  <span
                    className={
                      row.status === '已匹配'
                        ? 'text-emerald-600'
                        : row.status === '需核对'
                          ? 'text-amber-600'
                          : 'text-slate-400'
                    }
                  >
                    {row.status}
                  </span>
                </div>
                <div className="flex h-9 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] text-slate-500">
                  {row.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[20px] border border-brand/10 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
                <WandSparkles className="h-4 w-4" />
              </span>
              <div>
                <div className="text-xs font-bold text-slate-800">寻鹿闪填</div>
                <div className="text-[9px] text-slate-400">当前报名页</div>
              </div>
            </div>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              ['可见', '8'],
              ['匹配', '6'],
              ['需核对', '1']
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-50 px-2 py-2 text-center">
                <div className="text-base font-bold text-slate-800">{value}</div>
                <div className="text-[8px] text-slate-400">{label}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {formRows.slice(0, 3).map((row, index) => (
              <div key={row.label} className="flex items-center gap-2 rounded-xl border border-slate-100 px-2.5 py-2">
                <span
                  className={`inline-flex h-4 w-4 items-center justify-center rounded ${
                    index === 2 ? 'bg-amber-100 text-amber-700' : 'bg-brand text-white'
                  }`}
                >
                  {index === 2 ? <CircleAlert className="h-2.5 w-2.5" /> : <Check className="h-2.5 w-2.5" />}
                </span>
                <span className="min-w-0 flex-1 truncate text-[9px] font-medium text-slate-500">{row.label}</span>
                <span className="text-[8px] text-slate-400">{index === 2 ? '70%' : '98%'}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex h-10 items-center justify-center gap-2 rounded-xl bg-brand text-[10px] font-semibold text-white shadow-sm">
            <MousePointerClick className="h-3.5 w-3.5" />
            填入已选择字段
          </div>
          <div className="mt-2 text-center text-[8px] leading-4 text-slate-400">不会点击保存、下一步或提交</div>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl">
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-brand">{eyebrow}</div>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink md:text-4xl">{title}</h2>
      <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base md:leading-8">{description}</p>
    </div>
  );
}

export default function XunluAutofillPage() {
  return (
    <SiteShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(productJsonLd)} />

      <nav aria-label="面包屑" className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <Link href="/resources" className="inline-flex items-center gap-2 font-semibold text-brand transition hover:text-brand-deep">
          <ArrowLeft className="h-4 w-4" />
          资源库
        </Link>
        <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden="true" />
        <span aria-current="page">寻鹿闪填</span>
      </nav>

      <section className="relative overflow-hidden rounded-[36px] border border-brand/10 bg-[radial-gradient(circle_at_12%_8%,rgba(88,214,172,0.22),transparent_30%),radial-gradient(circle_at_90%_14%,rgba(79,132,255,0.16),transparent_34%),linear-gradient(135deg,#f3fbf7_0%,#ffffff_48%,#edf6fb_100%)] px-6 py-9 shadow-soft lg:px-10 lg:py-12">
        <div className="absolute -left-24 top-1/3 h-64 w-64 rounded-full bg-cyan-200/20 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-brand/10 blur-3xl" aria-hidden="true" />

        <div className="relative grid gap-10 xl:grid-cols-[minmax(0,0.86fr)_minmax(560px,1.14fr)] xl:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand px-3.5 py-2 text-xs font-semibold text-white shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                寻鹿自研浏览器扩展
              </span>
              <span className="rounded-full border border-brand/10 bg-white/82 px-3.5 py-2 text-xs font-semibold text-brand">
                v1.12.0
              </span>
            </div>

            <h1 className="mt-7 text-4xl font-semibold leading-[1.14] tracking-[-0.035em] text-ink md:text-5xl lg:text-[3.55rem]">
              把重复填表，变成
              <span className="mt-2 block bg-gradient-to-r from-brand via-emerald-600 to-sky-600 bg-clip-text text-transparent">
                一次整理、逐项确认
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 md:text-lg md:leading-9">
              寻鹿闪填面向保研夏令营、预推免和推免报名场景。先在浏览器中整理申请档案，再按“识别—核对—选择—填入”的流程复用信息，最后一步始终由你本人完成。
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#workflow"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(23,73,77,0.22)] transition hover:-translate-y-0.5 hover:bg-brand-deep focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20"
              >
                看看怎么使用
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                href="/pro"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-brand/15 bg-white/85 px-5 py-3 text-sm font-semibold text-brand shadow-sm transition hover:-translate-y-0.5 hover:border-brand/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15"
              >
                了解 Free 与 Pro
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-8 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              {['Chrome 116+ 与新版 Edge', '资料优先保存在浏览器，可选加密云备份', '只访问当前活动页面', '绝不自动提交报名'].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <ExtensionWorkflowPreview />
        </div>
      </section>

      <section aria-label="核心安全承诺" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { title: '资料可控', detail: '档案默认保存在当前浏览器', icon: Laptop },
          { title: '按需访问', detail: '点击扩展后才读取当前页', icon: MousePointerClick },
          { title: '逐项确认', detail: '只填入你主动选择的字段', icon: FileCheck2 },
          { title: '提交权归你', detail: '不点击保存、下一步或提交', icon: ShieldCheck }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="rounded-[24px] border border-slate-100 bg-white/92 p-5 shadow-sm">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/8 text-brand">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-base font-semibold text-ink">{item.title}</h2>
              <p className="mt-1.5 text-sm leading-6 text-slate-500">{item.detail}</p>
            </article>
          );
        })}
      </section>

      <section id="workflow" className="scroll-mt-24 rounded-[34px] border border-slate-100 bg-white p-6 shadow-soft lg:p-9">
        <SectionHeading
          eyebrow="Workflow"
          title="四步完成一次安全填入"
          description="寻鹿闪填把自动化停在合适的位置：帮你减少机械录入，但不替你登录、不替你决定，也不替你提交。"
        />

        <ol className="mt-8 grid gap-4 lg:grid-cols-4">
          {workflowSteps.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.step} className="relative overflow-hidden rounded-[26px] border border-slate-100 bg-slate-50/70 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold tracking-[0.16em] text-brand">STEP {item.step}</span>
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-brand shadow-sm">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <h3 className="mt-6 text-lg font-semibold text-ink">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section>
        <SectionHeading
          eyebrow="Capabilities"
          title="为保研报名场景设计的核心能力"
          description="从档案整理到页面核对，所有能力都围绕“可见、可控、可撤回”展开。遇到无法可靠判断的控件，插件会降级为提示或复制值。"
        />

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {capabilities.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="group rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/15 hover:shadow-soft">
                <span className={`inline-flex h-14 w-14 items-center justify-center rounded-[18px] p-3 ${item.tone}`}>
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-xl font-semibold text-ink">{item.title}</h3>
                <p className="mt-3 text-sm font-medium leading-7 text-slate-700">{item.description}</p>
                <p className="mt-3 text-sm leading-7 text-slate-500">{item.detail}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-[34px] border border-brand/10 bg-[linear-gradient(135deg,#f3faf7_0%,#ffffff_48%,#f3f7fb_100%)] p-6 shadow-soft lg:p-9">
        <SectionHeading
          eyebrow="Safety Boundary"
          title="自动化边界，从产品设计里就写清楚"
          description="插件的价值是减少重复输入，而不是绕过学校流程。任何自动匹配都不能替代你对姓名、专业、排名口径、日期和申请方向的最终核对。"
        />

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <article className="rounded-[28px] border border-emerald-100 bg-white/92 p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">Will do</div>
                <h3 className="mt-1 text-xl font-semibold text-ink">它会做什么</h3>
              </div>
            </div>
            <ul className="mt-6 space-y-3">
              {supportedActions.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-7 text-slate-600">
                  <Check className="mt-1.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-[28px] border border-rose-100 bg-white/92 p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
                <LockKeyhole className="h-6 w-6" />
              </span>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-rose-500">Will not do</div>
                <h3 className="mt-1 text-xl font-semibold text-ink">它明确不会做什么</h3>
              </div>
            </div>
            <ul className="mt-6 space-y-3">
              {excludedActions.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-7 text-slate-600">
                  <ShieldCheck className="mt-1.5 h-4 w-4 shrink-0 text-rose-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <article className="rounded-[34px] border border-slate-100 bg-white p-6 shadow-soft lg:p-8">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-brand/8 text-brand">
              <KeyRound className="h-7 w-7" />
            </span>
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Account & Privacy</div>
              <h2 className="mt-2 text-2xl font-semibold text-ink">从浏览器开始，也能连接寻鹿账号</h2>
            </div>
          </div>
          <p className="mt-6 text-sm leading-8 text-slate-600">
            基础填报流程开箱即可使用。需要同步寻鹿 Pro 权益或使用云保险箱时，再按需连接账号；插件与网站各自保护登录状态，互不读取对方的登录信息。
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              '登录信息由寻鹿账号安全处理，插件不会保存密码',
              '保险箱口令只用于保护你的资料',
              '备份内容经过加密后保存',
              '可以单独删除备份，不影响主站申请'
            ].map((item) => (
              <div key={item} className="flex gap-2.5 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-brand" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </article>

        <aside className="rounded-[34px] border border-amber-100 bg-amber-50/70 p-6 shadow-sm lg:p-8">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm">
            <CircleAlert className="h-6 w-6" />
          </span>
          <h2 className="mt-5 text-2xl font-semibold text-ink">当前兼容性说明</h2>
          <p className="mt-4 text-sm leading-8 text-slate-600">
            报名页面会持续变化，插件会根据页面结构给出识别结果；无法可靠判断时，会提示你改为手动填写。
          </p>
          <div className="mt-5 rounded-2xl border border-amber-100 bg-white/75 p-4 text-sm leading-7 text-amber-900">
            如果页面显示“未知站点”、低置信或未识别必填项，请停止批量填入，改用复制值或人工填写，并在提交前逐项核对。
          </div>
        </aside>
      </section>

      <section className="rounded-[34px] border border-slate-100 bg-white p-6 shadow-soft lg:p-9">
        <SectionHeading
          eyebrow="FAQ"
          title="使用前常见问题"
          description="先理解边界，再决定是否把它加入自己的申请流程。"
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {faqs.map((item) => (
            <article key={item.question} className="rounded-[24px] border border-slate-100 bg-slate-50/65 p-5">
              <h3 className="flex items-start gap-3 text-base font-semibold leading-7 text-ink">
                <BookOpenText className="mt-1 h-4 w-4 shrink-0 text-brand" />
                <span>{item.question}</span>
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[34px] bg-brand px-6 py-8 text-white shadow-[0_24px_60px_rgba(23,73,77,0.22)] lg:px-9 lg:py-10">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-cyan-300/15 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Keep improving</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">准备好后，直接开始使用</h2>
            <p className="mt-4 text-sm leading-7 text-emerald-50/85">
              寻鹿闪填会持续适配更多报名页面。遇到无法识别的页面时，请按照提示人工核对，提交前再检查一次。
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <a
              href="#workflow"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-brand transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
            >
              <RefreshCcw className="h-4 w-4" />
              再看使用流程
            </a>
            <Link
              href="/resources"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/25"
            >
              返回资源库
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
