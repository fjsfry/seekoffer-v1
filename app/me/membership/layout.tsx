import type { Metadata } from 'next';

export const metadata: Metadata = { title: '我的会员 | 寻鹿 Seekoffer' };

export default function MembershipLayout({ children }: { children: React.ReactNode }) {
  return children;
}
