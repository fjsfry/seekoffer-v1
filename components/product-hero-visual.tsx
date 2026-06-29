import Image from 'next/image';
import {
  ArrowRight,
  BarChart3,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  Layers3,
  Sparkles,
  Target,
  TrendingUp
} from 'lucide-react';

type ProductHeroVisualVariant = 'dashboard' | 'library' | 'college' | 'resource' | 'ai';

const variantIconMap = {
  dashboard: Layers3,
  library: CalendarDays,
  college: GraduationCap,
  resource: FileCheck2,
  ai: Sparkles
} satisfies Record<ProductHeroVisualVariant, typeof Layers3>;

export function ProductHeroVisual({
  variant = 'dashboard',
  compact = false
}: {
  variant?: ProductHeroVisualVariant;
  compact?: boolean;
}) {
  const VariantIcon = variantIconMap[variant];

  if (variant === 'dashboard') {
    return <DashboardHeroVisual compact={compact} />;
  }

  return (
    <div className={`relative hidden overflow-hidden rounded-[46px] ${compact ? 'min-h-[240px]' : 'min-h-[390px]'} lg:block`}>
      <div className="absolute inset-0 rounded-[46px] bg-[radial-gradient(circle_at_70%_20%,rgba(125,205,197,0.28),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.92),rgba(239,248,247,0.74))]" />
      <div className="absolute right-8 top-8 h-36 w-36 rounded-full bg-brand/10" />
      <div className="absolute right-20 top-24 h-28 w-28 rounded-full border-[18px] border-brand/12 border-t-brand/55" />
      <div className="absolute right-8 top-28 grid grid-cols-8 gap-1 opacity-20">
        {Array.from({ length: 56 }).map((_, index) => (
          <span key={index} className="h-1 w-1 rounded-full bg-brand" />
        ))}
      </div>

      <div className="absolute left-12 top-16 h-48 w-64 -rotate-6 rounded-[30px] border border-white/70 bg-brand shadow-float">
        <div className="absolute inset-0 rounded-[30px] bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.24),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.08),transparent)]" />
        <div className="relative flex h-full items-center justify-center">
          <div className="rounded-[22px] bg-white/92 p-3 shadow-soft">
            <Image src="/logo.png" alt="Seekoffer" width={72} height={72} className="h-[72px] w-[72px] rounded-2xl object-cover" />
          </div>
        </div>
      </div>

      <div className="absolute left-[170px] top-8 w-72 rotate-6 rounded-[30px] border border-slate-200/70 bg-white/92 p-6 shadow-soft backdrop-blur">
        <div className="mb-5 flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/8 text-brand">
            <VariantIcon className="h-5 w-5" />
          </span>
          <div className="grid flex-1 gap-2">
            <span className="h-2.5 rounded-full bg-slate-200" />
            <span className="h-2 w-2/3 rounded-full bg-slate-100" />
          </div>
        </div>
        {[0, 1, 2].map((item) => (
          <div key={item} className="flex items-center gap-3 border-t border-slate-100 py-3">
            <CheckCircle2 className="h-5 w-5 text-brand" />
            <span className="h-2 flex-1 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>

      <div className="absolute bottom-10 right-12 w-72 rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-hero backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Seekoffer Flow</span>
          <TrendingUp className="h-5 w-5 text-brand" />
        </div>
        <div className="flex h-28 items-end gap-3 rounded-2xl bg-gradient-to-b from-brand/8 to-white p-4">
          {[42, 72, 54, 86, 64, 96].map((height, index) => (
            <span
              key={index}
              className="w-full rounded-t-xl bg-brand/70"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>

      <div className="absolute bottom-20 left-20 rounded-[24px] border border-white/70 bg-white/90 px-5 py-4 shadow-soft backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-brand">
            <BarChart3 className="h-6 w-6" />
          </span>
          <div>
            <div className="text-sm font-semibold text-ink">Planning</div>
            <div className="mt-1 text-xs text-slate-500">notice · deadline · progress</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardHeroVisual({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`relative hidden overflow-hidden rounded-[46px] ${compact ? 'min-h-[260px]' : 'min-h-[420px]'} lg:block`}>
      <div className="absolute inset-0 rounded-[46px] bg-[radial-gradient(circle_at_76%_18%,rgba(125,205,197,0.34),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(235,249,247,0.82))]" />
      <div className="absolute -right-12 top-10 h-52 w-52 rounded-full bg-brand/10 blur-2xl" />
      <div className="absolute bottom-8 left-10 h-32 w-32 rounded-full bg-amber-200/20 blur-2xl" />

      <div className="absolute left-8 top-8 w-[430px] rounded-[34px] border border-white/80 bg-white/92 p-5 shadow-hero backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-brand">My Application Desk</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">今天先处理这 3 件事</div>
          </div>
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white shadow-float">
            <Target className="h-6 w-6" />
          </span>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: '今日待办', value: '3', icon: ClipboardList },
            { label: '7天截止', value: '12', icon: BellRing },
            { label: '材料缺口', value: '2', icon: FileCheck2 }
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.label} className="rounded-2xl bg-slate-50 px-4 py-4">
                <Icon className="h-4 w-4 text-brand" />
                <div className="mt-3 text-2xl font-semibold text-ink">{item.value}</div>
                <div className="mt-1 text-[11px] font-semibold text-slate-500">{item.label}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3">
          {[
            { school: '清华大学', title: '交叉信息院夏令营', meta: '推荐优先申请', tone: 'bg-emerald-50 text-brand' },
            { school: '复旦大学', title: '计算机学院预推免', meta: '材料待补充', tone: 'bg-amber-50 text-amber-700' },
            { school: '上海交通大学', title: '人工智能方向项目', meta: '3 天内截止', tone: 'bg-rose-50 text-rose-600' }
          ].map((item) => (
            <div key={item.school} className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink">{item.school}</div>
                <div className="mt-1 truncate text-xs text-slate-500">{item.title}</div>
              </div>
              <span className={`rounded-full px-3 py-1 text-center text-[11px] font-semibold ${item.tone}`}>{item.meta}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-float">
          加入工作台
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>

      <div className="absolute bottom-9 right-9 w-[300px] rounded-[30px] border border-white/70 bg-white/78 p-5 shadow-soft backdrop-blur">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="font-semibold text-ink">材料完成度</div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-brand">自动待办</span>
        </div>
        <div className="grid gap-3">
          {[
            ['简历', '100%'],
            ['个人陈述', '70%'],
            ['推荐信', '40%']
          ].map(([label, width]) => (
            <div key={label}>
              <div className="mb-2 flex justify-between text-xs font-semibold text-slate-500">
                <span>{label}</span>
                <span>{width}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand" style={{ width }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-24 left-10 rounded-[24px] border border-white/70 bg-white/86 px-5 py-4 shadow-soft backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/8 text-brand">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <div>
            <div className="text-sm font-semibold text-ink">从通知到行动</div>
            <div className="mt-1 text-xs text-slate-500">notice → checklist → reminder</div>
          </div>
        </div>
      </div>
    </div>
  );
}
