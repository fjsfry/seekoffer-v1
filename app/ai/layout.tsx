import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'AI 申请定位助手 - Seekoffer',
  description: '基于公开通知、个人档案和申请表，生成目标组合、材料短板、推荐项目和本周行动。'
};

export default function AiLayout({ children }: { children: ReactNode }) {
  return children;
}
