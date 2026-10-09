import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '寻鹿 Pro | 申请管理与会员方案',
  description: '了解寻鹿 Pro 的一次性方案、有效期与申请管理权益，管理你的会员和订单。当前暂停购买。'
};

export default function ProLayout({ children }: { children: React.ReactNode }) {
  return children;
}
