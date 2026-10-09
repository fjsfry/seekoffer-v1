import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({ title: '申请工作台跳转 - Seekoffer', description: '正在前往寻鹿申请工作台。', path: '/me', index: false });
export default function Layout({ children }: { children: ReactNode }) { return children; }
