import type { PublicNoticeProject } from './mock-data';

type NoticeLinkProject = Pick<PublicNoticeProject, 'applyLink' | 'sourceLink'>;
export type LegacyNoticeDetailSearchParams = {
  id?: string | string[];
  returnTo?: string | string[];
};

const APPLICATION_ONLY_LINK_PATTERN =
  /(wjx|wenjuan|jinshuju|questionnaire|survey|docs\.qq\.com\/form|feishu\.cn\/share\/base\/form|forms?\.|\/forms?\/|\/form\/|\/survey\/|\/questionnaire\/|\/collect\/)/i;
const AGGREGATOR_LINK_PATTERN = /baoyantongzhi\.com\/notice|seekoffer\.com\.cn\/notices/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const ENCODED_LINE_BREAK_PATTERN = /%(?:0a|0d)/i;

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
  if (!normalizedId || normalizedId === '.' || normalizedId === '..' || CONTROL_CHARACTER_PATTERN.test(normalizedId)) {
    return '/notices';
  }

  const params = new URLSearchParams();

  if (returnTo) {
    params.set('returnTo', returnTo);
  }

  const query = params.toString();
  return `/notices/${encodeURIComponent(normalizedId)}${query ? `?${query}` : ''}`;
}

export function getSafeNoticeReturnHref(value: string | string[] | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const candidate = value.trim();
  if (
    !candidate ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    CONTROL_CHARACTER_PATTERN.test(candidate) ||
    ENCODED_LINE_BREAK_PATTERN.test(candidate)
  ) {
    return null;
  }

  try {
    const parsed = new URL(candidate, 'https://seekoffer.invalid');
    if (
      parsed.origin !== 'https://seekoffer.invalid' ||
      (parsed.pathname !== '/notices' && parsed.pathname !== '/notices/')
    ) {
      return null;
    }

    return candidate;
  } catch {
    return null;
  }
}

export function buildLegacyNoticeDetailRedirect(searchParams: LegacyNoticeDetailSearchParams) {
  const id = typeof searchParams.id === 'string' ? searchParams.id.trim() : '';
  if (!id) {
    return '/notices';
  }

  const hasReturnTo = searchParams.returnTo !== undefined;
  const returnTo = getSafeNoticeReturnHref(searchParams.returnTo);
  if (hasReturnTo && !returnTo) {
    return '/notices';
  }

  return buildNoticeDetailHref(id, returnTo || undefined);
}
