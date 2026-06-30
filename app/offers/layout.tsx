import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Offer 圈 - Seekoffer',
  description: '低噪音、可纠错的录取、放弃、候补、补录和申请讨论社区，提交内容审核通过后公开展示。'
};

export default function OffersLayout({ children }: { children: ReactNode }) {
  return children;
}
