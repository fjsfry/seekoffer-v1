'use client';

import { useMemo, useState } from 'react';
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
  const [mode, setMode] = useState<'local' | 'remote' | 'text'>('local');
  const domain = useMemo(() => resolveDomain(source), [source]);
  const localSrc = domain ? siteMarkManifest[domain] : '';
  const imageSrc = mode === 'local' && localSrc ? localSrc : mode !== 'text' && domain ? buildFaviconUrl(domain) : '';

  const dimensions =
    size === 'sm'
      ? 'h-10 w-10 text-base'
      : size === 'lg'
        ? 'h-16 w-16 text-2xl'
        : 'h-12 w-12 text-lg';

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
          className="h-full w-full object-contain p-2"
          loading="lazy"
          onError={() => {
            if (mode === 'local' && localSrc) {
              setMode('remote');
              return;
            }
            setMode('text');
          }}
        />
      ) : (
        <span className="font-semibold text-brand">{initial}</span>
      )}
    </div>
  );
}
