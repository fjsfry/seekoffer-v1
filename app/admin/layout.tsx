import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '运营管理平台',
  description: 'Seekoffer 内容审核、用户运营与系统状态管理平台。',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true
  }
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
