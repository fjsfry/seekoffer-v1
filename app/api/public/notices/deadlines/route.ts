import { getCachedDeadlineNotices } from '@/lib/server/public-notice-catalog';
import { toNoticeListItem } from '@/lib/notice-record';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await getCachedDeadlineNotices();

  return Response.json(
    {
      items: result.items.map(toNoticeListItem),
      source: result.source,
      servedAt: new Date().toISOString()
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800'
      }
    }
  );
}
