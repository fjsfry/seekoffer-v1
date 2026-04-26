import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '我的申请工作台 - Seekoffer',
  description: '保存目标院校，管理申请状态、材料进度、待办清单和截止提醒。'
};

export default function MeLayout({ children }: { children: ReactNode }) {
  return children;
}
