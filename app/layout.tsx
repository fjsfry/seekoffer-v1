import type { Metadata } from 'next';
import { AuthActionBridge } from '@/components/auth-action-bridge';
import { AuthModal } from '@/components/auth-modal';
import { UserSessionProvider } from '@/components/user-session-provider';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '寻鹿 Seekoffer | 保研通知与申请管理平台',
    template: '%s'
  },
  description: '面向保研学生的一站式门户网站，覆盖通知检索、申请管理、资源整合与院校官网直达。',
  keywords: ['保研通知', '推免通知', '夏令营通知', '预推免', '保研申请管理', 'Seekoffer', '寻鹿'],
  metadataBase: new URL('https://www.seekoffer.com.cn'),
  alternates: {
    canonical: '/'
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true
    }
  },
  openGraph: {
    title: '寻鹿 Seekoffer | 保研通知与申请管理平台',
    description: '持续同步公开院校通知，帮助你整理截止时间、申请进度和常用资源入口。',
    url: 'https://www.seekoffer.com.cn',
    siteName: '寻鹿 Seekoffer',
    images: [
      {
        url: '/logo.png',
        width: 512,
        height: 512,
        alt: '寻鹿 Seekoffer'
      }
    ],
    locale: 'zh_CN',
    type: 'website'
  },
  twitter: {
    card: 'summary',
    title: '寻鹿 Seekoffer | 保研通知与申请管理平台',
    description: '持续同步公开院校通知，帮助你整理截止时间、申请进度和常用资源入口。',
    images: ['/logo.png']
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <UserSessionProvider>
          <AuthActionBridge />
          <AuthModal />
          {children}
        </UserSessionProvider>
      </body>
    </html>
  );
}
