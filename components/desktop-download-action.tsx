'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Copy, Download, Monitor } from 'lucide-react';
import { queueDesktopDownloadAttempt } from '@/lib/client/desktop-download-attempt';

type DetectedPlatform = 'unknown' | 'windows' | 'other';
type CopyStatus = 'idle' | 'success' | 'error';

const PERMANENT_DOWNLOAD_PATH = '/download/windows/latest/';
const BACKUP_DOWNLOAD_PATH = '/download/windows/github/';
const PERMANENT_DOWNLOAD_URL = 'https://www.seekoffer.com.cn/download/windows/latest';

export function DesktopDownloadAction() {
  const [platform, setPlatform] = useState<DetectedPlatform>('unknown');
  const [downloadRequested, setDownloadRequested] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');

  useEffect(() => {
    setPlatform(/Windows/i.test(window.navigator.userAgent) ? 'windows' : 'other');
  }, []);

  const canOfferWindowsDownload = platform !== 'other';

  const platformMessage =
    platform === 'windows'
      ? '已识别 Windows 设备，可直接下载安装。'
      : platform === 'other'
        ? '目前仅提供 Windows 桌面端；其他设备可继续使用网页版。'
        : '适用于 Windows 10 / 11 64 位设备。';

  function handleDownloadClick() {
    queueDesktopDownloadAttempt();
    setDownloadRequested(true);
  }

  async function copyPermanentDownloadUrl() {
    let copied = false;
    try {
      await window.navigator.clipboard.writeText(PERMANENT_DOWNLOAD_URL);
      copied = true;
    } catch {
      const input = document.createElement('textarea');
      input.value = PERMANENT_DOWNLOAD_URL;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      try {
        input.select();
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      } finally {
        input.remove();
      }
    }

    setCopyStatus(copied ? 'success' : 'error');
  }

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {canOfferWindowsDownload ? (
          <a
            href={PERMANENT_DOWNLOAD_PATH}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleDownloadClick}
            className="group inline-flex min-h-12 items-center justify-center gap-2.5 rounded-2xl bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-float transition duration-200 hover:-translate-y-0.5 hover:bg-brand-deep focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20"
            aria-describedby="desktop-download-platform-note desktop-download-status"
          >
            <Download className="h-5 w-5" />
            下载 Windows 版
            <span className="sr-only">，在新标签页打开</span>
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
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
            onClick={() => void copyPermanentDownloadUrl()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand/25 hover:text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/10"
          >
            {copyStatus === 'success' ? <CheckCircle2 className="h-4 w-4 text-brand" /> : <Copy className="h-4 w-4" />}
            {copyStatus === 'success'
              ? '永久下载链接已复制'
              : copyStatus === 'error'
                ? '复制失败，请手动复制'
                : '复制到 Windows 电脑打开'}
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
        <span id="desktop-download-platform-note">
          {platformMessage}
        </span>
        {canOfferWindowsDownload ? (
          <>
            <span aria-hidden="true">·</span>
            <a
              href={BACKUP_DOWNLOAD_PATH}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleDownloadClick}
              className="font-medium text-brand underline decoration-brand/25 underline-offset-4 transition hover:decoration-brand"
            >
              备用下载线路
              <span className="sr-only">，在新标签页打开</span>
            </a>
            <button
              type="button"
              onClick={() => void copyPermanentDownloadUrl()}
              className="font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 transition hover:text-brand hover:decoration-brand"
            >
              {copyStatus === 'success' ? '永久下载链接已复制' : '复制永久下载链接'}
            </button>
          </>
        ) : null}
      </div>
      <p id="desktop-download-status" role="status" aria-live="polite" className="mt-2 min-h-5 break-words text-xs leading-5 text-slate-500">
        {downloadRequested
          ? '已发起下载请求，请查看新标签页。若浏览器没有自动开始下载，请使用备用下载线路。'
          : copyStatus === 'error'
            ? `复制失败，请手动复制：${PERMANENT_DOWNLOAD_URL}`
            : ''}
      </p>
      {platform === 'other' ? (
        <p className="mt-1 text-xs leading-6 text-slate-500">需要在 Windows 电脑安装？复制永久下载链接后在电脑浏览器中打开即可。</p>
      ) : null}
    </div>
  );
}
