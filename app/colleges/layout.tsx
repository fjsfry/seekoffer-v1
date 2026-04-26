import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '保研院校库 - Seekoffer',
  description: '按城市、层次和关键词筛选目标院校，一页直达学校官网并辅助回访公开通知。'
};

export default function CollegesLayout({ children }: { children: ReactNode }) {
  return children;
}
