import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '保研院校库 - Seekoffer',
  description: '按城市、层次和关键词筛选目标院校，一页直达学校官网并辅助回访公开通知。',
  alternates: {
    canonical: '/colleges'
  },
  openGraph: {
    title: '保研院校库 - Seekoffer',
    description: '查询保研目标院校、官网入口、院校层次和公开通知数据。',
    url: '/colleges',
    siteName: '寻鹿 Seekoffer',
    images: ['/logo.png'],
    locale: 'zh_CN',
    type: 'website'
  }
};

export default function CollegesLayout({ children }: { children: ReactNode }) {
  return children;
}
