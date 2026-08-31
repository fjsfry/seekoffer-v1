import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({ title: '全部申请 - Seekoffer', description: '正在前往寻鹿全部申请。', path: '/', index: false });
export default function Layout({ children }: { children: ReactNode }) { return children; }
