import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '通知整理说明 - Seekoffer',
  description: '了解 Seekoffer 如何整理保研通知、展示更新时间和给出使用建议。',
  alternates: {
    canonical: '/data-quality'
  },
  openGraph: {
    title: 'Seekoffer 通知整理说明',
    description: '了解保研通知整理方式、字段展示和使用建议。',
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
