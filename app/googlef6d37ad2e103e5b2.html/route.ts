export const dynamic = 'force-static';

export function GET() {
  return new Response('google-site-verification: googlef6d37ad2e103e5b2.html', {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
}
