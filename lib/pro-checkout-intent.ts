export type CheckoutOperation = { requestId: string; planId: string; catalogVersion: string; termsVersion: string; provider: 'wechat' | 'alipay'; orderId?: string; outcome: 'prepared' | 'unknown' | 'known' };
const prefix = 'seekoffer-pro-checkout-v1:';
function key(owner: string) { return prefix + owner; }
export function readCheckoutOperation(storage: Pick<Storage, 'getItem'>, owner: string): CheckoutOperation | null {
  try {
    const r = JSON.parse(storage.getItem(key(owner)) || 'null') as CheckoutOperation | null;
    if (!r || !/^[a-zA-Z0-9_-]{16,120}$/.test(r.requestId) || !['pro_monthly','pro_quarter','pro_yearly'].includes(r.planId) || !['wechat','alipay'].includes(r.provider) || !['prepared','unknown','known'].includes(r.outcome) || typeof r.catalogVersion !== 'string' || typeof r.termsVersion !== 'string') return null;
    if (r.orderId && !/^[a-zA-Z0-9_-]{16,120}$/.test(r.orderId)) return null;
    return r;
  } catch { return null; }
}
export function saveCheckoutOperation(storage: Pick<Storage, 'setItem'>, owner: string, operation: CheckoutOperation) { storage.setItem(key(owner), JSON.stringify(operation)); }
export function clearCheckoutOperation(storage: Pick<Storage, 'removeItem'>, owner: string) { storage.removeItem(key(owner)); }
