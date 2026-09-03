import Image from 'next/image';
import {
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Cloud,
  Download,
  FileCheck2,
  FolderKanban,
  Laptop,
  MonitorCheck,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { DesktopDownloadAction } from '@/components/desktop-download-action';
import { SiteShell } from '@/components/site-shell';
import { DESKTOP_RELEASE } from '@/lib/desktop-download';
import { absoluteUrl, buildPageMetadata, jsonLdScript } from '@/lib/seo';

export const dynamic = 'force-static';

export const metadata = buildPageMetadata({
  title: '寻鹿桌面端下载 | Windows 保研申请管理与截止提醒',
  description:
    '下载寻鹿 Seekoffer Windows 桌面端，把保研通知、全部申请、材料进度、导师联系与截止提醒集中到桌面工作台。',
  path: '/download'
});

const desktopBenefits = [
  {
    icon: FolderKanban,
    title: '申请进度常驻桌面',
    description: '把目标院校、当前状态、下一步动作与材料完成度放在同一个工作台里，打开就知道先做什么。'
  },
  {
    icon: BellRing,
    title: '关键节点更早提醒',
    description: '截止时间进入日程与提醒中心，配合桌面通知，减少因为反复刷网页而错过重要节点。'
  },
  {
    icon: Cloud,
    title: '网页与桌面延续同一进度',
    description: '登录同一账号后继续管理申请、日程与导师联系；临时查通知时仍可直接使用网页版。'
  }
] as const;

const trustItems = [
  { icon: MonitorCheck, label: 'Windows 10 / 11', detail: '64 位适配，稳定运行' },
  { icon: FileCheck2, label: '官方发布渠道', detail: '来源可核验，持续维护' },
  { icon: RefreshCw, label: '自动检查更新', detail: '新版本及时推送' },
  { icon: Download, label: '免费下载安装', detail: '轻量安装，简单便捷' }
] as const;

const heroFacts = [
  { icon: ShieldCheck, label: '版本号', value: `v${DESKTOP_RELEASE.version}` },
  { icon: Download, label: '安装包大小', value: DESKTOP_RELEASE.installerSize },
  { icon: CalendarDays, label: '发布日期', value: DESKTOP_RELEASE.releaseDate },
  { icon: RefreshCw, label: '自动检查更新', value: '应用内更新' },
  { icon: MonitorCheck, label: '适配系统', value: 'Windows 10 / 11' }
] as const;

const installationSteps = [
  ['下载安装包', '点击“下载 Windows 版”，从寻鹿官方下载地址获取安装程序。'],
  ['完成 Windows 安装', '打开安装包并按提示完成安装；首次启动后使用寻鹿账号登录。'],
  ['开始管理申请', '收藏通知、建立申请、补充日程与材料，后续版本由应用内更新。']
] as const;

const desktopFaq = [
  {
    question: '桌面端会替代网页版吗？',
    answer: '不会。网页版适合随时查询公开通知，桌面端更适合持续推进申请、管理材料与接收提醒，两端服务的是同一条申请路径。'
  },
  {
    question: '以后需要重新下载安装吗？',
    answer: '通常不需要。桌面端会检查正式更新通道，发现新版本后可在应用内下载并重启更新。'
  },
  {
    question: '我的申请数据会保留吗？',
    answer: '覆盖安装不会主动清除寻鹿本地数据。登录同一账号后，可继续使用已同步的申请、日程与导师联系信息；重要资料仍建议保留自己的原始文件。'
  },
  {
    question: 'macOS 或手机可以安装吗？',
    answer: '当前公开版本只提供 Windows 10 / 11 64 位安装包。macOS、Linux 与手机用户可继续使用寻鹿网页版。'
  }
] as const;

const softwareApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: '寻鹿 Seekoffer 桌面端',
  description: '面向保研申请管理、材料推进、日程与截止提醒的 Windows 桌面应用。',
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Windows 10, Windows 11',
  softwareVersion: DESKTOP_RELEASE.version,
  downloadUrl: absoluteUrl('/download/windows/latest'),
  url: absoluteUrl('/download'),
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'CNY'
  }
};

export default function DesktopDownloadPage() {
  return (
    <SiteShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(softwareApplicationJsonLd)} />

      <div data-download-page className="space-y-6 lg:space-y-7">
      <section
        data-download-surface="hero"
        className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white px-5 py-8 shadow-soft sm:px-8 sm:py-10 lg:rounded-[38px] lg:px-10 xl:px-12"
      >
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(500px,1.08fr)] lg:gap-10">
          <div className="max-w-[650px]">
            <div className="eyebrow normal-case tracking-normal">
              <Laptop className="h-4 w-4" />
              Windows 桌面端 · v{DESKTOP_RELEASE.version}
            </div>
            <h1 className="title-balance mt-5 text-[2.45rem] font-semibold leading-[1.14] tracking-[-0.035em] text-ink sm:text-[3.25rem] lg:text-[3.5rem]">
              把保研申请，
              <span className="block text-brand">稳稳放在桌面上</span>
            </h1>
            <p className="mt-5 max-w-[610px] text-base leading-8 text-slate-600 sm:text-lg sm:leading-9">
              专注查看通知、推进申请、管理材料与关键节点提醒，让保研之路更清晰、更高效。
            </p>
            <DesktopDownloadAction />
          </div>

          <DesktopWorkbenchPreview />
        </div>

        <div
          data-download-surface="hero-facts"
          className="mt-6 grid w-full grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-5"
        >
          {heroFacts.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className={`flex items-center gap-3 border-slate-100 px-4 py-4 ${
                  index === heroFacts.length - 1 ? 'col-span-2 lg:col-span-1' : ''
                } ${index < 4 ? 'border-b lg:border-b-0 lg:border-r' : ''} ${index % 2 === 0 && index < 4 ? 'border-r lg:border-r' : ''}`}
              >
                <Icon className="h-5 w-5 shrink-0 text-brand" />
                <div className="min-w-0">
                  <div className="text-[11px] leading-4 text-slate-500">{item.label}</div>
                  <div className="mt-0.5 whitespace-nowrap text-xs font-semibold text-slate-700 sm:text-sm">{item.value}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section
        data-download-surface="trust"
        aria-label="桌面端支持与信任信息"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {trustItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              data-download-card="trust"
              className="flex items-center gap-3.5 rounded-[22px] border border-slate-200/80 bg-white px-4 py-4 shadow-[0_14px_38px_rgba(18,32,38,0.045)]"
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/[0.07] text-brand">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold text-ink">{item.label}</div>
                <div className="mt-0.5 text-xs text-slate-500">{item.detail}</div>
              </div>
            </div>
          );
        })}
      </section>

      <section
        data-download-surface="benefits"
        className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-soft sm:p-7"
      >
        <div className="max-w-2xl">
          <div className="text-sm font-semibold text-brand">更高效 · 更安心 · 更专注</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">不是把网页装进窗口，而是让申请真正可持续推进</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500 sm:text-base">
            深度优化桌面体验，帮助你把更多精力放在准备上，把通知变成申请、把截止变成日程、把材料变成下一步行动。
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {desktopBenefits.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="flex items-start gap-4 rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_32px_rgba(18,32,38,0.04)] sm:p-6"
              >
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/[0.07] text-brand">
                  <Icon className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-ink">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-500">{item.description}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section
        id="windows-download"
        data-download-surface="installation"
        className="scroll-mt-28 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-soft"
      >
        <div className="grid lg:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)]">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand">
              <Download className="h-4 w-4" />
              下载安装
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">三步开始使用寻鹿桌面端</h2>

            <ol className="relative mt-6 grid gap-4">
              <span
                aria-hidden="true"
                className="absolute bottom-5 left-[17px] top-5 border-l border-dashed border-brand/30"
              />
              {installationSteps.map(([title, description], index) => (
                <li key={title} className="relative grid grid-cols-[38px_minmax(0,1fr)] gap-4">
                  <span className="relative z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold text-ink">{title}</h3>
                    <p className="mt-1 text-sm leading-7 text-slate-500">{description}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-brand">安装后你将获得</div>
              <div className="mt-3 grid gap-3 text-sm text-slate-500 sm:grid-cols-3">
                {['在桌面推进申请', '接收关键节点提醒', '应用内检查更新'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

          </div>

          <aside className="border-t border-slate-200 bg-white p-6 sm:p-8 lg:border-l lg:border-t-0" aria-label="系统要求">
            <h3 className="text-lg font-semibold text-ink">系统与版本信息</h3>
            <dl className="mt-4 divide-y divide-slate-200/80 text-sm">
              {[
                ['当前版本', `v${DESKTOP_RELEASE.version}`],
                ['发布日期', DESKTOP_RELEASE.releaseDate],
                ['支持系统', 'Windows 10 / 11'],
                ['系统架构', 'x64 · 64 位'],
                ['运行环境', 'Microsoft Edge WebView2'],
                ['安装包大小', DESKTOP_RELEASE.installerSize],
                ['更新方式', '应用内自动检查']
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-right font-medium text-slate-700">{value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </section>

      <section
        data-download-surface="faq"
        className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-soft sm:p-6"
      >
        <div className="max-w-2xl">
          <div className="text-sm font-semibold text-brand">常见问题</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">下载前，再确认几件事</h2>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {desktopFaq.map((item) => (
            <details
              key={item.question}
              className="group rounded-[18px] border border-slate-200/80 bg-white px-5 py-3.5 shadow-[0_10px_28px_rgba(18,32,38,0.035)] open:shadow-soft sm:px-6"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink marker:content-none">
                {item.question}
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-50 text-brand transition group-open:rotate-180">
                  <ChevronDown className="h-4 w-4" />
                </span>
              </summary>
              <p className="mt-3 max-w-4xl pr-10 text-sm leading-7 text-slate-500">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      </div>
    </SiteShell>
  );
}

function DesktopWorkbenchPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[690px] lg:mx-0">
      <figure className="relative overflow-hidden rounded-[26px] border border-white/90 bg-white p-2 shadow-[0_28px_80px_rgba(18,32,38,0.16)] sm:p-3">
        <Image
          src="/desktop/seekoffer-workbench-download-v0.2.22.png"
          alt="寻鹿桌面端全部申请工作台，展示申请状态、截止时间、下一步动作与材料进度"
          width={1668}
          height={900}
          priority
          sizes="(min-width: 1024px) 50vw, 94vw"
          className="h-auto w-full rounded-[18px] border border-slate-100 object-cover"
        />
        <figcaption className="flex items-center justify-between gap-3 px-2 pb-1 pt-3 text-[11px] text-slate-500 sm:px-3 sm:text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
            <CheckCircle2 className="h-3.5 w-3.5 text-brand" />
            真实桌面端界面
          </span>
          <span>全部申请工作台</span>
        </figcaption>
      </figure>
    </div>
  );
}
