import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '保研资源库与申请资料中心 - Seekoffer',
  description: '整理学术工具、官方入口、简历模板、个人陈述、推荐信模板和常用服务，帮助高效准备保研材料。',
  alternates: {
    canonical: '/resources'
  },
  openGraph: {
    title: '保研资源库与申请资料中心 - Seekoffer',
    description: '保研材料模板、学术工具、官方入口和常用服务一页直达。',
    url: '/resources',
    siteName: '寻鹿 Seekoffer',
    images: ['/logo.png'],
    locale: 'zh_CN',
    type: 'website'
  }
};

export default function ResourcesLayout({ children }: { children: ReactNode }) {
  return children;
}
