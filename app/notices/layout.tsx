import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '2026 保研通知库 - Seekoffer',
  description: '持续整理 2026 保研夏令营、预推免和正式推免通知，提取截止时间、院校学院和申请入口。',
  alternates: {
    canonical: '/notices'
  },
  openGraph: {
    title: '2026 保研通知库 - Seekoffer',
    description: '按院校、专业、项目类型和截止时间筛选保研通知。',
    url: '/notices',
    siteName: '寻鹿 Seekoffer',
    images: ['/logo.png'],
    locale: 'zh_CN',
    type: 'website'
  }
};

export default function NoticesLayout({ children }: { children: ReactNode }) {
  return children;
}
