import type { Metadata, Viewport } from 'next';
import { AuthActionBridge } from '@/components/auth-action-bridge';
import { AuthModal } from '@/components/auth-modal';
import { UserSessionProvider } from '@/components/user-session-provider';
import { VisitorPresenceTracker } from '@/components/visitor-presence-tracker';
import { SITE_DESCRIPTION, SITE_NAME, absoluteUrl, buildOrganizationJsonLd, buildWebSiteJsonLd, jsonLdScript } from '@/lib/seo';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '寻鹿 Seekoffer | 保研通知、推免夏令营与申请管理平台',
    template: '%s'
  },
  description: '寻鹿 Seekoffer 持续整理 2026 保研通知、夏令营、预推免、正式推免、院校库、竞赛库和申请资料，帮助学生高效查通知、看截止、管申请。',
  keywords: [
    '保研通知',
    '保研网站',
    '推免通知',
    '推免系统',
    '夏令营通知',
    '预推免',
    '正式推免',
    '保研院校库',
    '保研竞赛',
    '保研申请管理',
    '保研资料',
    'Seekoffer',
    '寻鹿'
  ],
  applicationName: SITE_NAME,
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'education',
  metadataBase: new URL(absoluteUrl('/')),
  verification: {
    other: {
      'baidu-site-verification': 'codeva-x5pn9knuby'
    }
  },
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
    title: '寻鹿 Seekoffer | 保研通知、推免夏令营与申请管理平台',
    description: SITE_DESCRIPTION,
    url: absoluteUrl('/'),
    siteName: SITE_NAME,
    images: [
      {
        url: '/logo.png',
        width: 512,
        height: 512,
        alt: SITE_NAME
      }
    ],
    locale: 'zh_CN',
    type: 'website'
  },
  twitter: {
    card: 'summary',
    title: '寻鹿 Seekoffer | 保研通知、推免夏令营与申请管理平台',
    description: SITE_DESCRIPTION,
    images: ['/logo.png']
  },
  icons: {
    icon: '/logo.png',
    apple: '/logo.png'
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript([buildWebSiteJsonLd(), buildOrganizationJsonLd()])}
        />
        <UserSessionProvider>
          <AuthActionBridge />
          <AuthModal />
          <VisitorPresenceTracker />
          {children}
        </UserSessionProvider>
      </body>
    </html>
  );
}
