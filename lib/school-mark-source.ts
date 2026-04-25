import { collegeDirectory } from './college-directory';
import type { PublicNoticeProject } from './mock-data';
import { siteMarkManifest } from './site-mark-manifest';

const aggregatorDomains = new Set([
  'baoyantongzhi.com',
  'baoyanwang.com',
  'm.baoyan.gaodun.com',
  'baoyan.gaodun.com',
  'gaodun.com',
  'mp.weixin.qq.com',
  'weixin.qq.com'
]);

function normalizeName(value: string, stripParenthetical = false) {
  const text = stripParenthetical ? value.replace(/[（(].*?[）)]/g, '') : value;
  return text.replace(/\s+/g, '').trim();
}

function resolveDomain(source: string) {
  if (!source) return '';

  try {
    const hostname = source.startsWith('http') ? new URL(source).hostname : source;
    return hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return source.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  }
}

function hasManifestMark(domain: string) {
  if (!domain) return false;
  if (siteMarkManifest[domain]) return true;

  const parts = domain.split('.');
  for (let index = 1; index < parts.length - 1; index += 1) {
    if (siteMarkManifest[parts.slice(index).join('.')]) {
      return true;
    }
  }

  return false;
}

const schoolDomainEntries = collegeDirectory.map((college) => ({
  name: normalizeName(college.name),
  baseName: normalizeName(college.name, true),
  domain: college.domain
}));

function resolveDomainBySchoolName(schoolName: string) {
  const normalized = normalizeName(schoolName);
  const normalizedBase = normalizeName(schoolName, true);
  if (!normalized) return '';

  const exact = schoolDomainEntries.find((entry) => entry.name === normalized);
  if (exact) return exact.domain;

  const partial = schoolDomainEntries.find(
    (entry) => normalizedBase.includes(entry.baseName) || entry.baseName.includes(normalizedBase)
  );
  return partial?.domain || '';
}

function resolveLogoSourceFromLink(link: string) {
  const domain = resolveDomain(link);
  if (!domain || aggregatorDomains.has(domain)) return '';
  return hasManifestMark(domain) ? link : '';
}

export function resolveNoticeLogoSource(project: Pick<PublicNoticeProject, 'schoolName' | 'sourceLink' | 'applyLink'>) {
  const schoolDomain = resolveDomainBySchoolName(project.schoolName);
  if (schoolDomain && siteMarkManifest[schoolDomain]) {
    return `https://${schoolDomain}/`;
  }

  return (
    resolveLogoSourceFromLink(project.sourceLink) ||
    resolveLogoSourceFromLink(project.applyLink) ||
    project.sourceLink ||
    project.applyLink ||
    project.schoolName
  );
}
