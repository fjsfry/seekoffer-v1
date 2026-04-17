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

function parseDomains() {
  return Promise.all([
    fs.readFile(path.join(projectRoot, 'lib', 'college-directory.ts'), 'utf8'),
    fs.readFile(path.join(projectRoot, 'lib', 'portal-data.ts'), 'utf8')
  ]).then(([collegeSource, portalSource]) => {
    const entries = new Map();

    const collegeRegex = /\['([^']+)',\s*'[^']*',\s*'[^']*',\s*'([^']+)',\s*'([^']+)'\]/g;
    let collegeMatch = collegeRegex.exec(collegeSource);
    while (collegeMatch) {
      const [, label, sourceUrl, domain] = collegeMatch;
      entries.set(domain, { label, sourceUrl, domain });
      collegeMatch = collegeRegex.exec(collegeSource);
    }

    const hrefRegex = /title:\s*'([^']+)'[\s\S]*?href:\s*'([^']+)'/g;
    let hrefMatch = hrefRegex.exec(portalSource);
    while (hrefMatch) {
      const [, label, sourceUrl] = hrefMatch;
      try {
        const domain = new URL(sourceUrl).hostname.replace(/^www\./, '');
        entries.set(domain, { label, sourceUrl, domain });
      } catch {
        // ignore malformed url
      }
      hrefMatch = hrefRegex.exec(portalSource);
    }

    return Array.from(entries.values());
  });
}

function safeName(domain) {
  return domain.replace(/[^a-zA-Z0-9.-]/g, '_');
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
    .map((tag) => ({ tag, attrs: parseAttributes(tag) }))
    .filter(({ attrs }) => attrs.rel && attrs.href)
    .map(({ attrs }) => {
      const rel = attrs.rel.toLowerCase();
      const href = resolveAbsoluteUrl(attrs.href, baseUrl);
      const sizeScore = parseSizeValue(attrs.sizes);
      let relScore = 0;

      if (rel.includes('apple-touch-icon')) {
        relScore = 400;
      } else if (rel.includes('icon')) {
        relScore = 250;
      } else if (rel.includes('shortcut')) {
        relScore = 180;
      }

      return {
        href,
        score: relScore + sizeScore
      };
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
  const { sourceUrl, domain } = entry;

  try {
    const response = await fetch(sourceUrl, { headers: REQUEST_HEADERS, redirect: 'follow' });
    const effectiveUrl = response.url || sourceUrl;
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

  const googleFallback = `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;
  return fetchImage(googleFallback);
}

async function main() {
  await fs.mkdir(publicDir, { recursive: true });
  const entries = await parseDomains();
  const manifest = {};

  for (const entry of entries) {
    const icon = await fetchBestIcon(entry);
    if (!icon) {
      continue;
    }

    const fileName = `${safeName(entry.domain)}${icon.ext}`;
    await fs.writeFile(path.join(publicDir, fileName), icon.buffer);
    manifest[entry.domain] = `/site-marks/${fileName}`;
  }

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
