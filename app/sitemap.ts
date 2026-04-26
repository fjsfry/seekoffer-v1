import type { MetadataRoute } from 'next';
import { filterMainNoticeProjects } from '@/lib/notice-quality';
import { baseNoticeProjects } from '@/lib/notice-source';

const siteUrl = 'https://www.seekoffer.com.cn';

export const dynamic = 'force-static';

const staticRoutes = ['/', '/notices', '/colleges', '/resources', '/offers', '/ai', '/me', '/data-quality', '/about', '/terms', '/privacy', '/disclaimer'];

function toAbsoluteUrl(path: string) {
  return new URL(path, siteUrl).toString();
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticEntries = staticRoutes.map((route) => ({
    url: toAbsoluteUrl(route),
    lastModified: now,
    changeFrequency: route === '/' || route === '/notices' ? ('daily' as const) : ('weekly' as const),
    priority: route === '/' ? 1 : 0.8
  }));

  const noticeEntries = filterMainNoticeProjects(baseNoticeProjects).slice(0, 1000).map((project) => ({
    url: toAbsoluteUrl(`/notices/${encodeURIComponent(project.id)}`),
    lastModified: project.updatedAt ? new Date(project.updatedAt.replace(' ', 'T')) : now,
    changeFrequency: 'weekly' as const,
    priority: 0.65
  }));

  return [...staticEntries, ...noticeEntries];
}
