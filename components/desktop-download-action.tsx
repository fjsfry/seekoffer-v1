'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Copy, Download, Monitor } from 'lucide-react';
import { DESKTOP_RELEASE } from '@/lib/desktop-download';

type DetectedPlatform = 'unknown' | 'windows' | 'other';

export function DesktopDownloadAction() {
  const [platform, setPlatform] = useState<DetectedPlatform>('unknown');
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    setPlatform(/Windows/i.test(window.navigator.userAgent) ? 'windows' : 'other');
  }, []);

  const platformMessage =
    platform === 'windows'
      ? '已识别 Windows 设备，可直接下载安装。'
      : platform === 'other'
        ? '目前仅提供 Windows 桌面端；其他设备可继续使用网页版。'
        : '适用于 Windows 10 / 11 64 位设备。';

  async function copyDownloadPageUrl() {
    const pageUrl = 'https://www.seekoffer.com.cn/download/';

    try {
      await window.navigator.clipboard.writeText(pageUrl);
    } catch {
      const input = document.createElement('textarea');
      input.value = pageUrl;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }

    setLinkCopied(true);
  }

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {platform === 'windows' ? (
          <a
            href={DESKTOP_RELEASE.installerUrl}
            onClick={() => setDownloadStarted(true)}
            className="group inline-flex min-h-12 items-center justify-center gap-2.5 rounded-2xl bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-float transition duration-200 hover:-translate-y-0.5 hover:bg-brand-deep focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20"
            aria-describedby="desktop-download-platform-note"
          >
            {downloadStarted ? <CheckCircle2 className="h-5 w-5" /> : <Download className="h-5 w-5" />}
            {downloadStarted ? '下载已开始' : '下载 Windows 版'}
            {!downloadStarted ? <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /> : null}
          </a>
        ) : (
          <Link
            href={platform === 'other' ? '/me' : '#windows-download'}
            className="group inline-flex min-h-12 items-center justify-center gap-2.5 rounded-2xl bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-float transition duration-200 hover:-translate-y-0.5 hover:bg-brand-deep focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20"
          >
            <Monitor className="h-5 w-5" />
            {platform === 'other' ? '继续使用网页版' : '查看 Windows 版'}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
        )}

        {platform === 'other' ? (
          <button
            type="button"
            onClick={copyDownloadPageUrl}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand/25 hover:text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/10"
            aria-live="polite"
          >
            {linkCopied ? <CheckCircle2 className="h-4 w-4 text-brand" /> : <Copy className="h-4 w-4" />}
            {linkCopied ? '下载页地址已复制' : '复制到 Windows 电脑打开'}
          </button>
        ) : (
          <Link
            href="/me"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand/25 hover:text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/10"
          >
            继续使用网页版
          </Link>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs leading-5 text-slate-500">
        <span id="desktop-download-platform-note" aria-live="polite">
          {platformMessage}
        </span>
      </div>
      {platform === 'other' ? (
        <p className="mt-2 text-xs leading-6 text-slate-500">需要在 Windows 电脑安装？复制本页地址后在电脑浏览器中打开即可。</p>
      ) : null}
    </div>
  );
}
