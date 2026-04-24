import Link from 'next/link';
import { footerAbout, footerColumns } from '@/lib/site-content';

export function SiteFooter() {
  return (
    <footer className="mt-12 overflow-hidden rounded-[34px] bg-brand text-white shadow-hero">
      <div className="grid gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:px-8">
        <div>
          <div className="text-2xl font-semibold tracking-tight">寻鹿 Seekoffer</div>
          <p className="mt-4 max-w-2xl text-sm leading-8 text-white/80">{footerAbout}</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {footerColumns.map((column) => (
            <div key={column.title}>
              <div className="text-sm font-semibold text-white">{column.title}</div>
              <div className="mt-4 grid gap-3 text-sm text-white/75">
                {column.links.map((item) =>
                  'external' in item && item.external ? (
                    <a key={item.label} href={item.href} target="_blank" rel="noreferrer" className="hover:text-white">
                      {item.label}
                    </a>
                  ) : (
                    <Link key={item.label} href={item.href} className="hover:text-white">
                      {item.label}
                    </Link>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10 px-6 py-4 text-sm text-white/60 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>© 2026 寻鹿 Seekoffer. 保研通知、申请管理与资源整合平台。</div>
          <div className="flex flex-wrap gap-4">
            <Link href="/terms" className="hover:text-white">
              用户协议
            </Link>
            <Link href="/privacy" className="hover:text-white">
              隐私政策
            </Link>
            <Link href="/disclaimer" className="hover:text-white">
              免责声明
            </Link>
            <Link href="/about" className="hover:text-white">
              关于我们
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
