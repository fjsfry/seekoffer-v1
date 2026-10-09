import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '通知详情加载中 - Seekoffer',
  description: '正在打开寻鹿整理的保研通知详情。',
  robots: {
    index: false,
    follow: true
  },
  alternates: {
    canonical: '/notices'
  }
};

export default function NoticeQueryDetailLayout({ children }: { children: ReactNode }) {
  return children;
}
