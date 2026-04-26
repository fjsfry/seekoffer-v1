export function buildNoticeDetailHref(id: string) {
  return `/notices/detail?id=${encodeURIComponent(id)}`;
}
