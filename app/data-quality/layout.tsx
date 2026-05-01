import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '通知来源说明 - Seekoffer',
  description: '了解 Seekoffer 保研通知的数据来源、更新时间和使用建议。',
  alternates: {
    canonical: '/data-quality'
  },
  openGraph: {
    title: 'Seekoffer 通知来源说明',
    description: '了解保研通知来源、官网原文核对方式和使用建议。',
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
