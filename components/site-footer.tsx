import Link from 'next/link';
import Image from 'next/image';
import { MessageCircle, Play, Send, Share2 } from 'lucide-react';
import { footerAbout, footerColumns } from '@/lib/site-content';

export function SiteFooter() {
  return (
    <footer className="mt-14 overflow-hidden rounded-[34px] border border-slate-200/80 bg-white text-slate-600 shadow-soft">
      <div className="grid gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_150px] lg:px-8">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-brand">寻鹿 Seekoffer</div>
          <p className="mt-4 max-w-2xl text-sm leading-8 text-slate-500">{footerAbout}</p>
          <div className="mt-4 grid gap-2 text-xs leading-6 text-slate-500">
            <div>联系邮箱：seekoffer@qq.com</div>
            <div>QQ 交流群：1092490793</div>
            <div>数据删除 / 账号注销：通过反馈邮箱提交申请，我们会在核验后处理。</div>
            <div>当前阶段：公开内测版，通知与材料要求请以院校官网原文为准。</div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            {[MessageCircle, Share2, Send, Play].map((Icon, index) => (
              <span
                key={index}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-brand"
              >
                <Icon className="h-4 w-4" />
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {footerColumns.map((column) => (
            <div key={column.title}>
              <div className="text-sm font-semibold text-ink">{column.title}</div>
              <div className="mt-4 grid gap-3 text-sm text-slate-500">
                {column.links.map((item) =>
                  'external' in item && item.external ? (
                    <a key={item.label} href={item.href} target="_blank" rel="noreferrer" className="hover:text-brand">
                      {item.label}
                    </a>
                  ) : (
                    <Link key={item.label} href={item.href} className="hover:text-brand">
                      {item.label}
                    </Link>
                  )
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="lg:justify-self-end">
          <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <Image
              src="/wechat-qr.jpg"
              alt="寻鹿 Seekoffer 公众号二维码"
              width={116}
              height={116}
              className="h-28 w-28 rounded-xl object-cover"
            />
          </div>
          <div className="mt-3 text-center text-xs leading-5 text-slate-500">
            关注寻鹿公众号
            <br />
            获取最新保研资讯
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-400 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>© 2026 寻鹿 Seekoffer. 保研通知、申请管理与资源整合平台。</div>
          <div className="flex flex-wrap gap-4">
            <Link href="/terms" className="hover:text-brand">
              用户协议
            </Link>
            <Link href="/privacy" className="hover:text-brand">
              隐私政策
            </Link>
            <Link href="/disclaimer" className="hover:text-brand">
              免责声明
            </Link>
            <Link href="/about" className="hover:text-brand">
              关于我们
            </Link>
            <span>备案信息以上线主体公示为准</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
