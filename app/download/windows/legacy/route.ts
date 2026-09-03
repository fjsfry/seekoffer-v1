import { getDesktopDownloadUrls } from '@/lib/server/desktop-download-urls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  const { legacyInstallerUrl } = getDesktopDownloadUrls();

  return new Response(null, {
    status: 307,
    headers: {
      Location: legacyInstallerUrl,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });
}
