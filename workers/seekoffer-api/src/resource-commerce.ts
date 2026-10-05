import {ApiError} from './auth.ts';
import {CommerceTransaction,commerceAddMinutes,commerceIsoMicro} from './commerce-transaction.ts';
// @ts-expect-error JianPay is a server-only provider module and must never enter the browser bundle.
import {createJianPayCheckout,queryJianPayPayment,sha256Payload,validateJianPayPaymentData,verifyJianPaySignature} from './payments/jianpay.mjs';

type Row = Record<string, unknown>;
type JianPayPaymentData = {
  providerOrderId: string;
  clientNo: string;
  merchantOrderNo: string;
  amountCents: number;
  status: number;
  payMethod: string;
  payUrl: string;
  payQrcodeUrl: string;
  paidAt: string | null;
};
type CommerceOwner = {userId:string}|null;
type CommerceConfig = {
  MODE: 'local'|'preview'|'production';
  PAYMENT_PROCESSING_ENABLED?: string;
  PAYMENT_CHECKOUT_ENABLED?: string;
  BUSINESS_WRITES_ENABLED?: string;
  COMMERCE_LOCAL_PAYMENT_ENABLED?: string;
  COMMERCE_ORDER_IDEMPOTENCY_KEY?: string;
  ORDER_IDEMPOTENCY_KEY?: string;
  JIANPAY_CLIENT_NO?: string;
  JIANPAY_MERCHANT_KEY?: string;
  COMMERCE_NOTIFY_URL?: string;
  COMMERCE_RETURN_ORIGIN?: string;
};

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{24,160}$/;
const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,160}$/;
const ORDER_PATTERN = /^SO[0-9]{8}[A-Z0-9]{8}$/;
const MERCHANT_ORDER_PATTERN = /^RCP[0-9]{8}[A-Z0-9]{12}$/;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function only(body:Row, keys:string[]) {
  if (Object.keys(body).some(key => !keys.includes(key))) throw new ApiError(400, 'UNSUPPORTED_COMMERCE_FIELD');
}

function stringValue(value:unknown, code:string, minimum:number, maximum:number) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < minimum || text.length > maximum || /[\u0000-\u001f]/.test(text)) throw new ApiError(400, code);
  return text;
}

async function hash(value:string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))]
    .map(byte => byte.toString(16).padStart(2,'0')).join('');
}

async function deterministicToken(key:string, value:string) {
  const cryptoKey = await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC',cryptoKey,new TextEncoder().encode(value)));
  return btoa(String.fromCharCode(...signature)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}

function randomCode(length:number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map(byte => alphabet[byte % alphabet.length]).join('');
}

function parseJson(value:unknown) {
  if (typeof value !== 'string') return {};
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; }
}

function deliveryType(row:Row) {
  return String(row.storage_provider || '') === 'external_link' ? 'external_link' : 'download';
}

function externalDeliveryUrl(value:unknown) {
  const metadata = parseJson(value) as Record<string,unknown>;
  const raw = typeof metadata.url === 'string' ? metadata.url.trim() : '';
  if (!raw) throw new ApiError(503,'RESOURCE_EXTERNAL_DELIVERY_NOT_CONFIGURED');
  let url:URL;
  try { url = new URL(raw); } catch { throw new ApiError(503,'RESOURCE_EXTERNAL_DELIVERY_NOT_CONFIGURED'); }
  if (url.protocol !== 'https:' || !['pan.baidu.com','yun.baidu.com'].includes(url.hostname.toLowerCase()) || !url.pathname.startsWith('/s/')) {
    throw new ApiError(503,'RESOURCE_EXTERNAL_DELIVERY_NOT_CONFIGURED');
  }
  return url.toString();
}

function contact(value:unknown, type:unknown) {
  const contactType = stringValue(type,'INVALID_CONTACT_TYPE',1,16);
  const normalized = stringValue(value,'INVALID_CONTACT',3,254).normalize('NFKC');
  const patterns:Record<string,RegExp> = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
    wechat: /^[a-zA-Z][-_a-zA-Z0-9]{2,31}$/,
    qq: /^[1-9][0-9]{4,11}$/
  };
  if (!patterns[contactType]?.test(normalized)) throw new ApiError(400,'INVALID_CONTACT');
  return {type:contactType,value:contactType === 'email' ? normalized.toLowerCase() : normalized};
}

function commerceEnabled(config:CommerceConfig) {
  if (config.MODE === 'local' && config.COMMERCE_LOCAL_PAYMENT_ENABLED === 'true') return true;
  return config.MODE !== 'preview' && config.BUSINESS_WRITES_ENABLED === 'true' && config.PAYMENT_PROCESSING_ENABLED === 'true' && config.PAYMENT_CHECKOUT_ENABLED === 'true';
}

function orderKey(config:CommerceConfig) {
  const key = config.COMMERCE_ORDER_IDEMPOTENCY_KEY || config.ORDER_IDEMPOTENCY_KEY || (config.MODE === 'local' ? 'local-only-commerce-key-change-me' : '');
  if (key.length < 32) throw new ApiError(503,'COMMERCE_ORDER_IDEMPOTENCY_NOT_CONFIGURED');
  return key;
}

function publicProduct(row:Row, files:Row[] = []) {
  const metadata = parseJson(row.metadata) as Record<string,unknown>;
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    summary: String(row.summary || ''),
    description: String(row.description || ''),
    coverUrl: row.cover_url || null,
    amountCents: Number(row.amount_cents),
    currency: String(row.currency),
    version: Number(row.version),
    features: Array.isArray(metadata.features) ? metadata.features.filter(value => typeof value === 'string') : [],
    files: files.map(file => ({id:String(file.id),filename:String(file.filename),contentType:String(file.content_type),byteSize:file.byte_size === null ? null : Number(file.byte_size),deliveryType:deliveryType(file)})),
    fileCount: files.length
  };
}

async function productRow(db:D1Database, slug:string, published=true) {
  const row = await db.prepare(`SELECT * FROM commerce__products WHERE slug=?${published ? " AND status='published'" : ''}`).bind(slug).first<Row>();
  if (!row) throw new ApiError(404,'RESOURCE_PRODUCT_NOT_FOUND');
  return row;
}

async function productFiles(db:D1Database, productId:string) {
  return (await db.prepare("SELECT id,filename,content_type,byte_size,object_key,storage_provider,metadata FROM commerce__product_files WHERE product_id=? AND status='active' ORDER BY sort_order,id").bind(productId).all<Row>()).results;
}

export async function listResourceProducts(db:D1Database) {
  const rows = (await db.prepare("SELECT * FROM commerce__products WHERE status='published' ORDER BY updated_at DESC,id").all<Row>()).results;
  const files = rows.length ? (await db.prepare("SELECT id,product_id,filename,content_type,byte_size,storage_provider FROM commerce__product_files WHERE status='active' ORDER BY sort_order,id").all<Row>()).results : [];
  const byProduct = new Map<string,Row[]>();
  for (const file of files) byProduct.set(String(file.product_id),[...(byProduct.get(String(file.product_id)) || []),file]);
  return {items:rows.map(row => publicProduct(row,byProduct.get(String(row.id)) || [])),source:'d1'};
}

export async function readResourceProduct(db:D1Database, slug:string) {
  const row = await productRow(db,stringValue(slug,'INVALID_RESOURCE_SLUG',2,80));
  return {product:publicProduct(row,await productFiles(db,String(row.id))),source:'d1'};
}

async function retry<T>(work:()=>Promise<T>) {
  for (let attempt=0; attempt<3; attempt++) {
    try { return await work(); }
    catch (error) { if (!(error instanceof ApiError) || error.message !== 'COMMERCE_TRANSACTION_CONFLICT' || attempt === 2) throw error; }
  }
  throw new ApiError(503,'COMMERCE_WRITE_UNAVAILABLE');
}

function validateOrderNo(value:unknown) {
  const orderNo = stringValue(value,'INVALID_COMMERCE_ORDER',18,18);
  if (!ORDER_PATTERN.test(orderNo)) throw new ApiError(400,'INVALID_COMMERCE_ORDER');
  return orderNo;
}

function validateAccessToken(value:unknown) {
  const token = stringValue(value,'INVALID_ORDER_ACCESS',32,160);
  if (!ACCESS_TOKEN_PATTERN.test(token)) throw new ApiError(400,'INVALID_ORDER_ACCESS');
  return token;
}

async function readOrderRow(db:D1Database,orderNo:string,accessToken:string|undefined,owner:CommerceOwner) {
  const row = await db.prepare('SELECT * FROM commerce__orders WHERE order_no=?').bind(orderNo).first<Row>();
  if (!row) throw new ApiError(404,'RESOURCE_ORDER_NOT_FOUND');
  const tokenHash = accessToken ? await hash(accessToken) : '';
  const ownerMatches = Boolean(owner?.userId && row.user_id === owner.userId);
  if (!ownerMatches && (!tokenHash || tokenHash !== row.access_token_hash)) throw new ApiError(404,'RESOURCE_ORDER_NOT_FOUND');
  return row;
}

async function currentPayment(db:D1Database,orderId:string) {
  return db.prepare('SELECT * FROM commerce__payments WHERE order_id=? ORDER BY created_at DESC,id DESC LIMIT 1').bind(orderId).first<Row>();
}

async function orderResponse(db:D1Database,row:Row,accessToken:string|undefined,owner:CommerceOwner,paymentAvailable=true) {
  const now = commerceIsoMicro();
  const latest = await currentPayment(db,String(row.id));
  const pending = latest && ['creating','create_unknown','pending'].includes(String(latest.status)) && String(latest.expires_at) > now;
  const status = row.status === 'pending' && String(row.expires_at) <= now && !pending ? 'expired' : String(row.status);
  const files = status === 'fulfilled' ? await productFiles(db,String(row.product_id)) : [];
  return {
    orderNo:String(row.order_no),
    status,
    title:String(row.title_snapshot),
    productSlug:(await db.prepare('SELECT slug FROM commerce__products WHERE id=?').bind(String(row.product_id)).first<{slug:string}>())?.slug || null,
    amountCents:Number(row.amount_cents),
    currency:String(row.currency),
    createdAt:String(row.created_at),
    expiresAt:String(row.expires_at),
    paidAt:row.paid_at || null,
    fulfilledAt:row.fulfilled_at || null,
    payment:latest ? {
      id:String(latest.id),
      status:String(latest.status),
      payMethod:String(latest.pay_method),
      providerOrderId:latest.provider_order_id || null,
      payUrl:paymentAvailable && pending && typeof latest.pay_url === 'string' ? latest.pay_url : null,
      payQrcodeUrl:paymentAvailable && pending && typeof latest.pay_qrcode_url === 'string' ? latest.pay_qrcode_url : null,
      expiresAt:String(latest.expires_at)
    } : null,
    delivery:status === 'fulfilled' ? {files:files.map(file => ({id:String(file.id),filename:String(file.filename),contentType:String(file.content_type),byteSize:file.byte_size === null ? null : Number(file.byte_size),deliveryType:deliveryType(file)}))} : null,
    accessMode:owner?.userId ? 'account' : accessToken ? 'guest_token' : null
  };
}

export async function createResourceOrder(db:D1Database,body:Row,owner:CommerceOwner,config:CommerceConfig) {
  only(body,['productSlug','requestId','contactType','contactValue','consent','website']);
  if (body.website !== undefined && body.website !== '') throw new ApiError(400,'INVALID_ORDER_REQUEST');
  if (body.consent !== true) throw new ApiError(400,'ORDER_CONSENT_REQUIRED');
  const productSlug = stringValue(body.productSlug,'INVALID_RESOURCE_SLUG',2,80);
  const requestId = stringValue(body.requestId,'INVALID_REQUEST_ID',24,160);
  if (!REQUEST_ID_PATTERN.test(requestId)) throw new ApiError(400,'INVALID_REQUEST_ID');
  const buyer = contact(body.contactValue,body.contactType);
  const key = orderKey(config);
  const accessToken = await deterministicToken(key,'commerce-order-v1:'+requestId);
  const requestIdHash = await hash(requestId), accessTokenHash = await hash(accessToken);
  const normalized = JSON.stringify({productSlug,contactType:buyer.type,contactValue:buyer.value,ownerId:owner?.userId || null,consent:true});
  const requestHash = await hash(normalized);
  const orderNo = await retry(async()=>{
    const tx = await CommerceTransaction.begin(db);
    const prior = await tx.row<{order_no:string;metadata:string}>('SELECT order_no,metadata FROM commerce__orders WHERE request_id_hash=?',[requestIdHash]);
    if (prior) {
      const metadata = parseJson(prior.metadata) as Record<string,unknown>;
      if (metadata.requestHash !== requestHash) throw new ApiError(409,'ORDER_REQUEST_REUSED');
      await tx.commit();
      return String(prior.order_no);
    }
    const product = await tx.row<Row>("SELECT * FROM commerce__products WHERE slug=? AND status='published'",[productSlug]);
    if (!product) throw new ApiError(404,'RESOURCE_PRODUCT_NOT_FOUND');
    const productMetadata = parseJson(product.metadata) as Record<string,unknown>;
    if (config.MODE !== 'local' && (productMetadata.purchaseEnabled === false || productMetadata.priceStatus === 'pending')) throw new ApiError(409,'NEW_PURCHASES_DISABLED');
    const now = commerceIsoMicro(), suffix = randomCode(8), generatedOrderNo = 'SO'+now.slice(0,10).replaceAll('-','')+suffix, id = crypto.randomUUID();
    tx.add(`INSERT INTO commerce__orders
      (id,order_no,request_id_hash,access_token_hash,product_id,product_version,title_snapshot,amount_cents,currency,contact_type,contact_value,user_id,status,payment_provider,consent_at,expires_at,metadata)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[
      id,generatedOrderNo,requestIdHash,accessTokenHash,product.id,Number(product.version),product.title,Number(product.amount_cents),product.currency,
      buyer.type,buyer.value,owner?.userId || null,'pending','jianpay',now,commerceAddMinutes(now,30),JSON.stringify({requestHash,productSlug,orderVersion:Number(product.version)})
    ]);
    tx.add('INSERT INTO commerce__order_items(id,order_id,product_id,title_snapshot,unit_amount_cents,quantity,metadata) VALUES(?,?,?,?,?,?,?)',[crypto.randomUUID(),id,product.id,product.title,Number(product.amount_cents),1,JSON.stringify({productVersion:Number(product.version)})]);
    await tx.commit();
    return generatedOrderNo;
  });
  const row = await readOrderRow(db,orderNo,accessToken,owner);
  return {order:await orderResponse(db,row,accessToken,owner,false),accessToken};
}

async function preparePayment(db:D1Database,input:{orderNo:string;accessToken:string;owner:CommerceOwner;payMethod:'wx'|'alipay'}) {
  return retry(async()=>{
    const tx = await CommerceTransaction.begin(db);
    const row = await tx.row<Row>('SELECT * FROM commerce__orders WHERE order_no=?',[input.orderNo]);
    if (!row) throw new ApiError(404,'RESOURCE_ORDER_NOT_FOUND');
    const tokenHash = await hash(input.accessToken);
    if (row.user_id !== input.owner?.userId && row.access_token_hash !== tokenHash) throw new ApiError(404,'RESOURCE_ORDER_NOT_FOUND');
    const now = commerceIsoMicro();
    if (row.status !== 'pending' || String(row.expires_at) <= now) throw new ApiError(409,'RESOURCE_ORDER_NOT_PAYABLE');
    const existing = await tx.row<Row>("SELECT * FROM commerce__payments WHERE order_id=? AND status IN ('creating','create_unknown','pending') ORDER BY created_at DESC LIMIT 1",[row.id]);
    if (existing) { await tx.commit(); return {...existing,createdNow:false}; }
    const requestHash = await hash(JSON.stringify([input.orderNo,input.payMethod]));
    const merchantOrderNo = 'RCP'+now.slice(0,10).replaceAll('-','')+randomCode(12), id = crypto.randomUUID();
    tx.add(`INSERT INTO commerce__payments
      (id,order_id,merchant_order_no,pay_method,amount_cents,currency,status,request_hash,expires_at)
      VALUES(?,?,?,?,?,'CNY','creating',?,?)`,[id,row.id,merchantOrderNo,input.payMethod,Number(row.amount_cents),requestHash,commerceAddMinutes(now,15)]);
    tx.event({paymentId:id,orderId:String(row.id),source:'create',eventType:'payment_prepared',payloadHash:requestHash,eventData:{payMethod:input.payMethod,amountCents:Number(row.amount_cents)}});
    await tx.commit();
    return {id,order_id:row.id,merchant_order_no:merchantOrderNo,pay_method:input.payMethod,amount_cents:Number(row.amount_cents),status:'creating',createdNow:true};
  });
}

async function finalizePayment(db:D1Database,input:{paymentId:string;providerOrderId:string;payUrl:string;payQrcodeUrl?:string;providerStatus:number;payloadHash:string}) {
  return retry(async()=>{
    const tx = await CommerceTransaction.begin(db), payment = await tx.row<Row>('SELECT * FROM commerce__payments WHERE id=?',[input.paymentId]);
    if (!payment) throw new ApiError(404,'RESOURCE_PAYMENT_NOT_FOUND');
    if (payment.provider_order_id && payment.provider_order_id !== input.providerOrderId) throw new ApiError(409,'PROVIDER_ORDER_MISMATCH');
    if (!['creating','create_unknown','pending'].includes(String(payment.status))) { await tx.commit(); return payment; }
    const status = input.providerStatus === 3 ? 'failed' : input.providerStatus === 4 ? 'closed' : 'pending';
    tx.add('UPDATE commerce__payments SET provider_order_id=?,pay_url=?,pay_qrcode_url=?,provider_status=?,status=?,payload_hash=?,failure_code=?,updated_at=? WHERE id=?',[input.providerOrderId,input.payUrl,input.payQrcodeUrl || null,input.providerStatus,status,input.payloadHash,['failed','closed'].includes(status) ? 'provider_create_status_'+input.providerStatus : null,commerceIsoMicro(),payment.id]);
    tx.event({paymentId:String(payment.id),orderId:String(payment.order_id),source:'create',eventType:'payment_created',providerStatus:input.providerStatus,payloadHash:input.payloadHash,eventData:{status}});
    await tx.commit();
    return {...payment,status,provider_order_id:input.providerOrderId,pay_url:input.payUrl,pay_qrcode_url:input.payQrcodeUrl || null};
  });
}

async function recordPaymentFailure(db:D1Database,paymentId:string,code:string,unknown:boolean) {
  return retry(async()=>{
    const tx = await CommerceTransaction.begin(db), payment = await tx.row<Row>('SELECT * FROM commerce__payments WHERE id=?',[paymentId]);
    if (!payment) throw new ApiError(404,'RESOURCE_PAYMENT_NOT_FOUND');
    const status = unknown ? 'create_unknown' : 'failed', payloadHash = await hash(code);
    tx.add('UPDATE commerce__payments SET status=?,failure_code=?,payload_hash=?,expires_at=?,updated_at=? WHERE id=? AND status IN (\'creating\',\'create_unknown\')',[status,code,payloadHash,unknown ? commerceAddMinutes(commerceIsoMicro(),10) : payment.expires_at,commerceIsoMicro(),paymentId]);
    tx.event({paymentId:String(payment.id),orderId:String(payment.order_id),source:'create',eventType:unknown?'payment_create_unknown':'payment_create_failed',payloadHash,eventData:{failureCode:code}});
    await tx.commit();
  });
}

export async function createResourcePayment(db:D1Database,input:{orderNo:string;accessToken:string;owner:CommerceOwner;payMethod:unknown},config:CommerceConfig,origin:string,fetcher:typeof fetch=fetch) {
  const orderNo = validateOrderNo(input.orderNo), accessToken = validateAccessToken(input.accessToken);
  const payMethod = input.payMethod === 'wx' || input.payMethod === 'alipay' ? input.payMethod : '';
  if (!payMethod) throw new ApiError(400,'INVALID_PAYMENT_METHOD');
  const prepared = await preparePayment(db,{orderNo,accessToken,owner:input.owner,payMethod});
  if (!prepared.createdNow) {
    const row = await readOrderRow(db,orderNo,accessToken,input.owner);
    return {order:await orderResponse(db,row,accessToken,input.owner,true)};
  }
  if (config.MODE === 'local' && config.COMMERCE_LOCAL_PAYMENT_ENABLED === 'true') {
    const providerOrderId = 'LOCAL_PAYMENT_'+randomCode(12), payloadHash = await hash(JSON.stringify({providerOrderId,orderNo}));
    await finalizePayment(db,{paymentId:String(prepared.id),providerOrderId,payUrl:`/resources/order-success?order=${encodeURIComponent(orderNo)}&payment=local`,providerStatus:0,payloadHash});
  } else {
    if (!commerceEnabled(config) || !config.JIANPAY_CLIENT_NO || !config.JIANPAY_MERCHANT_KEY) {
      await recordPaymentFailure(db,String(prepared.id),'payment_configuration_pending',false);
      throw new ApiError(503,'PAYMENT_CONFIGURATION_PENDING');
    }
    try {
      const returnUrl = new URL('/resources/order-success',config.COMMERCE_RETURN_ORIGIN || origin || 'https://www.seekoffer.com.cn');
      returnUrl.searchParams.set('order',orderNo);
      returnUrl.searchParams.set('payment','return');
      const created = await createJianPayCheckout({
        merchantOrderNo:String(prepared.merchant_order_no),
        payMethod,
        amountCents:Number(prepared.amount_cents),
        goodsName:'寻鹿保研资料包',
        notifyUrl:config.COMMERCE_NOTIFY_URL || new URL('/v1/payments/jianpay/notify',origin || 'https://migration.seekoffer.com.cn').toString(),
        returnUrl:returnUrl.toString()
      },{clientNo:config.JIANPAY_CLIENT_NO,merchantKey:config.JIANPAY_MERCHANT_KEY},{fetchImpl:fetcher});
      await finalizePayment(db,{paymentId:String(prepared.id),providerOrderId:created.providerOrderId,payUrl:created.payUrl,payQrcodeUrl:created.payQrcodeUrl,providerStatus:created.status,payloadHash:created.payloadHash});
    } catch (error) {
      const code = typeof (error as {code?:unknown})?.code === 'string' && /^[a-z_]{3,100}$/.test(String((error as {code:string}).code)) ? String((error as {code:string}).code) : 'provider_failure';
      const unknown = !['invalid_checkout_request','invalid_client_no','invalid_merchant_key','provider_rejected_request'].includes(code);
      await recordPaymentFailure(db,String(prepared.id),code,unknown);
      throw new ApiError(unknown ? 503 : 502,unknown ? 'CHECKOUT_OUTCOME_UNCERTAIN' : 'PAYMENT_PROVIDER_REJECTED');
    }
  }
  const row = await readOrderRow(db,orderNo,accessToken,input.owner);
  return {order:await orderResponse(db,row,accessToken,input.owner,true)};
}

async function applyCommercePaymentState(db:D1Database,input:{merchantOrderNo:string;providerOrderId:string;amountCents:number;providerStatus:number;source:'callback'|'query'|'local'|'operator';payloadHash:string;paidAt?:string|null}) {
  if (!MERCHANT_ORDER_PATTERN.test(input.merchantOrderNo) || input.providerOrderId.length < 6 || input.providerOrderId.length > 200 || !Number.isInteger(input.amountCents) || input.amountCents < 100 || input.amountCents > 1000000 || !Number.isInteger(input.providerStatus) || input.providerStatus < 0 || input.providerStatus > 4 || !/^[a-f0-9]{64}$/.test(input.payloadHash)) throw new ApiError(400,'INVALID_COMMERCE_PAYMENT_STATE');
  return retry(async()=>{
    const tx = await CommerceTransaction.begin(db);
    const payment = await tx.row<Row>('SELECT * FROM commerce__payments WHERE merchant_order_no=? AND provider=?',[input.merchantOrderNo,'jianpay']);
    if (!payment) throw new ApiError(404,'RESOURCE_PAYMENT_NOT_FOUND');
    const order = await tx.row<Row>('SELECT * FROM commerce__orders WHERE id=?',[payment.order_id]);
    if (!order) throw new ApiError(404,'RESOURCE_ORDER_NOT_FOUND');
    if (Number(payment.amount_cents) !== input.amountCents || Number(order.amount_cents) !== input.amountCents) throw new ApiError(409,'PAYMENT_AMOUNT_MISMATCH');
    if (payment.provider_order_id && payment.provider_order_id !== input.providerOrderId) throw new ApiError(409,'PROVIDER_ORDER_MISMATCH');
    const now = commerceIsoMicro();
    if (input.providerStatus !== 2) {
      const nextStatus = input.providerStatus === 3 ? 'failed' : input.providerStatus === 4 ? 'closed' : 'pending';
      if (!['succeeded','duplicate_succeeded','refunded','refunding'].includes(String(payment.status))) {
        tx.add('UPDATE commerce__payments SET provider_order_id=?,provider_status=?,status=?,last_queried_at=?,failure_code=?,updated_at=? WHERE id=?',[input.providerOrderId,input.providerStatus,nextStatus,input.source === 'callback' ? payment.last_queried_at : now,['failed','closed'].includes(nextStatus) ? 'provider_status_'+input.providerStatus : null,now,payment.id]);
      }
      tx.event({paymentId:String(payment.id),orderId:String(order.id),source:input.source,eventType:'payment_state_changed',providerStatus:input.providerStatus,payloadHash:input.payloadHash,eventData:{status:nextStatus}});
      await tx.commit();
      return {orderStatus:String(order.status),paymentStatus:nextStatus,fulfillment:'not_fulfilled'};
    }
    const entitlement = await tx.row<Row>('SELECT * FROM commerce__entitlements WHERE order_id=? AND product_id=?',[order.id,order.product_id]);
    if (entitlement || ['fulfilled','refunded'].includes(String(order.status))) {
      tx.add('UPDATE commerce__payments SET provider_order_id=?,provider_status=2,status=?,paid_at=coalesce(paid_at,?),updated_at=? WHERE id=?',[input.providerOrderId,order.status === 'refunded' ? 'refunded' : 'duplicate_succeeded',input.paidAt || now,now,payment.id]);
      tx.event({paymentId:String(payment.id),orderId:String(order.id),source:input.source,eventType:'duplicate_payment',providerStatus:2,payloadHash:input.payloadHash,eventData:{existingStatus:order.status}});
      await tx.commit();
      return {orderStatus:String(order.status),paymentStatus:'duplicate_succeeded',fulfillment:'already_fulfilled'};
    }
    if (String(order.status) === 'pending' && String(order.expires_at) <= now) {
      tx.add("UPDATE commerce__orders SET status='expired',updated_at=? WHERE id=? AND status='pending'",[now,order.id]);
      tx.add("UPDATE commerce__payments SET provider_order_id=?,provider_status=2,status='needs_review',paid_at=coalesce(paid_at,?),failure_code='paid_order_expired_requires_review',payload_hash=?,updated_at=? WHERE id=?",[input.providerOrderId,input.paidAt || now,input.payloadHash,now,payment.id]);
      tx.event({paymentId:String(payment.id),orderId:String(order.id),source:input.source,eventType:'payment_needs_review_expired',providerStatus:2,payloadHash:input.payloadHash,eventData:{orderStatus:'expired'}});
      await tx.commit();
      return {orderStatus:'expired',paymentStatus:'needs_review',fulfillment:'needs_review'};
    }
    if (['canceled','expired'].includes(String(order.status))) {
      tx.add('UPDATE commerce__payments SET provider_order_id=?,provider_status=2,status=\'needs_review\',paid_at=coalesce(paid_at,?),failure_code=\'paid_order_requires_review\',updated_at=? WHERE id=?',[input.providerOrderId,input.paidAt || now,now,payment.id]);
      tx.event({paymentId:String(payment.id),orderId:String(order.id),source:input.source,eventType:'payment_needs_review',providerStatus:2,payloadHash:input.payloadHash,eventData:{orderStatus:order.status}});
      await tx.commit();
      return {orderStatus:String(order.status),paymentStatus:'needs_review',fulfillment:'needs_review'};
    }
    tx.add('UPDATE commerce__orders SET status=\'fulfilled\',payment_provider=\'jianpay\',payment_reference=?,paid_at=coalesce(paid_at,?),fulfilled_at=?,updated_at=? WHERE id=?',[input.providerOrderId,input.paidAt || now,now,now,order.id]);
    tx.add('UPDATE commerce__payments SET provider_order_id=?,provider_status=2,status=\'succeeded\',paid_at=coalesce(paid_at,?),last_queried_at=?,failure_code=NULL,payload_hash=?,updated_at=? WHERE id=?',[input.providerOrderId,input.paidAt || now,now,input.payloadHash,now,payment.id]);
    tx.add("INSERT INTO commerce__entitlements(id,order_id,product_id,user_id,status,granted_at,metadata) VALUES(?,?,?,?,'active',?,?)",[crypto.randomUUID(),order.id,order.product_id,order.user_id,now,JSON.stringify({paymentProvider:'jianpay',providerOrderId:input.providerOrderId})]);
    tx.event({paymentId:String(payment.id),orderId:String(order.id),source:input.source,eventType:'payment_succeeded',providerStatus:2,payloadHash:input.payloadHash,eventData:{fulfillment:'fulfilled'}});
    await tx.commit();
    return {orderStatus:'fulfilled',paymentStatus:'succeeded',fulfillment:'fulfilled'};
  });
}

export async function applyResourceJianPayNotification(db:D1Database,payload:Record<string,unknown>,credentials:{clientNo:string;merchantKey:string}) {
  if (payload.sign_type !== 'MD5' || !verifyJianPaySignature(payload,credentials.merchantKey)) throw new ApiError(401,'INVALID_PAYMENT_SIGNATURE');
  let payment: JianPayPaymentData;
  try { payment = validateJianPayPaymentData(payload,{clientNo:credentials.clientNo}); } catch { throw new ApiError(400,'INVALID_PROVIDER_PAYMENT'); }
  if (!MERCHANT_ORDER_PATTERN.test(payment.merchantOrderNo)) throw new ApiError(400,'NOT_RESOURCE_PAYMENT');
  return applyCommercePaymentState(db,{merchantOrderNo:payment.merchantOrderNo,providerOrderId:payment.providerOrderId,amountCents:payment.amountCents,providerStatus:payment.status,source:'callback',payloadHash:sha256Payload(payload),paidAt:payment.paidAt});
}

export async function reconcileResourcePayment(db:D1Database,input:{orderNo:string;accessToken:string;owner:CommerceOwner},config:CommerceConfig,fetcher:typeof fetch=fetch) {
  const orderNo = validateOrderNo(input.orderNo), accessToken = validateAccessToken(input.accessToken), order = await readOrderRow(db,orderNo,accessToken,input.owner);
  const payment = await currentPayment(db,String(order.id));
  if (!payment?.provider_order_id) throw new ApiError(409,'PAYMENT_RECONCILIATION_REQUIRED');
  if (['refunded','refunding','duplicate_succeeded','needs_review'].includes(String(payment.status))) return {order:await orderResponse(db,order,accessToken,input.owner,true)};
  if (config.MODE === 'local' && String(payment.provider_order_id).startsWith('LOCAL_PAYMENT_')) {
    await applyCommercePaymentState(db,{merchantOrderNo:String(payment.merchant_order_no),providerOrderId:String(payment.provider_order_id),amountCents:Number(payment.amount_cents),providerStatus:1,source:'local',payloadHash:await hash('local-query:'+payment.id)});
  } else {
    if (!config.JIANPAY_CLIENT_NO || !config.JIANPAY_MERCHANT_KEY) throw new ApiError(503,'PAYMENT_CONFIGURATION_PENDING');
    const result = await queryJianPayPayment({providerOrderId:payment.provider_order_id,merchantOrderNo:payment.merchant_order_no,amountCents:payment.amount_cents},{clientNo:config.JIANPAY_CLIENT_NO,merchantKey:config.JIANPAY_MERCHANT_KEY},{fetchImpl:fetcher});
    await applyCommercePaymentState(db,{merchantOrderNo:String(payment.merchant_order_no),providerOrderId:String(payment.provider_order_id),amountCents:result.amountCents,providerStatus:result.status,source:'query',payloadHash:result.payloadHash,paidAt:result.paidAt});
  }
  const refreshed = await readOrderRow(db,orderNo,accessToken,input.owner);
  return {order:await orderResponse(db,refreshed,accessToken,input.owner,true)};
}

export async function simulateResourcePayment(db:D1Database,input:{orderNo:string;accessToken:string;owner:CommerceOwner}) {
  const orderNo = validateOrderNo(input.orderNo), accessToken = validateAccessToken(input.accessToken), order = await readOrderRow(db,orderNo,accessToken,input.owner), payment = await currentPayment(db,String(order.id));
  if (!payment?.provider_order_id || !String(payment.provider_order_id).startsWith('LOCAL_PAYMENT_')) throw new ApiError(409,'LOCAL_PAYMENT_NOT_AVAILABLE');
  const result = await applyCommercePaymentState(db,{merchantOrderNo:String(payment.merchant_order_no),providerOrderId:String(payment.provider_order_id),amountCents:Number(payment.amount_cents),providerStatus:2,source:'local',payloadHash:await hash('local-success:'+payment.id),paidAt:commerceIsoMicro()});
  const refreshed = await readOrderRow(db,orderNo,accessToken,input.owner);
  return {result,order:await orderResponse(db,refreshed,accessToken,input.owner,true)};
}

export async function readOwnedResources(db:D1Database,ownerId:string) {
  const rows = (await db.prepare(`SELECT e.id AS entitlement_id,e.granted_at,e.status,p.id,p.slug,p.title,p.summary,p.description,p.amount_cents,p.currency,p.version,p.metadata
    FROM commerce__entitlements e JOIN commerce__products p ON p.id=e.product_id
    WHERE e.user_id=? ORDER BY e.granted_at DESC,e.id DESC`).bind(ownerId).all<Row>()).results;
  return {items:rows.map(row => ({entitlementId:String(row.entitlement_id),grantedAt:String(row.granted_at),status:String(row.status),product:publicProduct(row,[])}))};
}

const localDemoContent:Record<string,string> = {
  'commerce/demo/complete-application-kit/使用说明.txt': '推免星本地演示资源\n\n这里是全套资料包受控下载链路的本地演示文件。正式上线前会替换为确认后的资料清单。\n'
};

export async function downloadResourceFile(db:D1Database,input:{fileId:string;accessToken?:string;owner:CommerceOwner},bucket:R2Bucket|undefined,mode:'local'|'preview'|'production') {
  const fileId = stringValue(input.fileId,'INVALID_RESOURCE_FILE',8,180), accessToken = input.accessToken ? validateAccessToken(input.accessToken) : undefined;
  const tokenHash = accessToken ? await hash(accessToken) : '';
  const row = await db.prepare(`SELECT f.id,f.object_key,f.filename,f.content_type,f.byte_size,f.storage_provider,f.metadata,e.id AS entitlement_id,o.user_id,o.access_token_hash
    FROM commerce__product_files f JOIN commerce__entitlements e ON e.product_id=f.product_id AND e.status='active'
    JOIN commerce__orders o ON o.id=e.order_id
    WHERE f.id=? AND f.status='active' AND (o.user_id=? OR o.access_token_hash=?)
    ORDER BY e.granted_at DESC LIMIT 1`).bind(fileId,input.owner?.userId || null,tokenHash).first<Row>();
  if (!row) throw new ApiError(404,'RESOURCE_FILE_NOT_AVAILABLE');
  const externalUrl = String(row.storage_provider) === 'external_link' ? externalDeliveryUrl(row.metadata) : null;
  const tx = await CommerceTransaction.begin(db);
  tx.add('INSERT INTO commerce__download_events(id,entitlement_id,file_id,user_id,access_mode) VALUES(?,?,?,?,?)',[crypto.randomUUID(),row.entitlement_id,row.id,input.owner?.userId || null,input.owner?.userId ? 'account' : mode === 'local' ? 'local_demo' : 'guest_token']);
  await tx.commit();
  if (externalUrl) {
    const headers = new Headers({'Cache-Control':'private, no-store','Content-Type':'application/json; charset=utf-8','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});
    return new Response(JSON.stringify({delivery:{type:'external_link',url:externalUrl}}),{status:200,headers});
  }
  let body:ReadableStream<Uint8Array>|string, contentType=String(row.content_type || 'application/octet-stream'), etag:string|undefined;
  if (bucket) {
    const object = await bucket.get(String(row.object_key));
    if (object) {
      body = object.body as ReadableStream<Uint8Array>;
      contentType = object.httpMetadata?.contentType || contentType;
      etag = object.httpEtag;
    } else if (mode === 'local' && localDemoContent[String(row.object_key)] !== undefined) {
      body = localDemoContent[String(row.object_key)];
    } else {
      throw new ApiError(404,'RESOURCE_FILE_NOT_AVAILABLE');
    }
  } else if (mode === 'local' && localDemoContent[String(row.object_key)] !== undefined) {
    body = localDemoContent[String(row.object_key)];
  } else {
    throw new ApiError(503,'RESOURCE_STORAGE_NOT_CONFIGURED');
  }
  const filename = String(row.filename), encoded = encodeURIComponent(filename).replaceAll("'",'%27');
  const headers = new Headers({'Content-Type':contentType,'Content-Disposition':`attachment; filename="download"; filename*=UTF-8''${encoded}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
  if (etag) headers.set('ETag',etag);
  return new Response(body,{status:200,headers});
}

export async function readOrderForAccess(db:D1Database,orderNo:string,accessToken:unknown,owner:CommerceOwner) {
  const normalizedOrder = validateOrderNo(orderNo), token = accessToken ? validateAccessToken(accessToken) : undefined;
  const row = await readOrderRow(db,normalizedOrder,token,owner);
  return orderResponse(db,row,token,owner,true);
}
