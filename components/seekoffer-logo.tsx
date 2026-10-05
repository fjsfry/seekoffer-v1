import Image from 'next/image';
import Link from 'next/link';

export function SeekofferLogo() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5 md:gap-3" aria-label="返回 Seekoffer 首页">
      <div className="overflow-hidden rounded-[18px] border border-brand/10 bg-white p-1 shadow-sm">
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
        <div className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-brand md:gap-2 md:text-lg">
          <span className="truncate">寻鹿 Seekoffer</span>
        </div>
      </div>
    </Link>
  );
}
