import type { ReactNode } from 'react';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: '发布保研 Offer 动态 - Seekoffer',
  description: '提交真实的保研录取、候补、放弃或补录进展，核验通过后公开展示。',
  path: '/publish'
});

export default function Layout({ children }: { children: ReactNode }) { return children; }
