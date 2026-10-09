import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '我的申请工作台 - Seekoffer',
  description: '保存目标院校，管理保研申请状态、材料进度、待办清单、导师联系和截止提醒。',
  alternates: {
    canonical: '/me'
  },
  openGraph: {
    title: '保研申请工作台 - Seekoffer',
    description: '集中管理保研申请清单、日程、导师联系和材料进度。',
    url: '/me',
    siteName: '寻鹿 Seekoffer',
    images: ['/logo.png'],
    locale: 'zh_CN',
    type: 'website'
  }
};

export default function MeLayout({ children }: { children: ReactNode }) {
  return children;
}
