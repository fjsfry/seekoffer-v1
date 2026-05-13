export function buildNoticeDetailHref(id: string, returnTo?: string) {
  const params = new URLSearchParams({ id });

  if (returnTo) {
    params.set('returnTo', returnTo);
  }

  return `/notices/detail?${params.toString()}`;
}
