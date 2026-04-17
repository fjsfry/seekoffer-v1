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

function buildFallbackInitial(label: string, domain: string) {
  const cleanLabel = label.replace(/\s+/g, '').trim();
  const cjkChars = [...cleanLabel].filter((char) => /[\u3400-\u9fff]/u.test(char));

  if (cjkChars.length >= 2) {
    return cjkChars.slice(0, 2).join('');
  }

  if (cjkChars.length === 1) {
    return cjkChars[0];
  }

  const alpha = cleanLabel.replace(/[^a-zA-Z0-9]/g, '');
  if (alpha) {
    return alpha.slice(0, 2).toUpperCase();
  }

  return domain.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
}

export function ExternalSiteMark({
  source,
  label,
  size = 'md',
  rounded = 'xl'
}: {
  source: string;
  label: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  rounded?: 'full' | 'xl';
}) {
  const domain = useMemo(() => resolveDomain(source), [source]);
  const localSrc = domain ? siteMarkManifest[domain] : '';
  const imageSrc = localSrc || '';

  const dimensions =
    size === 'sm'
      ? 'h-10 w-10 text-sm'
      : size === 'xl'
        ? 'h-16 w-16 text-2xl'
      : size === 'lg'
        ? 'h-14 w-14 text-xl'
        : 'h-12 w-12 text-base';

  const radius = rounded === 'full' ? 'rounded-full' : 'rounded-2xl';
  const initial = buildFallbackInitial(label, domain);

  return (
    <div
      className={`relative flex ${dimensions} ${radius} items-center justify-center overflow-hidden border border-black/5 bg-slate-50 shadow-sm`}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={`${label} logo`}
          className="h-full w-full object-contain p-1"
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
      <span
        className={`h-full w-full items-center justify-center font-semibold tracking-tight text-brand ${imageSrc ? 'hidden' : 'flex'}`}
        style={{ display: imageSrc ? 'none' : 'flex' }}
      >
        {initial}
      </span>
    </div>
  );
}
