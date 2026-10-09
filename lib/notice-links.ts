import type { PublicNoticeProject } from './mock-data';
import { baseNoticeProjects } from './notice-source';

type NoticeLinkProject = Pick<PublicNoticeProject, 'applyLink' | 'sourceLink'>;

const APPLICATION_ONLY_LINK_PATTERN =
  /(wjx|wenjuan|jinshuju|questionnaire|survey|docs\.qq\.com\/form|feishu\.cn\/share\/base\/form|forms?\.|\/forms?\/|\/form\/|\/survey\/|\/questionnaire\/|\/collect\/)/i;
const AGGREGATOR_LINK_PATTERN = /baoyantongzhi\.com\/notice|seekoffer\.com\.cn\/notices/i;
const STATIC_NOTICE_IDS = new Set(baseNoticeProjects.map((project) => project.id));

function normalizeExternalLink(value: string | undefined | null) {
  const link = String(value || '').trim();

  if (!/^https?:\/\//i.test(link)) {
    return '';
  }

  return link;
}

export function isLikelyApplicationOnlyLink(value: string | undefined | null) {
  const link = normalizeExternalLink(value);

  if (!link) {
    return false;
  }

  return APPLICATION_ONLY_LINK_PATTERN.test(link);
}

export function getNoticeOriginalLink(project: NoticeLinkProject) {
  const applyLink = normalizeExternalLink(project.applyLink);
  const sourceLink = normalizeExternalLink(project.sourceLink);

  if (sourceLink && !AGGREGATOR_LINK_PATTERN.test(sourceLink) && !isLikelyApplicationOnlyLink(sourceLink)) {
    return sourceLink;
  }

  if (applyLink && !isLikelyApplicationOnlyLink(applyLink)) {
    return applyLink;
  }

  if (sourceLink && !isLikelyApplicationOnlyLink(sourceLink)) {
    return sourceLink;
  }

  return '';
}

export function getNoticeApplicationLink(project: NoticeLinkProject) {
  const applyLink = normalizeExternalLink(project.applyLink);
  const originalLink = getNoticeOriginalLink(project);

  if (!applyLink || !isLikelyApplicationOnlyLink(applyLink) || applyLink === originalLink) {
    return '';
  }

  return applyLink;
}

export function buildNoticeDetailHref(id: string, returnTo?: string) {
  const normalizedId = String(id || '').trim();
  const params = new URLSearchParams();

  if (returnTo) {
    params.set('returnTo', returnTo);
  }

  if (STATIC_NOTICE_IDS.has(normalizedId)) {
    const query = params.toString();
    return `/notices/${encodeURIComponent(normalizedId)}${query ? `?${query}` : ''}`;
  }

  params.set('id', normalizedId);
  return `/notices/detail?${params.toString()}`;
}
