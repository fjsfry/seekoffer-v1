// Preserved from the encrypted deployed baoyan-autofill Edge Function archive.
// Credentials are injected on the server; this module does not enable payments.
import { createHash, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";

export const JIANPAY_GATEWAY = "https://jpay.hzjianban.com";
const PAYMENT_PATHS = Object.freeze({
  create: "/open/payment/pay/create",
  query: "/open/payment/pay/info",
  refundCreate: "/open/payment/refund/create",
  refundQuery: "/open/payment/refund/query",
});

export class JianPayError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "JianPayError";
    this.code = code;
  }
}

function isEmptySignatureValue(value) {
  return value === "" || value === null || value === undefined;
}

function signatureValue(value) {
  return typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
}

export function canonicalizeJianPayParams(params) {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    throw new JianPayError("invalid_signature_payload", "JianPay signature payload must be an object.");
  }
  return Object.keys(params)
    .filter((key) => key !== "sign" && key !== "sign_type" && !isEmptySignatureValue(params[key]))
    .sort()
    .map((key) => `${key}=${signatureValue(params[key])}`)
    .join("&");
}

export function md5Hex(value) {
  return createHash("md5").update(String(value), "utf8").digest("hex").toLowerCase();
}

export function sha256Payload(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function signJianPayParams(params, merchantKey) {
  const key = String(merchantKey || "");
  if (key.length < 16 || key.length > 512) {
    throw new JianPayError("invalid_merchant_key", "JianPay merchant key is not configured.");
  }
  return md5Hex(canonicalizeJianPayParams(params) + key);
}

export function constantTimeHexEqual(left, right) {
  const a = String(left || "").toLowerCase();
  const b = String(right || "").toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(a) || !/^[a-f0-9]{32}$/.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

export function verifyJianPaySignature(params, merchantKey) {
  if (!params || typeof params !== "object" || Array.isArray(params)) return false;
  return constantTimeHexEqual(signJianPayParams(params, merchantKey), params.sign);
}

export function isJianPayCheckoutUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && url.origin === JIANPAY_GATEWAY && !url.username && !url.password && !url.hash;
  } catch {
    return false;
  }
}

function requiredString(value, code, minimum = 1, maximum = 200) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < minimum || text.length > maximum) {
    throw new JianPayError(code, "JianPay returned an invalid identifier.");
  }
  return text;
}

function integer(value, code, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new JianPayError(code, "JianPay returned an invalid numeric value.");
  }
  return number;
}

export function parseJianPayPaidAt(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)
    ? `${text.replace(" ", "T")}+08:00`
    : text;
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

export function validateJianPayPaymentData(data, expected = {}) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new JianPayError("invalid_payment_response", "JianPay returned invalid payment data.");
  }
  const normalized = {
    providerOrderId: requiredString(data.orderId, "invalid_provider_order", 6, 200),
    clientNo: requiredString(data.clientNo, "invalid_provider_client", 6, 64),
    merchantOrderNo: requiredString(data.merchantOrderNo, "invalid_merchant_order", 6, 64),
    amountCents: integer(data.amount, "invalid_provider_amount", 1, 1_000_000),
    status: integer(data.status, "invalid_provider_status", 0, 4),
    payMethod: typeof data.payMethod === "string" ? data.payMethod.trim() : "",
    payUrl: typeof data.payUrl === "string" ? data.payUrl.trim() : "",
    paidAt: parseJianPayPaidAt(data.paidAt),
  };
  if (expected.clientNo && normalized.clientNo !== expected.clientNo) {
    throw new JianPayError("client_no_mismatch", "JianPay merchant number did not match.");
  }
  if (expected.merchantOrderNo && normalized.merchantOrderNo !== expected.merchantOrderNo) {
    throw new JianPayError("merchant_order_mismatch", "JianPay merchant order did not match.");
  }
  if (expected.providerOrderId && normalized.providerOrderId !== expected.providerOrderId) {
    throw new JianPayError("provider_order_mismatch", "JianPay provider order did not match.");
  }
  if (expected.amountCents && normalized.amountCents !== expected.amountCents) {
    throw new JianPayError("amount_mismatch", "JianPay payment amount did not match.");
  }
  if (expected.payMethod && normalized.payMethod && normalized.payMethod !== expected.payMethod) {
    throw new JianPayError("pay_method_mismatch", "JianPay payment method did not match.");
  }
  return normalized;
}

export function validateJianPayRefundData(data, expected = {}) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new JianPayError("invalid_refund_response", "JianPay returned invalid refund data.");
  }
  const normalized = {
    providerRefundId: requiredString(data.refundId, "invalid_provider_refund", 6, 200),
    refundNo: requiredString(data.refundNo, "invalid_refund_no", 6, 64),
    providerOrderId: requiredString(data.orderId, "invalid_provider_order", 6, 200),
    clientNo: requiredString(data.clientNo || data.merchantNo, "invalid_provider_client", 6, 64),
    amountCents: integer(data.refundAmount ?? data.amount, "invalid_refund_amount", 1, 1_000_000),
    status: integer(data.status, "invalid_refund_status", 0, 3),
    errorMessage: typeof data.errorMessage === "string" ? data.errorMessage.trim().slice(0, 500) : "",
  };
  if (expected.clientNo && normalized.clientNo !== expected.clientNo) {
    throw new JianPayError("client_no_mismatch", "JianPay merchant number did not match.");
  }
  if (expected.refundNo && normalized.refundNo !== expected.refundNo) {
    throw new JianPayError("refund_no_mismatch", "JianPay refund number did not match.");
  }
  if (expected.providerOrderId && normalized.providerOrderId !== expected.providerOrderId) {
    throw new JianPayError("provider_order_mismatch", "JianPay provider order did not match.");
  }
  if (expected.amountCents && normalized.amountCents !== expected.amountCents) {
    throw new JianPayError("refund_amount_mismatch", "JianPay refund amount did not match.");
  }
  return normalized;
}

function timestampSeconds(now = Date.now()) {
  return String(Math.floor(now / 1000));
}

function signedPayload(params, merchantKey) {
  const payload = { ...params, timestamp: timestampSeconds(), sign_type: "MD5" };
  return { ...payload, sign: signJianPayParams(payload, merchantKey) };
}

async function postJianPay(pathname, params, credentials, options = {}) {
  const clientNo = String(credentials?.clientNo || "").trim();
  const merchantKey = String(credentials?.merchantKey || "");
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(clientNo)) {
    throw new JianPayError("invalid_client_no", "JianPay merchant number is not configured.");
  }
  const payload = signedPayload({ clientNo, ...params }, merchantKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 12_000);
  let response;
  let raw = "";
  try {
    response = await (options.fetchImpl || fetch)(`${JIANPAY_GATEWAY}${pathname}`, {
      method: "POST",
      // The pinned workerd rejects redirect:error before issuing the request.
      // Manual mode lets us reject redirects without forwarding signed data.
      redirect: "manual",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw new JianPayError("provider_redirect_rejected", "JianPay redirected the request unexpectedly.");
    }
    const reader = response.body?.getReader();
    const chunks = [];
    let size = 0;
    if (reader) {
      try {
        while (true) {
          const {done, value} = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 65_536) {
            await reader.cancel();
            throw new JianPayError("provider_response_too_large", "JianPay returned an oversized response.");
          }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
    }
    raw = Buffer.concat(chunks).toString("utf8");
  } catch (error) {
    if (error instanceof JianPayError) throw error;
    const code = error instanceof DOMException && error.name === "AbortError"
      ? "provider_timeout"
      : "provider_network_error";
    throw new JianPayError(code, "JianPay is temporarily unreachable.", { cause: error });
  } finally {
    clearTimeout(timeout);
  }
  if (raw.length > 65_536) {
    throw new JianPayError("provider_response_too_large", "JianPay returned an oversized response.");
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch (error) {
    throw new JianPayError("provider_invalid_json", "JianPay returned invalid JSON.", { cause: error });
  }
  if (!response.ok || Number(body?.code) !== 1000 || !body?.data) {
    throw new JianPayError("provider_rejected_request", "JianPay rejected the request.");
  }
  return { data: body.data, payloadHash: sha256Payload(raw) };
}

export async function createJianPayCheckout(input, credentials, options = {}) {
  const payMethod = input?.payMethod === "alipay" ? "alipay" : input?.payMethod === "wx" ? "wx" : "";
  if (!payMethod || !/^BYP[0-9]{8}[A-Z0-9]{12}$/.test(String(input?.merchantOrderNo || ""))) {
    throw new JianPayError("invalid_checkout_request", "Checkout request is invalid.");
  }
  const params = {
    amount: integer(input.amountCents, "invalid_checkout_amount", 100, 1_000_000),
    orderNo: input.merchantOrderNo,
    goodsName: requiredString(input.goodsName, "invalid_goods_name", 2, 64),
    payMethod,
  };
  if (input.notifyUrl) params.notifyUrl = requiredString(input.notifyUrl, "invalid_notify_url", 12, 500);
  if (input.returnUrl) params.returnUrl = requiredString(input.returnUrl, "invalid_return_url", 12, 500);
  const result = await postJianPay(PAYMENT_PATHS.create, params, credentials, options);
  const payment = validateJianPayPaymentData(result.data, {
    clientNo: credentials.clientNo,
    merchantOrderNo: input.merchantOrderNo,
    amountCents: input.amountCents,
    payMethod,
  });
  if (!isJianPayCheckoutUrl(payment.payUrl)) {
    throw new JianPayError("unsafe_checkout_url", "JianPay returned an untrusted checkout URL.");
  }
  return { ...payment, payloadHash: result.payloadHash };
}

export async function queryJianPayPayment(input, credentials, options = {}) {
  const providerOrderId = requiredString(input?.providerOrderId, "invalid_provider_order", 6, 200);
  const result = await postJianPay(PAYMENT_PATHS.query, { orderId: providerOrderId }, credentials, options);
  return {
    ...validateJianPayPaymentData(result.data, {
      clientNo: credentials.clientNo,
      providerOrderId,
      merchantOrderNo: input.merchantOrderNo,
      amountCents: input.amountCents,
    }),
    payloadHash: result.payloadHash,
  };
}

export async function createJianPayRefund(input, credentials, options = {}) {
  const params = {
    orderId: requiredString(input?.providerOrderId, "invalid_provider_order", 6, 200),
    refundNo: requiredString(input?.refundNo, "invalid_refund_no", 6, 64),
    refundAmount: integer(input?.amountCents, "invalid_refund_amount", 100, 1_000_000),
    reason: requiredString(input?.reason, "invalid_refund_reason", 3, 500),
  };
  const result = await postJianPay(PAYMENT_PATHS.refundCreate, params, credentials, options);
  return {
    ...validateJianPayRefundData(result.data, {
      clientNo: credentials.clientNo,
      providerOrderId: params.orderId,
      refundNo: params.refundNo,
      amountCents: params.refundAmount,
    }),
    payloadHash: result.payloadHash,
  };
}

export async function queryJianPayRefund(input, credentials, options = {}) {
  const refundNo = requiredString(input?.refundNo, "invalid_refund_no", 6, 64);
  const providerRefundId = typeof input?.providerRefundId === "string" && input.providerRefundId.trim()
    ? requiredString(input.providerRefundId, "invalid_provider_refund", 6, 200)
    : undefined;
  const result = await postJianPay(
    PAYMENT_PATHS.refundQuery,
    { ...(providerRefundId ? { refundId: providerRefundId } : {}), refundNo },
    credentials,
    options,
  );
  return {
    ...validateJianPayRefundData(result.data, {
      clientNo: credentials.clientNo,
      providerOrderId: input.providerOrderId,
      refundNo,
      amountCents: input.amountCents,
    }),
    payloadHash: result.payloadHash,
  };
}
