import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'AI 申请定位助手 - Seekoffer',
  description: '基于公开通知、申请字段和经验规则，辅助判断目标层级、材料短板和申请优先级。'
};

export default function AiLayout({ children }: { children: ReactNode }) {
  return children;
}
