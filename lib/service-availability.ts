// Separate circuits keep a public-catalog outage from disabling account/payment APIs.
import {isD1Backend} from './backend-mode';
export class ServiceUnavailableError extends Error {
  constructor(public readonly status: number, message = '服务维护中，请保留本地数据并稍后重试。') {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

export function createAvailabilityFetch(fetcher: typeof fetch = (...args) => fetch(...args)) {
  const restrictedOrigins = new Set<string>();
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = input instanceof Request ? input.url : String(input);
    const url = new URL(raw, 'https://local.invalid');
    if(isD1Backend()&&/\.supabase\.(co|com)$/.test(url.hostname))throw new ServiceUnavailableError(503,'旧服务回源已禁用，请保留本地数据。');
    const scope = url.origin === 'https://local.invalid' ? 'public-notices' : url.origin;
    if (restrictedOrigins.has(scope)) throw new ServiceUnavailableError(402);
    const response = await fetcher(input, init);
    if (response.status === 402) restrictedOrigins.add(scope);
    return response;
  };
}

export const publicNoticeFetch = createAvailabilityFetch();
export const accountServiceFetch = createAvailabilityFetch();

export function publicServiceErrorResponse(error: unknown) {
  const status = error instanceof ServiceUnavailableError ? error.status : 503;
  return Response.json({ error: status === 402 ? 'service_restricted' : 'public_notices_unavailable' }, {
    status,
    headers: { 'Cache-Control': 'no-store', 'Retry-After': '300' }
  });
}
