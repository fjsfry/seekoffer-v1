import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: '关于寻鹿 Seekoffer',
  description: '了解寻鹿 Seekoffer 的信息整理原则、产品边界、纠错机制与联系方式。',
  path: '/about'
});

export default function Layout({ children }: { children: ReactNode }) { return children; }
