import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '保研资源库与申请资料中心 - Seekoffer',
  description: '整理学术工具、官方入口、材料模板、申请清单和常用服务，帮助高效准备保研材料。'
};

export default function ResourcesLayout({ children }: { children: ReactNode }) {
  return children;
}
