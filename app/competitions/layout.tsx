import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '保研竞赛库 - A类B类大学生竞赛与背景提升 | Seekoffer',
  description: '整理 CAHE A 类、B 类和热门大学生竞赛，按赛事级别、专业类别和关键词筛选，辅助保研背景提升与材料准备。',
  alternates: {
    canonical: '/competitions'
  },
  openGraph: {
    title: '保研竞赛库 - A类B类大学生竞赛与背景提升',
    description: '按级别、专业类别和关键词查找适合保研背景提升的大学生竞赛。',
    url: '/competitions',
    siteName: '寻鹿 Seekoffer',
    images: ['/logo.png'],
    locale: 'zh_CN',
    type: 'website'
  }
};

export default function CompetitionsLayout({ children }: { children: ReactNode }) {
  return children;
}
