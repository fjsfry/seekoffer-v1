import Image from 'next/image';
import Link from 'next/link';
import { Compass } from 'lucide-react';

export function SeekofferLogo() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5 md:gap-3">
      <div className="overflow-hidden rounded-2xl border border-white/40 bg-white p-1 shadow-sm">
        <Image
          src="/logo.png"
          alt="寻鹿 Seekoffer"
          width={40}
          height={40}
          className="h-9 w-9 rounded-[12px] object-cover md:h-11 md:w-11 md:rounded-[14px]"
          priority
        />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-white md:gap-2 md:text-lg">
          <span className="truncate">寻鹿 Seekoffer</span>
          <Compass className="h-3.5 w-3.5 shrink-0 text-emerald-200 md:h-4 md:w-4" />
        </div>
        <div className="hidden text-[11px] uppercase tracking-[0.24em] text-white/65 lg:block">
          保研通知 · 助力申请 · 资源整合
        </div>
      </div>
    </Link>
  );
}
