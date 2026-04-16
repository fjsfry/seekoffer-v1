import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '寻鹿 Seekoffer | 保研通知与申请管理平台',
  description: '面向保研学生的一站式门户网站，覆盖通知检索、申请管理、资源整合与院校官网直达。'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
