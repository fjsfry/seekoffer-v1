import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({ title: '保研截止提醒 - Seekoffer', description: '集中查看近期截止的夏令营、预推免和正式推免项目。', path: '/deadlines' });
export default function Layout({ children }: { children: ReactNode }) { return children; }
