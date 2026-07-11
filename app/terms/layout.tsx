import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({ title: '用户协议 - Seekoffer', description: '寻鹿 Seekoffer 用户服务协议与使用规则。', path: '/terms' });
export default function Layout({ children }: { children: ReactNode }) { return children; }
