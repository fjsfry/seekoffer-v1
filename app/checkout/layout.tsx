import type { Metadata } from 'next';

export const metadata: Metadata = { title: '订单确认 | 寻鹿 Seekoffer' };

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
