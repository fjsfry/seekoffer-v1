import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({ title: '社区规范 - Seekoffer', description: 'Offer 圈和寻鹿社区的交流、隐私保护、纠错与内容处理规范。', path: '/community' });
export default function Layout({ children }: { children: ReactNode }) { return children; }
