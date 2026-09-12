import Link from 'next/link';
import { Laptop } from 'lucide-react';
import { SiteShell } from './site-shell';
import {MigrationDownloadLink} from './migration-download-link';

// Public, verified Windows artifact only. Keep the legacy updater channel closed.
export const MIGRATION_DESKTOP_DOWNLOAD = {
  version: '0.2.23',
  page: 'https://seekoffer-client-downloads.seekoffer-9268f8c5.workers.dev',
  installer: 'https://seekoffer-client-downloads.seekoffer-9268f8c5.workers.dev/files/145eeaccc1d5/SeekOffer-Desktop-v0.2.23-Windows-x64-Setup.exe',
  sha256: '145eeaccc1d5d34cd28f4162ec5c9e46e61e6678000ad15734ac59a5aea35e73'
} as const;

export function RecoveryDesktopDownload() {
  return <SiteShell>
    <section data-download-page className="surface-card rounded-[32px] p-8 sm:p-10">
      <div className="eyebrow normal-case tracking-normal"><Laptop className="h-4 w-4" />Windows 桌面端 · 迁移测试版</div>
      <h1 className="mt-5 text-3xl font-semibold text-ink">继续在桌面管理你的申请</h1>
      <p className="mt-4 max-w-2xl leading-8 text-slate-600">登录同一寻鹿账号，查看申请、编辑备注，与网页版继续同步。覆盖安装前请保存正在编辑的内容并退出寻鹿，保留原有本机资料。</p>
      <p className="mt-4 text-sm text-slate-500">v{MIGRATION_DESKTOP_DOWNLOAD.version} · Windows 10 / 11 64 位 · 24.4 MiB · 2026-09-11</p>
      <div className="mt-6 flex flex-wrap items-center gap-5">
        <MigrationDownloadLink href={MIGRATION_DESKTOP_DOWNLOAD.installer} />
        <a href={MIGRATION_DESKTOP_DOWNLOAD.page} className="text-brand">安装说明与文件校验</a>
        <Link href="/me" className="text-brand">使用网页工作台</Link>
      </div>
      <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-500">本版需要手动安装，暂不通过自动更新推送。安装包尚无 Windows 发布者签名，系统可能显示未知发布者提示；请从此官方入口下载并核对文件。安装说明中提供 SHA-256 校验值。</p>
    </section>
  </SiteShell>;
}
