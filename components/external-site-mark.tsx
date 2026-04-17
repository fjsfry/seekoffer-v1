'use client';

import { useMemo } from 'react';
import { siteMarkManifest } from '@/lib/site-mark-manifest';

function resolveDomain(urlOrDomain: string) {
  if (!urlOrDomain) return '';

  try {
    const value = urlOrDomain.startsWith('http') ? new URL(urlOrDomain).hostname : urlOrDomain;
    return value.replace(/^www\./, '');
  } catch {
    return urlOrDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || '';
  }
}

function buildFaviconUrl(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;
}

export function ExternalSiteMark({
  source,
  label,
  size = 'md',
  rounded = 'xl'
}: {
  source: string;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  rounded?: 'full' | 'xl';
}) {
  const domain = useMemo(() => resolveDomain(source), [source]);
  const localSrc = domain ? siteMarkManifest[domain] : '';
  const imageSrc = localSrc || (domain ? buildFaviconUrl(domain) : '');

  const dimensions =
    size === 'sm'
      ? 'h-10 w-10 text-base'
      : size === 'lg'
        ? 'h-14 w-14 text-2xl'
        : 'h-11 w-11 text-lg';

  const radius = rounded === 'full' ? 'rounded-full' : 'rounded-2xl';
  const initial = (label || domain || '?').trim().slice(0, 1).toUpperCase();

  return (
    <div
      className={`relative flex ${dimensions} ${radius} items-center justify-center overflow-hidden border border-black/5 bg-white shadow-sm`}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={`${label} logo`}
          className="h-full w-full object-contain p-1.5"
          loading="lazy"
          onError={(event) => {
            const target = event.currentTarget;
            target.style.display = 'none';
            const fallback = target.nextElementSibling;
            if (fallback instanceof HTMLElement) {
              fallback.style.display = 'flex';
            }
          }}
        />
      ) : null}
      <span className={`hidden h-full w-full items-center justify-center font-semibold text-brand ${imageSrc ? 'hidden' : 'flex'}`}>
        {initial}
      </span>
    </div>
  );
}
