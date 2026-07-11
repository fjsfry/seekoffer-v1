import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({ title: '申请日程跳转 - Seekoffer', description: '正在前往寻鹿申请日程。', path: '/me', index: false });
export default function Layout({ children }: { children: ReactNode }) { return children; }
