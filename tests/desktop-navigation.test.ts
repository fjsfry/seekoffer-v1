import { describe, expect, it } from 'vitest';
import {
  canonicalizeDesktopRoute,
  isSameDesktopHref,
  normalizeDesktopHref,
  normalizeDesktopPathname,
  shouldEmitDesktopRouteChange
} from '@/lib/desktop-navigation';

describe('desktop navigation URL identity', () => {
  const current = 'https://desktop.seekoffer.local/me?view=applications&status=active';

  it('treats a trailing slash as the same route', () => {
    expect(isSameDesktopHref(current, '/me/?view=applications&status=active')).toBe(true);
    expect(
      shouldEmitDesktopRouteChange(current, '/me/?view=applications&status=active')
    ).toBe(false);
  });

  it('normalizes direct-load pathnames before the desktop shell chooses a surface', () => {
    expect(normalizeDesktopPathname('/guide/')).toBe('/guide');
    expect(normalizeDesktopPathname('/resources///')).toBe('/resources');
    expect(normalizeDesktopPathname('/')).toBe('/');
    expect(normalizeDesktopPathname('')).toBe('/');
  });

  it('treats reordered query parameters as the same route', () => {
    expect(isSameDesktopHref(current, '/me?status=active&view=applications')).toBe(true);
    expect(
      shouldEmitDesktopRouteChange(current, '/me?status=active&view=applications')
    ).toBe(false);
  });

  it('keeps hash changes as distinct navigation targets', () => {
    expect(isSameDesktopHref(`${current}#materials`, `${current}#timeline`)).toBe(false);
    expect(isSameDesktopHref(current, `${current}#materials`)).toBe(false);
    expect(shouldEmitDesktopRouteChange(current, `${current}#materials`)).toBe(true);
  });

  it('keeps otherwise identical URLs on different origins distinct', () => {
    expect(
      isSameDesktopHref(current, 'https://www.seekoffer.com/me?status=active&view=applications')
    ).toBe(false);
    expect(
      shouldEmitDesktopRouteChange(
        current,
        'https://www.seekoffer.com/me?status=active&view=applications'
      )
    ).toBe(true);
  });

  it('resolves relative links against the current desktop origin', () => {
    expect(normalizeDesktopHref('../notices/?type=deadline', current)).toBe(
      'https://desktop.seekoffer.local/notices?type=deadline'
    );
  });

  it('returns a safe non-match for invalid navigation input', () => {
    expect(normalizeDesktopHref('https://[invalid', current)).toBeNull();
    expect(isSameDesktopHref(current, 'https://[invalid')).toBe(false);
  });

  it('maps every legacy applications entry point to the canonical root workspace', () => {
    expect(canonicalizeDesktopRoute('/applications', current)).toBe('/');
    expect(canonicalizeDesktopRoute('/applications?status=active#materials', current)).toBe('/');
    expect(canonicalizeDesktopRoute('/me', current)).toBe('/');
    expect(canonicalizeDesktopRoute('/me?view=applications&status=active', current)).toBe('/');
  });

  it('keeps schedule and contacts as distinct me routes', () => {
    expect(canonicalizeDesktopRoute('/me?view=schedule', current)).toBe('/me?view=schedule');
    expect(canonicalizeDesktopRoute('/me?view=contacts', current)).toBe('/me?view=contacts');
  });

  it('rejects an external route before desktop launch restoration', () => {
    expect(canonicalizeDesktopRoute('https://www.seekoffer.com/applications', current)).toBeNull();
  });
});
