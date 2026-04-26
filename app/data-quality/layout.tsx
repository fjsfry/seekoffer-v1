import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '数据如何更新与核验 - Seekoffer',
  description: '了解 Seekoffer 保研通知的数据来源、同步频率、质量分级、人工抽检和纠错处理机制。',
  alternates: {
    canonical: '/data-quality'
  },
  openGraph: {
    title: 'Seekoffer 数据如何更新与核验',
    description: '公开通知自动同步、质量分级、人工抽检和用户纠错闭环说明。',
    url: '/data-quality',
    siteName: '寻鹿 Seekoffer',
    images: ['/logo.png'],
    locale: 'zh_CN',
    type: 'website'
  }
};

export default function DataQualityLayout({ children }: { children: ReactNode }) {
  return children;
}
