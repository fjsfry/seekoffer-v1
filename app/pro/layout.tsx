import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SeekOffer Pro | 填报助手与申请管理升级',
  description: '升级 SeekOffer Pro，解锁填报助手不限次数、无限申请项目和完整申请管理能力。'
};

export default function ProLayout({ children }: { children: React.ReactNode }) {
  return children;
}
