import { BookOpenText, FileCheck2, FileText, Mail, PenLine } from 'lucide-react';
import type { ResourceProductSeed } from '@/lib/resource-products';

const artConfig = {
  emerald: {
    shell: 'bg-[radial-gradient(circle_at_82%_12%,rgba(91,190,157,0.24),transparent_32%),linear-gradient(135deg,#effaf5,#ffffff_72%)]',
    paper: 'border-emerald-100 bg-white/95',
    icon: 'bg-emerald-50 text-brand',
    label: 'text-brand',
    line: 'bg-emerald-100',
    accent: 'bg-brand'
  },
  sky: {
    shell: 'bg-[radial-gradient(circle_at_82%_12%,rgba(78,164,224,0.22),transparent_32%),linear-gradient(135deg,#eff8ff,#ffffff_72%)]',
    paper: 'border-sky-100 bg-white/95',
    icon: 'bg-sky-50 text-sky-600',
    label: 'text-sky-700',
    line: 'bg-sky-100',
    accent: 'bg-sky-500'
  },
  cyan: {
    shell: 'bg-[radial-gradient(circle_at_82%_12%,rgba(50,190,197,0.22),transparent_32%),linear-gradient(135deg,#edfbfb,#ffffff_72%)]',
    paper: 'border-cyan-100 bg-white/95',
    icon: 'bg-cyan-50 text-cyan-600',
    label: 'text-cyan-700',
    line: 'bg-cyan-100',
    accent: 'bg-cyan-500'
  }
} as const;

const iconMap = {
  resume: FileText,
  statement: PenLine,
  recommendation: Mail
} as const;

export function ResourceProductArt({
  product,
  compact = false,
  className = ''
}: {
  product: ResourceProductSeed;
  compact?: boolean;
  className?: string;
}) {
  const style = artConfig[product.accent];
  const Icon = iconMap[product.icon];

  return (
    <div className={`relative overflow-hidden rounded-[30px] ${compact ? 'min-h-[196px] p-4' : 'min-h-[340px] p-6'} ${style.shell} ${className}`}>
      <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full border-[18px] border-white/55" />
      <div className="absolute bottom-5 right-5 grid grid-cols-7 gap-1 opacity-35">
        {Array.from({ length: 35 }).map((_, index) => <span key={index} className={`h-1 w-1 rounded-full ${style.accent}`} />)}
      </div>

      <div className={`relative mx-auto h-full max-w-[360px] rounded-[24px] border p-5 shadow-soft ${style.paper}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className={`text-[10px] font-bold uppercase tracking-[0.2em] ${style.label}`}>SEEK OFFER · KIT</div>
            <div className="mt-2 truncate text-xs font-semibold text-slate-400">{product.categoryLabel}</div>
          </div>
          <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${style.icon}`}>
            <Icon className="h-5 w-5" />
          </span>
        </div>

        <div className={`${compact ? 'mt-5' : 'mt-9'} max-w-[15rem] text-xl font-semibold leading-tight tracking-tight text-ink`}>
          {product.title}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className={`h-2 w-16 rounded-full ${style.accent}`} />
          <span className={`h-2 w-9 rounded-full ${style.line}`} />
          <span className="h-2 w-5 rounded-full bg-slate-100" />
        </div>

        <div className={`${compact ? 'mt-6' : 'mt-10'} grid gap-2`}>
          {product.features.slice(0, 3).map((feature, index) => (
            <div key={feature} className="flex items-center gap-2.5 text-xs font-semibold text-slate-600">
              <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${style.icon}`}>
                <FileCheck2 className="h-3 w-3" />
              </span>
              <span className="truncate">{feature}</span>
              <span className={`ml-auto h-1.5 rounded-full ${style.line} ${index === 0 ? 'w-12' : index === 1 ? 'w-8' : 'w-5'}`} />
            </div>
          ))}
        </div>

        {!compact ? (
          <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <BookOpenText className="h-4 w-4" />
              申请材料工作包
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${style.icon}`}>{product.badge}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
