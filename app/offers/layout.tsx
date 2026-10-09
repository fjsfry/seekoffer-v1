import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Offer 圈 - Seekoffer',
  description: '低噪音、可纠错的保研录取、放弃、候补、补录和申请讨论社区，提交内容核验通过后公开展示。',
  alternates: {
    canonical: '/offers'
  },
  openGraph: {
    title: '保研 Offer 圈 - Seekoffer',
    description: '查看保研录取、放弃、候补、补录和申请讨论动态。',
    url: '/offers',
    siteName: '寻鹿 Seekoffer',
    images: ['/logo.png'],
    locale: 'zh_CN',
    type: 'website'
  }
};

export default function OffersLayout({ children }: { children: ReactNode }) {
  return children;
}
