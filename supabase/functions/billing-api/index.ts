import { createClient } from 'npm:@supabase/supabase-js@2';

type SupabaseService = ReturnType<typeof createClient>;

type BillingPlan = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  duration_days: number;
  benefits: string[];
  sort_order: number;
  is_recommended: boolean;
};

type BillingOrder = {
  id: string;
  user_id: string;
  plan_id: string;
  provider: 'wechat' | 'alipay' | 'manual';
  out_trade_no: string;
  amount_cents: number;
  currency: string;
  status: string;
  code_url: string;
  checkout_url: string;
  expires_at: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-billing-admin-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const FREE_APPLICATION_LIMIT = 5;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

function text(status: number, body: string) {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
}

function env(name: string) {
  return (Deno.env.get(name) || '').trim();
}

function normalizePem(raw: string) {
  const value = raw.trim().replace(/\\n/g, '\n');
  if (value.includes('-----BEGIN')) {
    return value;
  }

  try {
    return new TextDecoder().decode(base64ToBytes(value));
  } catch {
    return value;
  }
}

function stripPem(pem: string) {
  return normalizePem(pem)
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
}

function base64ToBytes(input: string) {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToBase64(bytes: ArrayBuffer) {
  const view = new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function encode(input: string) {
  return new TextEncoder().encode(input);
}

async function importPrivateKey(pem: string) {
  return crypto.subtle.importKey(
    'pkcs8',
    base64ToBytes(stripPem(pem)),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );
}

async function importPublicKey(pem: string) {
  return crypto.subtle.importKey(
    'spki',
    base64ToBytes(stripPem(pem)),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['verify']
  );
}

async function signRsaSha256(content: string, privateKeyPem: string) {
  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encode(content));
  return bytesToBase64(signature);
}

async function verifyRsaSha256(content: string, signatureBase64: string, publicKeyPem: string) {
  const key = await importPublicKey(publicKeyPem);
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64ToBytes(signatureBase64), encode(content));
}

function createNonce(size = 16) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function formatAlipayTimestamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`;
}

function createOutTradeNo() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `SO${stamp}${createNonce(5).toUpperCase()}`;
}

function toYuan(cents: number) {
  return (cents / 100).toFixed(2);
}

function getServiceClients(request: Request) {
  const serviceUrl = env('SUPABASE_URL');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = env('SUPABASE_ANON_KEY');

  if (!serviceUrl || !serviceRoleKey || !anonKey) {
    return { error: json(500, { error: 'missing_supabase_env' }) };
  }

  const authHeader = request.headers.get('authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  const service = createClient(serviceUrl, serviceRoleKey);
  const userClient = createClient(serviceUrl, anonKey, {
    global: jwt
      ? {
          headers: {
            Authorization: `Bearer ${jwt}`
          }
        }
      : undefined
  });

  return { service, userClient, jwt };
}

async function requireUser(request: Request) {
  const clients = getServiceClients(request);
  if ('error' in clients) {
    return clients;
  }

  if (!clients.jwt) {
    return { error: json(401, { error: 'missing_auth_token' }) };
  }

  const { data, error } = await clients.userClient.auth.getUser(clients.jwt);
  if (error || !data.user) {
    return { error: json(401, { error: 'invalid_auth_token' }) };
  }

  return {
    service: clients.service,
    user: data.user
  };
}

async function listPlans(service: SupabaseService) {
  const { data, error } = await service
    .from('billing_plans')
    .select('id,name,description,price_cents,currency,duration_days,benefits,sort_order,is_recommended')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map((item) => ({
    ...item,
    benefits: Array.isArray(item.benefits) ? item.benefits : []
  })) as BillingPlan[];
}

async function getPlan(service: SupabaseService, planId: string) {
  const { data, error } = await service
    .from('billing_plans')
    .select('id,name,description,price_cents,currency,duration_days,benefits,sort_order,is_recommended')
    .eq('id', planId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? ({
        ...data,
        benefits: Array.isArray(data.benefits) ? data.benefits : []
      } as BillingPlan)
    : null;
}

async function getApplicationCount(service: SupabaseService, userId: string) {
  const { count, error } = await service
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  return count || 0;
}

function isActiveEntitlement(entitlement: Record<string, unknown> | null | undefined) {
  if (!entitlement || entitlement.status !== 'active') {
    return false;
  }

  const expiresAt = String(entitlement.expires_at || '');
  return !expiresAt || new Date(expiresAt).getTime() > Date.now();
}

async function getEntitlement(service: SupabaseService, userId: string) {
  const { data, error } = await service
    .from('user_entitlements')
    .select('user_id,plan_id,status,starts_at,expires_at,source_order_id,metadata')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data && data.status === 'active' && !isActiveEntitlement(data)) {
    await service.from('user_entitlements').update({ status: 'expired' }).eq('user_id', userId);
    return { ...data, status: 'expired' };
  }

  return data;
}

async function createWechatNativePayment(order: BillingOrder, plan: BillingPlan) {
  const appid = env('WECHAT_PAY_APPID');
  const mchid = env('WECHAT_PAY_MCH_ID');
  const privateKey = env('WECHAT_PAY_PRIVATE_KEY');
  const serialNo = env('WECHAT_PAY_CERT_SERIAL_NO');
  const notifyUrl = env('WECHAT_PAY_NOTIFY_URL');

  if (!appid || !mchid || !privateKey || !serialNo || !notifyUrl) {
    return {
      mode: 'not_configured',
      raw: {
        provider: 'wechat',
        missing: ['WECHAT_PAY_APPID', 'WECHAT_PAY_MCH_ID', 'WECHAT_PAY_PRIVATE_KEY', 'WECHAT_PAY_CERT_SERIAL_NO', 'WECHAT_PAY_NOTIFY_URL'].filter(
          (name) => !env(name)
        )
      }
    };
  }

  const path = '/v3/pay/transactions/native';
  const body = JSON.stringify({
    appid,
    mchid,
    description: `Seekoffer ${plan.name}`,
    out_trade_no: order.out_trade_no,
    notify_url: notifyUrl,
    amount: {
      total: order.amount_cents,
      currency: order.currency
    },
    attach: order.id,
    time_expire: new Date(order.expires_at).toISOString()
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = createNonce();
  const signature = await signRsaSha256(`POST\n${path}\n${timestamp}\n${nonce}\n${body}\n`, privateKey);
  const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${serialNo}"`;

  const response = await fetch(`https://api.mch.weixin.qq.com${path}`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.code_url) {
    throw new Error(`wechat_payment_failed:${JSON.stringify(payload)}`);
  }

  return {
    mode: 'qr',
    codeUrl: String(payload.code_url),
    raw: payload
  };
}

function buildAlipaySignContent(params: Record<string, string>, excludeSignType = false) {
  return Object.keys(params)
    .filter((key) => key !== 'sign' && (!excludeSignType || key !== 'sign_type'))
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
}

async function createAlipayPrecreatePayment(order: BillingOrder, plan: BillingPlan) {
  const appId = env('ALIPAY_APP_ID');
  const privateKey = env('ALIPAY_APP_PRIVATE_KEY');
  const notifyUrl = env('ALIPAY_NOTIFY_URL');
  const gateway = env('ALIPAY_GATEWAY') || 'https://openapi.alipay.com/gateway.do';

  if (!appId || !privateKey || !notifyUrl) {
    return {
      mode: 'not_configured',
      raw: {
        provider: 'alipay',
        missing: ['ALIPAY_APP_ID', 'ALIPAY_APP_PRIVATE_KEY', 'ALIPAY_NOTIFY_URL'].filter((name) => !env(name))
      }
    };
  }

  const params: Record<string, string> = {
    app_id: appId,
    method: 'alipay.trade.precreate',
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatAlipayTimestamp(),
    version: '1.0',
    notify_url: notifyUrl,
    biz_content: JSON.stringify({
      out_trade_no: order.out_trade_no,
      total_amount: toYuan(order.amount_cents),
      subject: `Seekoffer ${plan.name}`,
      timeout_express: '30m'
    })
  };

  params.sign = await signRsaSha256(buildAlipaySignContent(params), privateKey);

  const response = await fetch(gateway, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
    },
    body: new URLSearchParams(params)
  });
  const payload = await response.json().catch(() => ({}));
  const result = payload.alipay_trade_precreate_response || {};

  if (!response.ok || result.code !== '10000' || !result.qr_code) {
    throw new Error(`alipay_payment_failed:${JSON.stringify(payload)}`);
  }

  return {
    mode: 'qr',
    codeUrl: String(result.qr_code),
    raw: payload
  };
}

async function activateOrder(
  service: SupabaseService,
  outTradeNo: string,
  providerTradeNo: string,
  rawResponse: Record<string, unknown>
) {
  const { data: order, error } = await service
    .from('billing_orders')
    .select('*, billing_plans(duration_days)')
    .eq('out_trade_no', outTradeNo)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!order) {
    throw new Error('order_not_found');
  }

  if (order.status === 'paid') {
    return order;
  }

  const durationDays = Number(order.billing_plans?.duration_days || 31);
  const existing = await getEntitlement(service, order.user_id);
  const now = new Date();
  const baseTime =
    existing && isActiveEntitlement(existing) && existing.expires_at
      ? new Date(String(existing.expires_at))
      : now;
  const expiresAt = new Date(baseTime.getTime() + durationDays * 24 * 60 * 60 * 1000);

  const [{ error: orderError }, { error: entitlementError }] = await Promise.all([
    service
      .from('billing_orders')
      .update({
        status: 'paid',
        provider_trade_no: providerTradeNo,
        paid_at: now.toISOString(),
        raw_response: rawResponse
      })
      .eq('id', order.id),
    service.from('user_entitlements').upsert(
      {
        user_id: order.user_id,
        plan_id: order.plan_id,
        status: 'active',
        starts_at: existing?.starts_at || now.toISOString(),
        expires_at: expiresAt.toISOString(),
        source_order_id: order.id,
        metadata: {
          last_provider: order.provider,
          last_out_trade_no: outTradeNo
        }
      },
      {
        onConflict: 'user_id'
      }
    )
  ]);

  if (orderError) throw orderError;
  if (entitlementError) throw entitlementError;

  return {
    ...order,
    status: 'paid',
    paid_at: now.toISOString()
  };
}

async function handleWechatNotify(request: Request) {
  const body = await request.text();
  const clients = getServiceClients(request);
  if ('error' in clients) {
    return clients.error;
  }

  const publicKey = env('WECHAT_PAY_PLATFORM_PUBLIC_KEY');
  const skipSignature = env('WECHAT_PAY_SKIP_NOTIFY_SIGNATURE').toLowerCase() === 'true';
  const timestamp = request.headers.get('wechatpay-timestamp') || '';
  const nonce = request.headers.get('wechatpay-nonce') || '';
  const signature = request.headers.get('wechatpay-signature') || '';

  if (!skipSignature) {
    if (!publicKey || !timestamp || !nonce || !signature) {
      return json(400, { code: 'FAIL', message: 'missing_wechat_notify_signature_config' });
    }

    const verified = await verifyRsaSha256(`${timestamp}\n${nonce}\n${body}\n`, signature, publicKey);
    if (!verified) {
      return json(400, { code: 'FAIL', message: 'invalid_wechat_notify_signature' });
    }
  }

  const apiV3Key = env('WECHAT_PAY_API_V3_KEY');
  if (!apiV3Key) {
    return json(500, { code: 'FAIL', message: 'missing_wechat_api_v3_key' });
  }

  const payload = JSON.parse(body);
  const resource = payload.resource || {};
  const key = await crypto.subtle.importKey('raw', encode(apiV3Key), 'AES-GCM', false, ['decrypt']);
  const plainBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: encode(String(resource.nonce || '')),
      additionalData: encode(String(resource.associated_data || '')),
      tagLength: 128
    },
    base64ToBytes(String(resource.ciphertext || ''))
  );
  const plain = JSON.parse(new TextDecoder().decode(plainBuffer));

  if (plain.trade_state === 'SUCCESS') {
    await activateOrder(clients.service, String(plain.out_trade_no || ''), String(plain.transaction_id || ''), {
      provider: 'wechat',
      notify: payload,
      resource: plain
    });
  }

  return json(200, { code: 'SUCCESS', message: '成功' });
}

async function handleAlipayNotify(request: Request) {
  const body = await request.text();
  const clients = getServiceClients(request);
  if ('error' in clients) {
    return text(500, 'fail');
  }

  const params = Object.fromEntries(new URLSearchParams(body).entries());
  const publicKey = env('ALIPAY_PUBLIC_KEY');
  if (!publicKey || !params.sign) {
    return text(400, 'fail');
  }

  const verified = await verifyRsaSha256(buildAlipaySignContent(params, true), params.sign, publicKey);
  if (!verified) {
    return text(400, 'fail');
  }

  if (params.trade_status === 'TRADE_SUCCESS' || params.trade_status === 'TRADE_FINISHED') {
    await activateOrder(clients.service, params.out_trade_no, params.trade_no || '', {
      provider: 'alipay',
      notify: params
    });
  }

  return text(200, 'success');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const pathname = new URL(request.url).pathname;
  if (pathname.includes('/wechat/notify')) {
    return handleWechatNotify(request);
  }
  if (pathname.includes('/alipay/notify')) {
    return handleAlipayNotify(request);
  }

  if (request.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || '').trim();

  try {
    if (action === 'list-plans') {
      const clients = getServiceClients(request);
      if ('error' in clients) {
        return clients.error;
      }

      return json(200, {
        plans: await listPlans(clients.service),
        freeLimit: FREE_APPLICATION_LIMIT
      });
    }

    const auth = await requireUser(request);
    if ('error' in auth) {
      return auth.error;
    }

    if (action === 'get-entitlement') {
      const [entitlement, applicationCount, plans] = await Promise.all([
        getEntitlement(auth.service, auth.user.id),
        getApplicationCount(auth.service, auth.user.id),
        listPlans(auth.service)
      ]);

      return json(200, {
        entitlement: entitlement || {
          user_id: auth.user.id,
          plan_id: null,
          status: 'free',
          starts_at: null,
          expires_at: null
        },
        isPro: isActiveEntitlement(entitlement),
        applicationCount,
        freeLimit: FREE_APPLICATION_LIMIT,
        plans
      });
    }

    if (action === 'get-order') {
      const orderId = String(body.orderId || '').trim();
      const { data, error } = await auth.service
        .from('billing_orders')
        .select('id,plan_id,provider,out_trade_no,amount_cents,currency,status,code_url,checkout_url,expires_at,created_at,paid_at')
        .eq('id', orderId)
        .eq('user_id', auth.user.id)
        .maybeSingle();

      if (error) throw error;
      return json(200, { order: data || null });
    }

    if (action === 'create-order') {
      const planId = String(body.planId || '').trim();
      const provider = String(body.provider || '').trim() as BillingOrder['provider'];

      if (!['wechat', 'alipay'].includes(provider)) {
        return json(400, { error: 'invalid_provider' });
      }

      const plan = await getPlan(auth.service, planId);
      if (!plan) {
        return json(404, { error: 'plan_not_found' });
      }

      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const insertPayload = {
        user_id: auth.user.id,
        plan_id: plan.id,
        provider,
        out_trade_no: createOutTradeNo(),
        amount_cents: plan.price_cents,
        currency: plan.currency,
        status: 'pending',
        expires_at: expiresAt,
        raw_request: {
          action,
          planId,
          provider,
          userEmail: auth.user.email || ''
        }
      };

      const { data: order, error: insertError } = await auth.service
        .from('billing_orders')
        .insert(insertPayload)
        .select('id,user_id,plan_id,provider,out_trade_no,amount_cents,currency,status,code_url,checkout_url,expires_at')
        .single();

      if (insertError) throw insertError;

      const payment =
        provider === 'wechat'
          ? await createWechatNativePayment(order as BillingOrder, plan)
          : await createAlipayPrecreatePayment(order as BillingOrder, plan);

      const codeUrl = 'codeUrl' in payment ? String(payment.codeUrl || '') : '';
      const { data: updatedOrder, error: updateError } = await auth.service
        .from('billing_orders')
        .update({
          code_url: codeUrl,
          checkout_url: codeUrl,
          raw_response: payment.raw
        })
        .eq('id', order.id)
        .select('id,plan_id,provider,out_trade_no,amount_cents,currency,status,code_url,checkout_url,expires_at,created_at')
        .single();

      if (updateError) throw updateError;

      return json(200, {
        order: updatedOrder,
        plan,
        payment: {
          provider,
          mode: payment.mode,
          codeUrl,
          configured: payment.mode !== 'not_configured',
          message:
            payment.mode === 'not_configured'
              ? '支付通道还缺少商户配置。订单已创建，但不会要求用户付款；请先配置微信/支付宝商户密钥后再开放正式收款。'
              : '订单已创建，请扫码完成支付。'
        }
      });
    }

    if (action === 'mark-order-paid') {
      const secret = env('BILLING_MANUAL_ACTIVATION_SECRET');
      const requestSecret = request.headers.get('x-billing-admin-secret') || String(body.secret || '');
      if (!secret || requestSecret !== secret) {
        return json(403, { error: 'manual_activation_forbidden' });
      }

      const outTradeNo = String(body.outTradeNo || '').trim();
      const activated = await activateOrder(auth.service, outTradeNo, 'manual-activation', {
        provider: 'manual',
        activatedBy: auth.user.email || auth.user.id
      });

      return json(200, { order: activated });
    }

    return json(400, { error: 'unknown_action' });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : 'billing_api_error'
    });
  }
});
