'use client';

import Image from 'next/image';
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

const badgePalettes = [
  { bg: '#EDF7F5', border: '#CBE3DE', fg: '#165C50' },
  { bg: '#F6F2FB', border: '#E0D4F2', fg: '#6D48A8' },
  { bg: '#EEF4FF', border: '#C9D8F6', fg: '#30589A' },
  { bg: '#FFF3EC', border: '#F7D7C8', fg: '#B55A33' },
  { bg: '#F3F7EC', border: '#D6E4BE', fg: '#557A21' },
  { bg: '#F7F1EE', border: '#E9D7D0', fg: '#8A5B47' }
] as const;

function pickBadgePalette(seed: string) {
  const value = seed || 'seekoffer';
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return badgePalettes[Math.abs(hash) % badgePalettes.length];
}

export function ExternalSiteMark({
  source,
  label,
  size = 'md',
  rounded = 'xl',
  variant = 'auto',
  layout = 'square'
}: {
  source: string;
  label: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  rounded?: 'full' | 'xl';
  variant?: 'auto' | 'badge' | 'image';
  layout?: 'square' | 'landscape';
}) {
  const [failedImageSrcs, setFailedImageSrcs] = useState<Record<string, true>>({});
  const domain = useMemo(() => resolveDomain(source), [source]);
  const localSrc = domain ? siteMarkManifest[domain] : '';
  const imageSrc = localSrc || '';
  const extension = imageSrc.split('?')[0].split('.').pop()?.toLowerCase() || '';

  const dimensions =
    layout === 'landscape'
      ? size === 'sm'
        ? 'h-10 w-16 text-sm'
        : size === 'xl'
          ? 'h-[4.5rem] w-[7.5rem] text-xl'
          : size === 'lg'
            ? 'h-[3.5rem] w-[5.75rem] text-lg'
            : 'h-12 w-[4.5rem] text-base'
      : size === 'sm'
        ? 'h-10 w-10 text-sm'
        : size === 'xl'
          ? 'h-[4.5rem] w-[4.5rem] text-2xl'
          : size === 'lg'
            ? 'h-[3.5rem] w-[3.5rem] text-xl'
            : 'h-12 w-12 text-base';

  const radius =
    layout === 'landscape' ? 'rounded-[1.35rem]' : rounded === 'full' ? 'rounded-full' : 'rounded-2xl';
  const initial = buildFallbackInitial(label, domain);
  const palette = pickBadgePalette(domain || label);
  const imageFailed = Boolean(imageSrc && failedImageSrcs[imageSrc]);
  const shouldUseImage =
    variant === 'image'
      ? Boolean(imageSrc) && !imageFailed
      : variant === 'badge'
        ? false
        : Boolean(imageSrc) && extension !== 'ico' && !imageFailed;
  const textSize =
    layout === 'landscape'
      ? size === 'sm'
        ? 'text-xs'
        : size === 'xl'
          ? 'text-lg'
          : size === 'lg'
            ? 'text-sm'
            : 'text-xs'
      : size === 'sm'
        ? 'text-sm'
        : size === 'xl'
          ? 'text-[1.3rem]'
          : size === 'lg'
            ? 'text-[1.05rem]'
            : 'text-base';

  return (
    <div
      className={`relative flex ${dimensions} ${radius} items-center justify-center overflow-hidden border border-black/5 shadow-sm`}
      style={
        shouldUseImage
          ? undefined
          : {
              background: palette.bg,
              borderColor: palette.border
            }
      }
      >
      {shouldUseImage ? (
        <Image
          src={imageSrc}
          alt={`${label} logo`}
          fill
          unoptimized
          sizes={layout === 'landscape' ? '120px' : '72px'}
          className={`bg-white object-contain ${layout === 'landscape' ? 'p-2.5' : 'p-1.5'}`}
          onError={() => {
            if (!imageSrc) {
              return;
            }

            setFailedImageSrcs((current) => {
              if (current[imageSrc]) {
                return current;
              }

              return {
                ...current,
                [imageSrc]: true
              };
            });
          }}
        />
      ) : null}
      <span
        className={`relative h-full w-full items-center justify-center font-black tracking-tight ${textSize} ${shouldUseImage ? 'hidden' : 'flex'}`}
        style={{
          display: shouldUseImage ? 'none' : 'flex',
          color: palette.fg
        }}
      >
        <span
          className={`absolute inset-[14%] border border-white/80 ${rounded === 'full' ? 'rounded-full' : 'rounded-[20px]'}`}
        />
        {initial}
      </span>
    </div>
  );
}
