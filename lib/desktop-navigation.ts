export function normalizeDesktopPathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

/**
 * Produces a stable representation for internal desktop navigation URLs.
 *
 * Keeping this independent from `window` lets the shell make navigation
 * decisions before it emits the global pending-route event, and makes the
 * edge cases directly testable.
 */
export function normalizeDesktopHref(href: string, baseHref: string): string | null {
  try {
    const url = new URL(href, baseHref);
    const pathname = normalizeDesktopPathname(url.pathname);
    const searchParams = new URLSearchParams(url.search);
    searchParams.sort();
    const search = searchParams.toString();

    return `${url.origin}${pathname}${search ? `?${search}` : ''}${url.hash}`;
  } catch {
    return null;
  }
}

/**
 * Maps legacy desktop workspace entry points to the canonical applications
 * workspace while rejecting routes from another origin.
 */
export function canonicalizeDesktopRoute(href: string, baseHref: string): string | null {
  const normalizedHref = normalizeDesktopHref(href, baseHref);
  const normalizedBase = normalizeDesktopHref(baseHref, baseHref);

  if (!normalizedHref || !normalizedBase) return null;

  const url = new URL(normalizedHref);
  const base = new URL(normalizedBase);
  if (url.origin !== base.origin) return null;

  const legacyApplicationsRoute =
    url.pathname === '/applications' ||
    (url.pathname === '/me' && (!url.searchParams.get('view') || url.searchParams.get('view') === 'applications'));

  if (legacyApplicationsRoute) return '/';

  return `${url.pathname}${url.search}${url.hash}`;
}

export function isSameDesktopHref(currentHref: string, nextHref: string): boolean {
  const current = normalizeDesktopHref(currentHref, currentHref);
  const next = normalizeDesktopHref(nextHref, currentHref);

  return Boolean(current && next && current === next);
}

/** The shell emits its pending-route signal only when this returns true. */
export function shouldEmitDesktopRouteChange(currentHref: string, nextHref: string): boolean {
  return !isSameDesktopHref(currentHref, nextHref);
}
