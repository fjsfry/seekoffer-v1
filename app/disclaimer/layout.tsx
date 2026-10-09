import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({ title: '免责声明 - Seekoffer', description: '寻鹿整理信息的使用边界、核验原则与风险说明。', path: '/disclaimer' });
export default function Layout({ children }: { children: ReactNode }) { return children; }
