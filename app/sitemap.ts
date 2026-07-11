import type { MetadataRoute } from 'next';
import { filterMainNoticeProjects } from '@/lib/notice-quality';
import { baseNoticeProjects } from '@/lib/notice-source';
import { SITE_URL, absoluteUrl } from '@/lib/seo';

export const dynamic = 'force-static';

const staticRoutes = [
  '/',
  '/notices',
  '/deadlines',
  '/colleges',
  '/resources',
  '/competitions',
  '/knowledge',
  '/offers',
  '/gpa',
  '/consulting',
  '/me',
  '/guide',
  '/faq',
  '/data-quality',
  '/about',
  '/terms',
  '/privacy',
  '/disclaimer'
];

function parseDate(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticEntries = staticRoutes.map((route) => ({
    url: absoluteUrl(route),
    changeFrequency: route === '/' || route === '/notices' ? ('daily' as const) : ('weekly' as const),
    priority: route === '/' ? 1 : route === '/notices' ? 0.95 : 0.75
  }));

  const noticeEntries = filterMainNoticeProjects(baseNoticeProjects).slice(0, 50000 - staticEntries.length).map((project) => ({
    url: new URL(`/notices/${encodeURIComponent(project.id)}`, SITE_URL).toString(),
    lastModified: parseDate(project.updatedAt || project.collectedAt || project.publishDate, now),
    changeFrequency: 'weekly' as const,
    priority: String(project.year) === '2026' ? 0.72 : 0.55
  }));

  return [...staticEntries, ...noticeEntries];
}
