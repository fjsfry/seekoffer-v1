import Image from 'next/image';
import Link from 'next/link';
import { Compass } from 'lucide-react';

export function SeekofferLogo() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-3">
      <div className="overflow-hidden rounded-2xl border border-white/40 bg-white p-1 shadow-sm">
        <Image
          src="/logo.png"
          alt="寻鹿 Seekoffer"
          width={44}
          height={44}
          className="h-11 w-11 rounded-[14px] object-cover"
          priority
        />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-base font-semibold tracking-tight text-white md:text-lg">
          寻鹿 Seekoffer
          <Compass className="h-4 w-4 text-emerald-200" />
        </div>
        <div className="hidden text-[11px] uppercase tracking-[0.24em] text-white/65 lg:block">
          保研通知 + 助力申请 + 资源整合
        </div>
      </div>
    </Link>
  );
}
