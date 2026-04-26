import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Offer 池内测 - Seekoffer',
  description: '低噪音、可纠错的录取、放弃、补录动态演示社区，正式开放前将接入核验与举报机制。'
};

export default function OffersLayout({ children }: { children: ReactNode }) {
  return children;
}
