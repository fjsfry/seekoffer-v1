import { collegeDirectory } from './college-directory';
import type { PublicNoticeProject } from './mock-data';
import { siteMarkManifest } from './site-mark-manifest';
import { urongdaSchoolLogoMap } from './urongda-school-logo-map';

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
  const normalized = value.normalize('NFKC');
  const text = stripParenthetical ? normalized.replace(/\([^)]*\)/g, '') : normalized;
  return text
    .replace(/\s+/g, '')
    .replace(/[()（）]/g, '')
    .replace(/^[【\[\]】]+|[【\[\]】]+$/g, '')
    .trim();
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

const urongdaLogoEntries = Object.entries(urongdaSchoolLogoMap);

const schoolLogoAliasNames = [
  { match: '中国社科院大学', target: '中国社会科学院大学' },
  { match: '国防科技大学', target: '中国人民解放军国防科技大学' },
  { match: '清华经管学院', target: '清华大学' }
].map((item) => ({
  match: normalizeName(item.match),
  target: normalizeName(item.target)
}));

function resolveDomainBySchoolName(schoolName: string) {
  const normalized = normalizeName(schoolName);
  const normalizedBase = normalizeName(schoolName, true);
  if (!normalized) return '';

  const exact = schoolDomainEntries.find((entry) => entry.name === normalized);
  if (exact) return exact.domain;

  const partial = schoolDomainEntries.find(
    (entry) =>
      entry.baseName &&
      normalizedBase &&
      (normalizedBase.includes(entry.baseName) || entry.baseName.includes(normalizedBase))
  );
  return partial?.domain || '';
}

function resolveRemoteSchoolLogoByName(schoolName: string) {
  const normalized = normalizeName(schoolName);
  const normalizedBase = normalizeName(schoolName, true);
  if (!normalized) return '';

  const candidates = [normalized, normalizedBase].filter(Boolean);
  for (const alias of schoolLogoAliasNames) {
    if (normalized.includes(alias.match)) {
      candidates.push(alias.target);
    }
  }

  for (const candidate of [...new Set(candidates)]) {
    const exact = urongdaSchoolLogoMap[candidate];
    if (exact) return exact;

    if (candidate.length < 4) {
      continue;
    }

    const matches = urongdaLogoEntries.filter(
      ([entryName]) => entryName.includes(candidate) || candidate.includes(entryName)
    );

    if (matches.length === 1) {
      return matches[0][1];
    }
  }

  return '';
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
    resolveRemoteSchoolLogoByName(project.schoolName) ||
    resolveLogoSourceFromLink(project.sourceLink) ||
    resolveLogoSourceFromLink(project.applyLink) ||
    project.sourceLink ||
    project.applyLink ||
    project.schoolName
  );
}
