import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(projectRoot, 'public', 'site-marks');
const manifestPath = path.join(projectRoot, 'lib', 'site-mark-manifest.ts');

const REQUEST_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
};

const resourceLogoOverrides = {
  'wanfangdata.com.cn': {
    kind: 'wanfang',
    mark: '\u4e07\u65b9',
    subMark: 'DATA',
    bg: '#F2FAF8',
    ring: '#CFE7E1',
    ink: '#106C67',
    accent: '#F28F45'
  },
  'webofscience.com': {
    kind: 'wos',
    mark: 'WoS',
    bg: '#EEF2FF',
    ring: '#D8E1FF',
    ink: '#3558B8',
    accent: '#6D8CFF'
  },
  'researchgate.net': {
    kind: 'researchgate',
    mark: 'RG',
    bg: '#ECFBF7',
    ring: '#CDEDE6',
    ink: '#00A07A',
    accent: '#56D9BA'
  },
  'moe.gov.cn': {
    kind: 'moe',
    mark: '\u6559\u80b2\u90e8',
    subMark: 'MOE',
    bg: '#EFF8F5',
    ring: '#D5EADF',
    ink: '#166A56',
    accent: '#D85745'
  },
  'nsfc.gov.cn': {
    kind: 'nsfc',
    mark: 'NSFC',
    bg: '#F5F2FF',
    ring: '#E2D8FF',
    ink: '#6647B8',
    accent: '#9A7DFF'
  },
  'acge.org.cn': {
    kind: 'acge',
    mark: '\u5b66\u4f1a',
    subMark: 'ACGE',
    bg: '#FFF5EF',
    ring: '#F2DDCF',
    ink: '#9A4F2A',
    accent: '#E48A59'
  },
  'yz.chsi.com.cn': {
    kind: 'yz',
    mark: '\u7814\u62db',
    subMark: 'CHSI',
    bg: '#F2F7FF',
    ring: '#D4E2F7',
    ink: '#2D5A98',
    accent: '#DD4545'
  }
};

function isValidDomain(value = '') {
  return /^[a-z0-9.-]+$/i.test(value);
}

function normalizeSchoolName(value = '') {
  return value
    .trim()
    .replace(/\s+/g, '')
    .replace(/[()（）]/g, '')
    .replace(/\u00b7/g, '-')
    .replace(/\u8def/g, '');
}

async function parseDomains() {
  const [collegeSource, portalSource] = await Promise.all([
    fs.readFile(path.join(projectRoot, 'lib', 'college-directory.ts'), 'utf8'),
    fs.readFile(path.join(projectRoot, 'lib', 'portal-data.ts'), 'utf8')
  ]);

  const entries = new Map();
  const collegeRegex = /^\s*\['([^']+)',\s*'[^']*',\s*'[^']*',\s*'([^']+)',\s*'([^']+)'\],?$/gm;
  let collegeMatch = collegeRegex.exec(collegeSource);
  while (collegeMatch) {
    const [, label, sourceUrl, domain] = collegeMatch;
    if (isValidDomain(domain)) {
      entries.set(domain, { label, sourceUrl, domain, kind: 'college' });
    }
    collegeMatch = collegeRegex.exec(collegeSource);
  }

  const hrefRegex = /\{[^{}]*title:\s*'([^']+)'[^{}]*href:\s*'([^']+)'[^{}]*\}/g;
  let hrefMatch = hrefRegex.exec(portalSource);
  while (hrefMatch) {
    const [, label, sourceUrl] = hrefMatch;
    try {
      const domain = new URL(sourceUrl).hostname.replace(/^www\./, '');
      if (isValidDomain(domain)) {
        entries.set(domain, { label, sourceUrl, domain, kind: 'resource' });
      }
    } catch {
      // ignore malformed url
    }
    hrefMatch = hrefRegex.exec(portalSource);
  }

  return Array.from(entries.values());
}

async function fetchUrongdaSchoolLogos() {
  try {
    const response = await fetch('https://www.urongda.com/logos', {
      headers: REQUEST_HEADERS,
      redirect: 'follow'
    });

    if (!response.ok) {
      return new Map();
    }

    const html = await response.text();
    const pattern =
      /<img[^>]+src="(https:\/\/cdn\.urongda\.com\/images\/schools\/[^"]+\/1024w\/[^"]+)"[^>]+alt="([^"]+?)\u6821\u5fbd\u77e2\u91cf\u56fe/gu;
    const matches = [...html.matchAll(pattern)];
    const logoMap = new Map();

    for (const [, imageUrl, schoolName] of matches) {
      logoMap.set(normalizeSchoolName(schoolName), imageUrl);
    }

    return logoMap;
  } catch {
    return new Map();
  }
}

function safeName(domain) {
  return domain.replace(/[^a-zA-Z0-9.-]/g, '_');
}

function buildInitials(label = '', domain = '') {
  const cleanLabel = label.replace(/\s+/g, '').trim();
  const cjkChars = [...cleanLabel].filter((char) => /[\u3400-\u9fff]/u.test(char));
  if (cjkChars.length >= 2) {
    return cjkChars.slice(0, 2).join('');
  }

  const alphaParts = cleanLabel
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (alphaParts.length >= 2) {
    return `${alphaParts[0][0]}${alphaParts[1][0]}`.toUpperCase();
  }

  if (alphaParts.length === 1) {
    return alphaParts[0].slice(0, 2).toUpperCase();
  }

  return domain.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'SK';
}

function paletteFromSeed(seed) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360;
  }

  return {
    bg: `hsl(${hash} 70% 96%)`,
    ring: `hsl(${hash} 36% 80%)`,
    ink: `hsl(${hash} 52% 28%)`
  };
}

function encodeSvgText(value = '') {
  return [...value]
    .map((char) => {
      const code = char.codePointAt(0) || 0;
      return code > 127 ? `&#${code};` : char;
    })
    .join('');
}

function buildFallbackSvg(entry) {
  const initials = buildInitials(entry.label, entry.domain);
  const palette = paletteFromSeed(entry.domain || entry.label);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="8" width="112" height="112" rx="28" fill="${palette.bg}"/>
  <rect x="8.75" y="8.75" width="110.5" height="110.5" rx="27.25" stroke="${palette.ring}" stroke-width="1.5"/>
  <text x="64" y="72" text-anchor="middle" font-family="PingFang SC, Microsoft YaHei, Arial, sans-serif" font-size="${
    initials.length > 1 ? 38 : 52
  }" font-weight="700" fill="${palette.ink}">${initials}</text>
</svg>`;
}

function buildResourceOverrideSvg(entry, config) {
  const encodedMark = encodeSvgText(config.mark);
  const encodedSubMark = config.subMark ? encodeSvgText(config.subMark) : '';

  switch (config.kind) {
    case 'wanfang':
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="8" width="112" height="112" rx="28" fill="${config.bg}"/>
  <rect x="8.75" y="8.75" width="110.5" height="110.5" rx="27.25" stroke="${config.ring}" stroke-width="1.5"/>
  <path d="M95 24H104L83 104H74L95 24Z" fill="${config.accent}"/>
  <text x="50" y="67" text-anchor="middle" font-family="PingFang SC, Microsoft YaHei, Arial, sans-serif" font-size="34" font-weight="800" fill="${config.ink}">${encodedMark}</text>
  <text x="50" y="91" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="${config.ink}" letter-spacing="1.6">${encodedSubMark}</text>
</svg>`;
    case 'wos':
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="wos-accent" x1="24" y1="24" x2="104" y2="104" gradientUnits="userSpaceOnUse">
      <stop stop-color="#4B6DFF"/>
      <stop offset="1" stop-color="#67C1FF"/>
    </linearGradient>
  </defs>
  <rect x="8" y="8" width="112" height="112" rx="28" fill="${config.bg}"/>
  <rect x="8.75" y="8.75" width="110.5" height="110.5" rx="27.25" stroke="${config.ring}" stroke-width="1.5"/>
  <path d="M27 79C35 53 55 37 80 34" stroke="url(#wos-accent)" stroke-width="8" stroke-linecap="round"/>
  <path d="M33 91C48 84 66 83 87 88" stroke="#91A8FF" stroke-width="7" stroke-linecap="round"/>
  <circle cx="90" cy="36" r="7" fill="#4B6DFF"/>
  <circle cx="90" cy="89" r="6" fill="#67C1FF"/>
  <text x="48" y="64" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="${config.ink}">${encodedMark}</text>
</svg>`;
    case 'researchgate':
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="8" width="112" height="112" rx="28" fill="${config.bg}"/>
  <rect x="8.75" y="8.75" width="110.5" height="110.5" rx="27.25" stroke="${config.ring}" stroke-width="1.5"/>
  <path d="M33 89L51 45H59L77 89H69L65 77H44L39 89H33ZM47 69H62L54 49L47 69Z" fill="${config.ink}"/>
  <path d="M76 44H89C96 44 101 49 101 56C101 61 98 65 94 67L101 89H92L86 70H84V89H76V44ZM84 63H88C92 63 94 61 94 57C94 53 92 51 88 51H84V63Z" fill="${config.ink}"/>
  <circle cx="29" cy="33" r="6" fill="${config.accent}"/>
  <circle cx="47" cy="26" r="4" fill="${config.accent}"/>
  <path d="M33 33L44 28" stroke="${config.accent}" stroke-width="3" stroke-linecap="round"/>
</svg>`;
    case 'moe':
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="8" width="112" height="112" rx="28" fill="${config.bg}"/>
  <rect x="8.75" y="8.75" width="110.5" height="110.5" rx="27.25" stroke="${config.ring}" stroke-width="1.5"/>
  <rect x="24" y="24" width="24" height="24" rx="8" fill="${config.accent}"/>
  <text x="36" y="41" text-anchor="middle" font-family="PingFang SC, Microsoft YaHei, Arial, sans-serif" font-size="13" font-weight="800" fill="#FFFFFF">&#25945;</text>
  <text x="66" y="57" font-family="PingFang SC, Microsoft YaHei, Arial, sans-serif" font-size="23" font-weight="800" fill="${config.ink}">&#25945;&#32946;</text>
  <text x="66" y="79" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#5F8677" letter-spacing="1.2">${encodedSubMark}</text>
</svg>`;
    case 'nsfc':
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="8" width="112" height="112" rx="28" fill="${config.bg}"/>
  <rect x="8.75" y="8.75" width="110.5" height="110.5" rx="27.25" stroke="${config.ring}" stroke-width="1.5"/>
  <circle cx="64" cy="49" r="18" fill="#E9E2FF"/>
  <path d="M52 55L64 36L76 55H52Z" fill="${config.ink}"/>
  <path d="M55 60H73" stroke="${config.accent}" stroke-width="5" stroke-linecap="round"/>
  <text x="64" y="90" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="800" fill="${config.ink}" letter-spacing="1.5">${encodedMark}</text>
</svg>`;
    case 'acge':
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="8" width="112" height="112" rx="28" fill="${config.bg}"/>
  <rect x="8.75" y="8.75" width="110.5" height="110.5" rx="27.25" stroke="${config.ring}" stroke-width="1.5"/>
  <circle cx="40" cy="44" r="16" fill="#FFF1E8" stroke="${config.accent}" stroke-width="2"/>
  <text x="40" y="50" text-anchor="middle" font-family="PingFang SC, Microsoft YaHei, Arial, sans-serif" font-size="18" font-weight="800" fill="${config.ink}">&#23398;</text>
  <text x="67" y="50" font-family="PingFang SC, Microsoft YaHei, Arial, sans-serif" font-size="18" font-weight="800" fill="${config.ink}">${encodedMark}</text>
  <text x="67" y="73" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="#9E7259" letter-spacing="1.2">${encodedSubMark}</text>
</svg>`;
    case 'yz':
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="8" width="112" height="112" rx="28" fill="${config.bg}"/>
  <rect x="8.75" y="8.75" width="110.5" height="110.5" rx="27.25" stroke="${config.ring}" stroke-width="1.5"/>
  <path d="M29 42C38 27 57 23 74 29C63 35 55 45 53 57C48 54 43 52 35 52C34 49 32 45 29 42Z" fill="${config.accent}"/>
  <path d="M48 66C55 59 68 57 83 61C77 74 68 83 54 89L48 66Z" fill="${config.ink}"/>
  <text x="87" y="88" text-anchor="end" font-family="Arial, sans-serif" font-size="12" font-weight="800" fill="#4F6E9B" letter-spacing="1.2">${encodedSubMark}</text>
</svg>`;
    default: {
      const fontSize =
        config.mark.length >= 4 ? 26 : config.mark.length === 3 ? 30 : config.mark.length === 2 ? 38 : 42;
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="8" width="112" height="112" rx="28" fill="${config.bg}"/>
  <rect x="8.75" y="8.75" width="110.5" height="110.5" rx="27.25" stroke="${config.ring}" stroke-width="1.5"/>
  <rect x="18" y="18" width="18" height="6" rx="3" fill="${config.accent}"/>
  <text x="64" y="73" text-anchor="middle" font-family="PingFang SC, Microsoft YaHei, Arial, sans-serif" font-size="${fontSize}" font-weight="800" fill="${config.ink}">${encodedMark}</text>
</svg>`;
    }
  }
}

function resolveAbsoluteUrl(url, baseUrl) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return '';
  }
}

function parseAttributes(tag) {
  const attributes = {};
  const attrRegex = /([a-zA-Z:-]+)\s*=\s*["']([^"']+)["']/g;
  let match = attrRegex.exec(tag);
  while (match) {
    attributes[match[1].toLowerCase()] = match[2];
    match = attrRegex.exec(tag);
  }
  return attributes;
}

function parseSizeValue(sizesText = '') {
  const sizeMatches = [...sizesText.matchAll(/(\d+)x(\d+)/gi)];
  if (!sizeMatches.length) {
    return 0;
  }
  return Math.max(...sizeMatches.map((match) => Number(match[1]) || 0));
}

function pickBestIconTag(html, baseUrl) {
  const tags = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .map((tag) => ({ attrs: parseAttributes(tag) }))
    .filter(({ attrs }) => attrs.rel && attrs.href)
    .map(({ attrs }) => {
      const rel = attrs.rel.toLowerCase();
      const href = resolveAbsoluteUrl(attrs.href, baseUrl);
      const sizeScore = parseSizeValue(attrs.sizes);
      let relScore = 0;

      if (rel.includes('apple-touch-icon')) relScore = 400;
      else if (rel.includes('icon')) relScore = 250;
      else if (rel.includes('shortcut')) relScore = 180;

      return { href, score: relScore + sizeScore };
    })
    .filter((item) => item.href);

  return tags.sort((left, right) => right.score - left.score)[0]?.href || '';
}

function extensionFrom(contentType, sourceUrl) {
  if (contentType.includes('svg')) return '.svg';
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('webp')) return '.webp';
  if (contentType.includes('jpeg')) return '.jpg';
  if (contentType.includes('icon')) return '.ico';

  const urlPath = sourceUrl.split('?')[0].toLowerCase();
  if (urlPath.endsWith('.svg')) return '.svg';
  if (urlPath.endsWith('.png')) return '.png';
  if (urlPath.endsWith('.webp')) return '.webp';
  if (urlPath.endsWith('.jpg') || urlPath.endsWith('.jpeg')) return '.jpg';
  return '.ico';
}

async function fetchImage(candidateUrl) {
  try {
    const response = await fetch(candidateUrl, {
      headers: {
        ...REQUEST_HEADERS,
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      buffer,
      ext: extensionFrom(contentType, candidateUrl)
    };
  } catch {
    return null;
  }
}

async function fetchBestIcon(entry) {
  try {
    const response = await fetch(entry.sourceUrl, {
      headers: REQUEST_HEADERS,
      redirect: 'follow'
    });
    const effectiveUrl = response.url || entry.sourceUrl;
    const html = response.ok ? await response.text() : '';
    const bestTagUrl = html ? pickBestIconTag(html, effectiveUrl) : '';
    const origin = new URL(effectiveUrl).origin;

    const candidates = [
      bestTagUrl,
      resolveAbsoluteUrl('/apple-touch-icon.png', origin),
      resolveAbsoluteUrl('/favicon-192x192.png', origin),
      resolveAbsoluteUrl('/favicon.ico', origin)
    ].filter(Boolean);

    for (const candidate of [...new Set(candidates)]) {
      const image = await fetchImage(candidate);
      if (image) {
        return image;
      }
    }
  } catch {
    // ignore and fall through
  }

  return fetchImage(`https://www.google.com/s2/favicons?domain=${entry.domain}&sz=256`);
}

async function main() {
  await fs.mkdir(publicDir, { recursive: true });
  const entries = await parseDomains();
  const urongdaLogos = await fetchUrongdaSchoolLogos();
  const manifest = {};
  const writtenFiles = new Set();

  for (const entry of entries) {
    let icon = null;

    if (entry.kind === 'college') {
      const urongdaLogoUrl = urongdaLogos.get(normalizeSchoolName(entry.label));
      if (urongdaLogoUrl) {
        icon = await fetchImage(urongdaLogoUrl);
      }
    }

    if (!icon && entry.kind === 'resource') {
      const override = resourceLogoOverrides[entry.domain];
      if (override) {
        icon = {
          buffer: Buffer.from(buildResourceOverrideSvg(entry, override), 'utf8'),
          ext: '.svg'
        };
      }
    }

    if (!icon) {
      icon = await fetchBestIcon(entry);
    }

    const fileName = `${safeName(entry.domain)}${icon?.ext || '.svg'}`;

    if (icon) {
      await fs.writeFile(path.join(publicDir, fileName), icon.buffer);
    } else {
      await fs.writeFile(path.join(publicDir, fileName), buildFallbackSvg(entry), 'utf8');
    }

    writtenFiles.add(fileName);
    manifest[entry.domain] = `/site-marks/${fileName}`;
  }

  const existingFiles = await fs.readdir(publicDir);
  await Promise.all(
    existingFiles
      .filter((fileName) => !writtenFiles.has(fileName))
      .map((fileName) => fs.rm(path.join(publicDir, fileName), { force: true }))
  );

  const manifestFile = `export const siteMarkManifest: Record<string, string> = ${JSON.stringify(
    Object.fromEntries(Object.entries(manifest).sort(([left], [right]) => left.localeCompare(right))),
    null,
    2
  )};\n`;

  await fs.writeFile(manifestPath, manifestFile, 'utf8');
  console.log(`Cached ${Object.keys(manifest).length} site marks.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
