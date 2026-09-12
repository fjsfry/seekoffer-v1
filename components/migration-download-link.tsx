'use client';

import {Download} from 'lucide-react';
import {queueDesktopDownloadAttempt} from '@/lib/client/desktop-download-attempt';

export function MigrationDownloadLink({href}: {href: string}) {
  return <a data-desktop-migration-download href={href} onClick={() => queueDesktopDownloadAttempt()}
    className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 font-semibold text-white">
    <Download className="h-5 w-5" />下载 Windows 迁移测试版
  </a>;
}
