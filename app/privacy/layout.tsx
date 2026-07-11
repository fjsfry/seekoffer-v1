import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({ title: '隐私政策 - Seekoffer', description: '了解寻鹿 Seekoffer 如何收集、使用、保存和保护个人信息。', path: '/privacy' });
export default function Layout({ children }: { children: ReactNode }) { return children; }
