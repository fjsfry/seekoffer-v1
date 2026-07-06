import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NoticeDetailView } from '@/components/notice-detail-view';
import { SiteShell } from '@/components/site-shell';
import { formatNoticeDateOnly, getDisplayDiscipline, getDisplayNoticeDepartment, getDisplayProjectType, getDisplaySchoolName, normalizeNoticeTitle } from '@/lib/notice-display';
import { baseNoticeProjects } from '@/lib/notice-source';
import { sanitizeNoticeForPublicView } from '@/lib/notice-public-copy';
import { filterMainNoticeProjects } from '@/lib/notice-quality';
import { SITE_NAME, absoluteUrl, jsonLdScript } from '@/lib/seo';

const visibleNoticeProjects = filterMainNoticeProjects(baseNoticeProjects);

export function generateStaticParams() {
  return visibleNoticeProjects.map((item) => ({
    id: item.id
  }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const project = visibleNoticeProjects.find((item) => item.id === id);

  if (!project) {
    return {
      title: '通知详情 - Seekoffer'
    };
  }

  const school = getDisplaySchoolName(project.schoolName);
  const department = getDisplayNoticeDepartment(project);
  const title = normalizeNoticeTitle(project.projectName, 72);
  const description = `${school} ${department} ${formatNoticeDateOnly(project.deadlineDate)} 截止。查看材料清单、报名入口和申请进度管理。`;
  const url = `/notices/${encodeURIComponent(project.id)}`;

  return {
    title: `${school} ${title} - 2026 保研通知 | Seekoffer`,
    description,
    alternates: {
      canonical: url
    },
    openGraph: {
      title: `${school} ${title}`,
      description,
      url,
      siteName: '寻鹿 Seekoffer',
      images: ['/logo.png'],
      type: 'article',
      locale: 'zh_CN'
    },
    twitter: {
      card: 'summary',
      title: `${school} ${title}`,
      description,
      images: ['/logo.png']
    }
  };
}

export default async function NoticeDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = visibleNoticeProjects.find((item) => item.id === id);

  if (!project) {
    notFound();
  }

  const departmentName = getDisplayNoticeDepartment(project);
  const schoolName = getDisplaySchoolName(project.schoolName);
  const title = normalizeNoticeTitle(project.projectName, 100);
  const detailUrl = absoluteUrl(`/notices/${encodeURIComponent(project.id)}`);
  const description = `${schoolName} ${departmentName} ${formatNoticeDateOnly(project.deadlineDate)} 截止。查看保研通知详情、材料要求和申请进度管理入口。`;
  const noticeJsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: `${schoolName} ${title}`,
      description,
      inLanguage: 'zh-CN',
      datePublished: project.publishDate,
      dateModified: project.updatedAt || project.collectedAt || project.publishDate,
      mainEntityOfPage: detailUrl,
      author: {
        '@type': 'Organization',
        name: SITE_NAME
      },
      publisher: {
        '@type': 'Organization',
        name: SITE_NAME,
        logo: {
          '@type': 'ImageObject',
          url: absoluteUrl('/logo.png')
        }
      },
      about: [schoolName, departmentName, getDisplayProjectType(project.projectType), getDisplayDiscipline(project.discipline)].filter(Boolean),
      url: detailUrl
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: '首页',
          item: absoluteUrl('/')
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: '通知库',
          item: absoluteUrl('/notices')
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: `${schoolName} ${title}`,
          item: detailUrl
        }
      ]
    }
  ];

  return (
    <SiteShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(noticeJsonLd)} />
      <NoticeDetailView project={sanitizeNoticeForPublicView(project)} returnHref="/notices" />
    </SiteShell>
  );
}
