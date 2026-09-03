import { getDesktopDownloadUrls } from '@/lib/server/desktop-download-urls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  const { githubInstallerUrl } = getDesktopDownloadUrls();

  return new Response(null, {
    status: 307,
    headers: {
      Location: githubInstallerUrl,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });
}
