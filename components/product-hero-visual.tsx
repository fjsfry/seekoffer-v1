import Image from 'next/image';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  FileCheck2,
  GraduationCap,
  Layers3,
  Sparkles,
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
