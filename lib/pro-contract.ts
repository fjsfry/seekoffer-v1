/** Customer-facing billing contract. Unknown shapes fail closed; table rows never reach views. */
export type BillingProvider = 'wechat' | 'alipay';
export type BillingPlan = {
  id: string; name: string; description: string; price_cents: number; currency: 'CNY';
  duration_days: number; benefits: string[]; sort_order: number; is_recommended: boolean;
  featureCodes: string[];
};
export type BillingProviderReadiness = Record<BillingProvider, { available: boolean; label: string }>;
export type BillingPlansResponse = {
  catalogVersion: string; productCode: 'seekoffer_pro'; serverTime: string; validUntil: string;
  saleState: 'available' | 'paused'; purchasesAvailable: boolean; termsVersion: string;
  plans: BillingPlan[]; freeLimit: number; freeFillLimit: number;
  providers: BillingProviderReadiness;
};
export type BillingFillUsage = {
  used: number; limit: number | null; remaining: number | null; unlimited: boolean;
  periodStart: string; periodEnd: string;
};
export type MembershipOverview = {
  state: 'free' | 'active' | 'expired'; expiresAt: string | null; revision: string;
  capabilities: { unlimitedApplications: boolean; unlimitedFillTransfers: boolean };
  applications: { used: number; limit: number | null; canCreate: boolean; overLimitRetained: boolean };
  fillTransfers: { used: number; limit: number | null; remaining: number | null; resetsAt: string };
};
export type BillingEntitlementResponse = MembershipOverview & { isPro: boolean; freeLimit: number };
export type BillingOrder = {
  id: string; planId: string; planName: string; amountCents: number; currency: 'CNY';
  durationDays: number | null; productCode: 'seekoffer_pro'; createdAt: string | null;
  expiresAt: string | null; paidAt: string | null; supportNumber: string;
  status: 'pending' | 'confirming' | 'paid' | 'fulfilled' | 'expired' | 'closed' | 'failed' | 'refunded';
  paymentStatus: 'pending' | 'unknown' | 'succeeded' | 'closed' | 'failed' | 'refunded';
  fulfillmentStatus: 'pending' | 'applied' | 'revoked';
  membershipRevision: string | null; membershipExpiresAt: string | null;
  canPay: boolean; checkoutUrl: string | null; qrCode: string | null;
};
export type BillingOrdersPage = { orders: BillingOrder[]; nextCursor: string | null };
const labels = { wechat: '微信支付', alipay: '支付宝' } as const;
const names: Record<string, string> = { pro_monthly: 'Pro 月度', pro_quarter: 'Pro 季度', pro_yearly: 'Pro 年度' };
const features: Record<string, string> = { 'applications.unlimited': '申请项目不限数量' };
type Row = Record<string, unknown>;
export class BillingContractError extends Error {
  constructor() { super('信息暂时无法确认，请重试。'); }
}
function fail(): never { throw new BillingContractError(); }
function row(value: unknown): Row { return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : fail(); }
function text(value: unknown, max = 160): string { return typeof value === 'string' && value.length > 0 && value.length <= max ? value : fail(); }
function count(value: unknown): number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : fail(); }
function bool(value: unknown): boolean { return typeof value === 'boolean' ? value : fail(); }
function date(value: unknown): string { const v = text(value); return Number.isFinite(Date.parse(v)) ? v : fail(); }
function nullableDate(value: unknown): string | null { return value === null || value === undefined ? null : date(value); }
function limit(value: unknown): number | null { return value === null ? null : count(value); }
function choice<T extends string>(value: unknown, values: readonly T[]): T { return values.includes(value as T) ? value as T : fail(); }
function id(value: unknown): string { const v = text(value, 120); return /^[a-zA-Z0-9_-]+$/.test(v) ? v : fail(); }

export function normalizeBillingCatalog(raw: unknown, now = Date.now()): BillingPlansResponse {
  const r = row(raw), modern = r.productCode === 'seekoffer_pro';
  if (!Array.isArray(r.plans)) fail();
  const providers: BillingProviderReadiness = { wechat: { label: labels.wechat, available: false }, alipay: { label: labels.alipay, available: false } };
  if (Array.isArray(r.paymentMethods)) {
    const seen = new Set<string>();
    for (const entry of r.paymentMethods) {
      const method = row(entry), key = choice(method.id, ['wechat', 'alipay']);
      if (seen.has(key)) fail();
      seen.add(key); providers[key].available = bool(method.available);
    }
  } else {
    const old = row(r.providers);
    for (const key of ['wechat', 'alipay'] as const) {
      providers[key].available = typeof old[key] === 'boolean' ? old[key] : bool(row(old[key]).available);
    }
    if (Object.keys(old).some(key => !(key in providers))) fail();
  }
  const plans = r.plans.map((value, index): BillingPlan => {
    const p = row(value), planId = id(p.id);
    if (!(planId in names) || (p.currency !== 'CNY')) fail();
    const price = count(p.priceCents ?? p.price_cents), days = count(p.durationDays ?? p.duration_days);
    if (!price || !days) fail();
    const featureCodes = Array.isArray(p.featureCodes) ? p.featureCodes.filter((v): v is string => typeof v === 'string' && v in features) : ['applications.unlimited'];
    return { id: planId, name: names[planId], description: '一次性购买，不自动续费', price_cents: price, currency: 'CNY', duration_days: days, featureCodes, benefits: featureCodes.map(v => features[v]), sort_order: index, is_recommended: p.recommended === true || p.is_recommended === true };
  });
  if (new Set(plans.map(p => p.id)).size !== plans.length) fail();
  const serverTime = modern ? date(r.serverTime) : new Date(now).toISOString();
  const validUntil = modern ? date(r.validUntil) : new Date(now + 60_000).toISOString();
  const available = modern && choice(r.saleState, ['available', 'paused']) === 'available'
    && Date.parse(validUntil) > now && plans.length > 0 && Object.values(providers).some(p => p.available);
  return { plans, providers, catalogVersion: modern ? text(r.catalogVersion) : 'legacy-read-only',
    productCode: 'seekoffer_pro', serverTime, validUntil, saleState: available ? 'available' : 'paused',
    purchasesAvailable: available, termsVersion: modern ? text(r.termsVersion) : 'review-pending',
    freeLimit: count(r.freeLimit), freeFillLimit: count(r.freeFillLimit) };
}

export function normalizeMembership(raw: unknown): BillingEntitlementResponse {
  const r = row(raw);
  if (r.applications && r.fillTransfers) {
    const a = row(r.applications), f = row(r.fillTransfers), c = row(r.capabilities);
    const state = choice(r.state, ['free', 'active', 'expired']);
    return { state, expiresAt: nullableDate(r.expiresAt), revision: text(r.revision),
      isPro: state === 'active', freeLimit: 5,
      capabilities: { unlimitedApplications: bool(c.unlimitedApplications), unlimitedFillTransfers: bool(c.unlimitedFillTransfers) },
      applications: { used: count(a.used), limit: limit(a.limit), canCreate: bool(a.canCreate), overLimitRetained: bool(a.overLimitRetained) },
      fillTransfers: { used: count(f.used), limit: limit(f.limit), remaining: limit(f.remaining), resetsAt: date(f.resetsAt) } };
  }
  const e = row(r.entitlement), usage = row(r.fillUsage), active = bool(r.isPro);
  const state = choice(e.status, ['free', 'active', 'expired', 'cancelled']);
  const used = count(r.applicationCount), freeLimit = count(r.freeLimit), unlimited = active || r.temporaryUnlimitedApplications === true;
  return { state: active ? 'active' : state === 'expired' || state === 'cancelled' ? 'expired' : 'free',
    expiresAt: nullableDate(e.expires_at), revision: 'legacy-read-only', isPro: active, freeLimit,
    capabilities: { unlimitedApplications: unlimited, unlimitedFillTransfers: active },
    applications: { used, limit: unlimited ? null : freeLimit, canCreate: unlimited || used < freeLimit, overLimitRetained: !unlimited && used > freeLimit },
    fillTransfers: { used: count(usage.used), limit: limit(usage.limit), remaining: limit(usage.remaining), resetsAt: date(usage.periodEnd) } };
}

export function safePaymentLink(value: unknown, qr = false): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  if (qr && /^weixin:\/\/wxpay\/[A-Za-z0-9/?=&%_.-]+$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || !['qr.alipay.com', 'openapi.alipay.com', 'mapi.alipay.com', 'wx.tenpay.com'].includes(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}

export function normalizeBillingOrder(raw: unknown, now = Date.now()): BillingOrder {
  const r = row(raw), modern = r.productCode === 'seekoffer_pro', planId = id(r.planId ?? r.plan_id);
  const expiresAt = nullableDate(r.expiresAt ?? r.expires_at);
  let status = choice(r.status, ['pending', 'confirming', 'paid', 'fulfilled', 'expired', 'closed', 'failed', 'refunded']);
  const paymentStatus = modern ? choice(r.paymentStatus, ['pending', 'unknown', 'succeeded', 'closed', 'failed', 'refunded'])
    : status === 'paid' || status === 'fulfilled' ? 'succeeded' : status === 'refunded' ? 'refunded' : status === 'failed' ? 'failed' : status === 'closed' ? 'closed' : 'pending';
  const fulfillmentStatus = modern ? choice(r.fulfillmentStatus, ['pending', 'applied', 'revoked']) : 'pending';
  if (paymentStatus === 'unknown') status = 'confirming';
  else if (status === 'pending' && expiresAt && Date.parse(expiresAt) <= now) status = 'expired';
  if (status === 'fulfilled' && (fulfillmentStatus !== 'applied' || !r.membershipRevision)) status = 'paid';
  const canPay = modern && r.canPay === true && status === 'pending' && Boolean(expiresAt && Date.parse(expiresAt) > now);
  return { id: id(r.id), planId, planName: names[planId] || '历史 Pro 方案', productCode: 'seekoffer_pro',
    amountCents: count(r.amountCents ?? r.amount_cents), currency: choice(r.currency, ['CNY']),
    durationDays: modern && r.durationDays !== null ? count(r.durationDays) : null,
    createdAt: nullableDate(r.createdAt ?? r.created_at), expiresAt, paidAt: nullableDate(r.paidAt ?? r.paid_at),
    supportNumber: id(r.supportNumber ?? r.out_trade_no ?? r.id), status, paymentStatus, fulfillmentStatus,
    membershipRevision: modern && r.membershipRevision ? text(r.membershipRevision) : null,
    membershipExpiresAt: modern ? nullableDate(r.membershipExpiresAt) : null, canPay,
    checkoutUrl: canPay ? safePaymentLink(r.checkoutUrl) : null, qrCode: canPay ? safePaymentLink(r.qrCode, true) : null };
}

export function normalizeOrdersPage(raw: unknown): BillingOrdersPage {
  const r = row(raw);
  if (!Array.isArray(r.orders)) fail();
  return { orders: r.orders.map(v => normalizeBillingOrder(v)), nextCursor: r.nextCursor ? text(r.nextCursor, 500) : null };
}
export function formatPlanPrice(cents: number) { return `¥${(cents / 100).toFixed(cents % 100 === 0 ? 0 : cents % 10 === 0 ? 1 : 2)}`; }
export function formatBillingDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '有效期未注明';
}
export function orderStatusLabel(order: BillingOrder) {
  return { pending: '待支付', confirming: '支付结果正在确认', paid: '支付已收到，正在开通', fulfilled: '已完成', expired: '已过期', closed: '已关闭', failed: '未完成', refunded: '已退款' }[order.status];
}
