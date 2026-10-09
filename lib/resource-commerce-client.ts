export type ResourceProduct = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  coverUrl: string | null;
  amountCents: number;
  currency: string;
  version: number;
  features: string[];
  files: Array<{ id: string; filename: string; contentType: string; byteSize: number | null; deliveryType: 'download' | 'external_link' }>;
  fileCount: number;
};

export type ResourceOrder = {
  orderNo: string;
  status: string;
  title: string;
  productSlug: string | null;
  amountCents: number;
  currency: string;
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
  fulfilledAt: string | null;
  payment: {
    id: string;
    status: string;
    payMethod: string;
    providerOrderId: string | null;
    payUrl: string | null;
    payQrcodeUrl: string | null;
    expiresAt: string;
  } | null;
  delivery: { files: ResourceProduct['files'] } | null;
  accessMode: string | null;
};

export class ResourceCommerceError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, code?: string) {
    super(code || 'RESOURCE_COMMERCE_REQUEST_FAILED');
    this.name = 'ResourceCommerceError';
    this.status = status;
    this.code = code;
  }
}

function apiOrigin() {
  const configured = process.env.NEXT_PUBLIC_D1_API_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return 'http://127.0.0.1:8787';
  }
  throw new ResourceCommerceError(503, 'RESOURCE_API_NOT_CONFIGURED');
}

async function request<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${apiOrigin()}${path}`, { ...init, headers, signal: init.signal || AbortSignal.timeout(12000) });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ResourceCommerceError(response.status, body?.error);
  }
  return response.json() as Promise<T>;
}

export function createResourceRequestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `web-${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function saveResourceOrderAccess(orderNo: string, accessToken: string) {
  if (typeof window === 'undefined') return;
  const current = readResourceOrderAccesses();
  const next = [{ orderNo, accessToken, savedAt: new Date().toISOString() }, ...current.filter(item => item.orderNo !== orderNo)].slice(0, 12);
  window.localStorage.setItem('seekoffer-resource-order-access', JSON.stringify(next));
}

export function readResourceOrderAccesses(): Array<{ orderNo: string; accessToken: string; savedAt: string }> {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem('seekoffer-resource-order-access') || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.orderNo === 'string' && typeof item.accessToken === 'string') : [];
  } catch {
    return [];
  }
}

export function readResourceOrderAccess(orderNo: string) {
  return readResourceOrderAccesses().find(item => item.orderNo === orderNo) || null;
}

export async function readResourceProduct(slug: string) {
  return request<{ product: ResourceProduct }>(`/v1/resources/products/${encodeURIComponent(slug)}`);
}

export async function createResourceOrder(input: { productSlug: string; contactValue: string; contactType?: 'email' | 'wechat' | 'qq' }) {
  return request<{ order: ResourceOrder; accessToken: string }>('/v1/resources/orders', {
    method: 'POST',
    body: JSON.stringify({
      productSlug: input.productSlug,
      requestId: createResourceRequestId(),
      contactType: input.contactType || 'email',
      contactValue: input.contactValue,
      consent: true,
      website: ''
    })
  });
}

export async function createResourcePayment(orderNo: string, accessToken: string, payMethod: 'wx' | 'alipay') {
  return request<{ order: ResourceOrder }>(`/v1/resources/orders/${encodeURIComponent(orderNo)}/payments`, {
    method: 'POST',
    body: JSON.stringify({ accessToken, payMethod })
  });
}

export async function readResourceOrder(orderNo: string, accessToken: string) {
  return request<ResourceOrder>(`/v1/resources/orders/${encodeURIComponent(orderNo)}`, {
    headers: { 'X-Resource-Access-Token': accessToken }
  });
}

export async function simulateResourcePayment(orderNo: string, accessToken: string) {
  return request<{ order: ResourceOrder }>(`/v1/resources/orders/${encodeURIComponent(orderNo)}/simulate-payment`, {
    method: 'POST',
    body: JSON.stringify({ accessToken })
  });
}

export function validateResourceDeliveryUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && ['pan.baidu.com', 'yun.baidu.com'].includes(url.hostname) && url.pathname.startsWith('/s/') && !url.username && !url.password && !url.port) return url.href;
  } catch { /* Invalid links must never navigate the buyer away from the order. */ }
  throw new ResourceCommerceError(503, 'RESOURCE_EXTERNAL_DELIVERY_NOT_CONFIGURED');
}

export async function downloadResourceFile(fileId: string, accessToken: string): Promise<{ kind: 'file'; blob: Blob } | { kind: 'external_link'; url: string }> {
  const headers = new Headers({ Accept: '*/*', 'X-Resource-Access-Token': accessToken });
  const response = await fetch(`${apiOrigin()}/v1/resources/files/${encodeURIComponent(fileId)}`, { headers, signal: AbortSignal.timeout(20000) });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ResourceCommerceError(response.status, body?.error);
  }
  if (response.headers.get('content-type')?.includes('application/json')) {
    const body = (await response.json().catch(() => null)) as { delivery?: { type?: string; url?: string } } | null;
    if (body?.delivery?.type === 'external_link' && typeof body.delivery.url === 'string') return { kind: 'external_link', url: validateResourceDeliveryUrl(body.delivery.url) };
    throw new ResourceCommerceError(503, 'RESOURCE_EXTERNAL_DELIVERY_NOT_CONFIGURED');
  }
  return { kind: 'file', blob: await response.blob() };
}
