import type { Metadata } from 'next';

export const metadata: Metadata = { title: '订单记录 | 寻鹿 Seekoffer' };

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
