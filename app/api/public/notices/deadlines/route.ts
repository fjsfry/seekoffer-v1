import { publicServiceErrorResponse } from '@/lib/service-availability';
import { getCachedDeadlineNotices } from '@/lib/server/public-notice-catalog';
import { toNoticeListItem } from '@/lib/notice-record';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
  const result = await getCachedDeadlineNotices();

  return Response.json(
    {
      items: result.items.map(toNoticeListItem),
      source: result.source,
      servedAt: new Date().toISOString()
    },
    {
      headers: {
        'Cache-Control': 'no-store'
      }
    }
  );
  } catch (error) { return publicServiceErrorResponse(error); }
}
