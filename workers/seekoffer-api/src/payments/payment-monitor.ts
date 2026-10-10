import type {BootstrapConfig} from '../identity-bootstrap.ts';
import {cachedAdminRead} from '../admin-read-cache.ts';

type MonitorConfig = Pick<BootstrapConfig,'CLERK_BACKEND_SECRET'> & {
  JIANPAY_CLIENT_NO?: string;
  JIANPAY_MERCHANT_KEY?: string;
};
type CountRow = Record<string, number | string | null>;
type Row = Record<string, unknown>;

export type PaymentMonitorOptions = {
  page?: number;
  pageSize?: number;
  query?: string;
  orderStatus?: string;
  windowDays?: number;
};

function count(row: CountRow | null | undefined, key: string) {
  return Number(row?.[key] || 0);
}

function timestamp(row: CountRow | null | undefined, key: string) {
  const value = row?.[key];
  return typeof value === 'string' && value ? value : null;
}

function isoWindow() {
  const to = new Date();
  return {from: new Date(to.getTime() - 24 * 60 * 60 * 1000).toISOString(), to: to.toISOString()};
}

function normalizeOptions(options: PaymentMonitorOptions = {}) {
  const page = Math.min(Math.max(Number(options.page || 1), 1), 100000);
  const pageSize = Math.min(Math.max(Number(options.pageSize || 20), 1), 50);
  const query = typeof options.query === 'string' ? options.query.trim().slice(0, 120) : '';
  const orderStatus = typeof options.orderStatus === 'string' ? options.orderStatus.trim() : 'all';
  const windowDays = options.windowDays === 0 ? 0 : [1,7,30,90].includes(Number(options.windowDays)) ? Number(options.windowDays) : 30;
  return {page, pageSize, query, orderStatus, windowDays};
}

function orderWindow(days: number) {
  const to = new Date();
  return {from: days ? new Date(to.getTime() - days * 24 * 60 * 60 * 1000).toISOString() : null, to: to.toISOString()};
}

function maskContact(value: unknown, type: unknown) {
  const text = String(value || '');
  if (!text) return '';
  if (String(type) === 'email' && text.includes('@')) {
    const [local,domain] = text.split('@');
    return `${local.slice(0,2)}${local.length > 2 ? '***' : '*'}@${domain}`;
  }
  if (text.length <= 4) return `${text.slice(0,1)}***`;
  return `${text.slice(0,3)}***${text.slice(-2)}`;
}

function mapOrder(row: Row) {
  return {
    id: String(row.id),
    orderNo: String(row.order_no),
    title: String(row.title_snapshot || '未命名商品'),
    amountCents: Number(row.amount_cents || 0),
    currency: String(row.currency || 'CNY'),
    contactType: String(row.contact_type || ''),
    contactMasked: maskContact(row.contact_value,row.contact_type),
    userId: row.user_id ? String(row.user_id) : null,
    status: String(row.order_status || ''),
    provider: String(row.payment_provider || row.provider || ''),
    paymentReference: row.payment_reference ? String(row.payment_reference) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    paidAt: row.order_paid_at ? String(row.order_paid_at) : null,
    fulfilledAt: row.fulfilled_at ? String(row.fulfilled_at) : null,
    createdAt: String(row.order_created_at),
    updatedAt: String(row.order_updated_at || row.order_created_at),
    payment: row.payment_id ? {
      id: String(row.payment_id),
      merchantOrderNo: String(row.merchant_order_no || ''),
      providerOrderId: row.provider_order_id ? String(row.provider_order_id) : null,
      payMethod: String(row.pay_method || ''),
      status: String(row.payment_status || ''),
      providerStatus: row.provider_status === null || row.provider_status === undefined ? null : Number(row.provider_status),
      failureCode: row.failure_code ? String(row.failure_code) : null,
      paidAt: row.payment_paid_at ? String(row.payment_paid_at) : null,
      lastQueriedAt: row.last_queried_at ? String(row.last_queried_at) : null,
      createdAt: String(row.payment_created_at || row.order_created_at),
      updatedAt: String(row.payment_updated_at || row.order_updated_at || row.order_created_at)
    } : null,
    callbackCount: Number(row.callback_count || 0),
    lastCallbackAt: row.last_callback_at ? String(row.last_callback_at) : null
  };
}

const latestPaymentJoin = `LEFT JOIN commerce__payments p ON p.id=(
  SELECT p2.id FROM commerce__payments p2
  WHERE p2.order_id=o.id ORDER BY p2.created_at DESC,p2.id DESC LIMIT 1
)`;

async function readPaymentOrders(db: D1Database, options: PaymentMonitorOptions = {}) {
  const normalized = normalizeOptions(options), window = orderWindow(normalized.windowDays);
  const terms: string[] = [], values: unknown[] = [];
  if (window.from) {
    terms.push('o.created_at>=?');
    values.push(window.from);
  }
  if (normalized.orderStatus !== 'all') {
    const statuses = ['pending','paid','fulfilled','canceled','expired','refunded'];
    if (!statuses.includes(normalized.orderStatus)) throw new Error('INVALID_PAYMENT_STATUS');
    terms.push('o.status=?');
    values.push(normalized.orderStatus);
  }
  if (normalized.query) {
    terms.push(`(
      instr(lower(o.order_no),lower(?))>0 OR
      instr(lower(o.title_snapshot),lower(?))>0 OR
      instr(lower(o.contact_value),lower(?))>0 OR
      instr(lower(coalesce(o.payment_reference,'')),lower(?))>0 OR
      instr(lower(coalesce(p.merchant_order_no,'')),lower(?))>0 OR
      instr(lower(coalesce(p.provider_order_id,'')),lower(?))>0
    )`);
    values.push(...Array.from({length:6},()=>normalized.query));
  }
  const where = terms.length ? ` WHERE ${terms.join(' AND ')}` : '';
  const countRow = await db.prepare(`SELECT count(*) AS total FROM commerce__orders o ${latestPaymentJoin}${where}`).bind(...values).first<{total:number}>();
  const total = Number(countRow?.total || 0);
  const rows = await db.prepare(`SELECT
      o.id,o.order_no,o.title_snapshot,o.amount_cents,o.currency,o.contact_type,o.contact_value,o.user_id,
      o.status AS order_status,o.payment_provider,o.payment_reference,o.expires_at,o.paid_at AS order_paid_at,
      o.fulfilled_at,o.created_at AS order_created_at,o.updated_at AS order_updated_at,
      p.id AS payment_id,p.merchant_order_no,p.provider_order_id,p.pay_method,p.status AS payment_status,
      p.provider_status,p.failure_code,p.paid_at AS payment_paid_at,p.last_queried_at,
      p.created_at AS payment_created_at,p.updated_at AS payment_updated_at,
      (SELECT count(*) FROM commerce__payment_events e WHERE e.order_id=o.id AND e.source='callback') AS callback_count,
      (SELECT max(e.created_at) FROM commerce__payment_events e WHERE e.order_id=o.id AND e.source='callback') AS last_callback_at
    FROM commerce__orders o ${latestPaymentJoin}${where}
    ORDER BY o.created_at DESC,o.id DESC LIMIT ? OFFSET ?`).bind(...values,normalized.pageSize,(normalized.page-1)*normalized.pageSize).all<Row>();
  return {
    items: rows.results.map(mapOrder),
    total,
    page: normalized.page,
    pageSize: normalized.pageSize,
    pages: Math.max(1,Math.ceil(total/normalized.pageSize)),
    window,
    filters: {query:normalized.query,status:normalized.orderStatus,windowDays:normalized.windowDays}
  };
}

export async function readPaymentMonitorOrder(db: D1Database, id: string) {
  const row = await db.prepare(`SELECT
      o.id,o.order_no,o.title_snapshot,o.amount_cents,o.currency,o.contact_type,o.contact_value,o.user_id,
      o.status AS order_status,o.payment_provider,o.payment_reference,o.expires_at,o.paid_at AS order_paid_at,
      o.fulfilled_at,o.created_at AS order_created_at,o.updated_at AS order_updated_at,
      p.id AS payment_id,p.merchant_order_no,p.provider_order_id,p.pay_method,p.status AS payment_status,
      p.provider_status,p.failure_code,p.paid_at AS payment_paid_at,p.last_queried_at,
      p.created_at AS payment_created_at,p.updated_at AS payment_updated_at,
      (SELECT count(*) FROM commerce__payment_events e WHERE e.order_id=o.id AND e.source='callback') AS callback_count,
      (SELECT max(e.created_at) FROM commerce__payment_events e WHERE e.order_id=o.id AND e.source='callback') AS last_callback_at
    FROM commerce__orders o ${latestPaymentJoin}
    WHERE o.id=? OR o.order_no=? LIMIT 1`).bind(id,id).first<Row>();
  if (!row) return null;
  const events = await db.prepare(`SELECT id,source,event_type,provider_status,created_at
    FROM commerce__payment_events WHERE order_id=? ORDER BY created_at DESC,id DESC LIMIT 100`).bind(row.id).all<Row>();
  return {order:mapOrder(row),events:events.results.map(event=>({id:String(event.id),source:String(event.source),eventType:String(event.event_type),providerStatus:event.provider_status===null||event.provider_status===undefined?null:Number(event.provider_status),createdAt:String(event.created_at)}))};
}

export async function readPaymentMonitor(db: D1Database, config: MonitorConfig = {}, options: PaymentMonitorOptions = {}) {
  const normalized = normalizeOptions(options);
  const cacheName = `payment-monitor:${normalized.page}:${normalized.pageSize}:${encodeURIComponent(normalized.query)}:${normalized.orderStatus}:${normalized.windowDays}`;
  return cachedAdminRead(db,cacheName,60_000,async()=>{
    const window = isoWindow();
    const stalePendingBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const staleCreatingBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const staleUnknownBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const [orders, payments, events, orderList] = await Promise.all([
      db.prepare(`SELECT
        count(*) AS total,
        sum(CASE WHEN status='fulfilled' THEN 1 ELSE 0 END) AS fulfilled,
        sum(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
        sum(CASE WHEN status='pending' AND created_at<? THEN 1 ELSE 0 END) AS stale_pending,
        sum(CASE WHEN status='expired' THEN 1 ELSE 0 END) AS expired,
        sum(CASE WHEN status='refunded' THEN 1 ELSE 0 END) AS refunded,
        max(created_at) AS last_created_at
        FROM commerce__orders WHERE created_at>=? AND created_at<=?`).bind(stalePendingBefore,window.from,window.to).first<CountRow>(),
      db.prepare(`SELECT
        count(*) AS total,
        sum(CASE WHEN status='creating' THEN 1 ELSE 0 END) AS creating,
        sum(CASE WHEN status='creating' AND created_at<? THEN 1 ELSE 0 END) AS stale_creating,
        sum(CASE WHEN status='create_unknown' THEN 1 ELSE 0 END) AS create_unknown,
        sum(CASE WHEN status='create_unknown' AND created_at<? THEN 1 ELSE 0 END) AS stale_create_unknown,
        sum(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
        sum(CASE WHEN status='pending' AND created_at<? THEN 1 ELSE 0 END) AS stale_pending,
        sum(CASE WHEN status='succeeded' THEN 1 ELSE 0 END) AS succeeded,
        sum(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
        sum(CASE WHEN status='closed' THEN 1 ELSE 0 END) AS closed,
        sum(CASE WHEN status='needs_review' THEN 1 ELSE 0 END) AS needs_review,
        sum(CASE WHEN status IN ('duplicate_succeeded','refunding','refunded') THEN 1 ELSE 0 END) AS terminal_other,
        sum(CASE WHEN status IN ('succeeded','duplicate_succeeded','refunding','refunded') THEN amount_cents ELSE 0 END) AS succeeded_amount_cents,
        max(updated_at) AS last_updated_at
        FROM commerce__payments WHERE created_at>=? AND created_at<=?`).bind(staleCreatingBefore,staleUnknownBefore,stalePendingBefore,window.from,window.to).first<CountRow>(),
      db.prepare(`SELECT
        count(*) AS total,
        sum(CASE WHEN source='callback' THEN 1 ELSE 0 END) AS callback_total,
        sum(CASE WHEN source='callback' AND event_type='payment_succeeded' THEN 1 ELSE 0 END) AS callback_success,
        sum(CASE WHEN source='callback' AND event_type LIKE 'payment_needs_review%' THEN 1 ELSE 0 END) AS callback_review,
        sum(CASE WHEN source='callback' AND event_type='payment_state_changed' THEN 1 ELSE 0 END) AS callback_state_changed,
        max(CASE WHEN source='callback' THEN created_at ELSE NULL END) AS last_callback_at,
        max(CASE WHEN event_type='payment_succeeded' THEN created_at ELSE NULL END) AS last_success_at,
        max(CASE WHEN event_type LIKE 'payment_needs_review%' THEN created_at ELSE NULL END) AS last_review_at
        FROM commerce__payment_events WHERE created_at>=? AND created_at<=?`).bind(window.from,window.to).first<CountRow>(),
      readPaymentOrders(db,normalized)
    ]);

    const result = {
      checkedAt: new Date().toISOString(),
      window,
      provider: {name:'jianpay',configured:Boolean(config.JIANPAY_CLIENT_NO && config.JIANPAY_MERCHANT_KEY),callbackPath:'/v1/payments/jianpay/notify'},
      orders: {total:count(orders,'total'),pending:count(orders,'pending'),stalePending:count(orders,'stale_pending'),fulfilled:count(orders,'fulfilled'),expired:count(orders,'expired'),refunded:count(orders,'refunded'),lastCreatedAt:timestamp(orders,'last_created_at')},
      payments: {total:count(payments,'total'),creating:count(payments,'creating'),staleCreating:count(payments,'stale_creating'),createUnknown:count(payments,'create_unknown'),staleCreateUnknown:count(payments,'stale_create_unknown'),pending:count(payments,'pending'),stalePending:count(payments,'stale_pending'),succeeded:count(payments,'succeeded'),failed:count(payments,'failed'),closed:count(payments,'closed'),needsReview:count(payments,'needs_review'),terminalOther:count(payments,'terminal_other'),succeededAmountCents:count(payments,'succeeded_amount_cents'),lastUpdatedAt:timestamp(payments,'last_updated_at')},
      callbacks: {total:count(events,'callback_total'),successful:count(events,'callback_success'),stateChanged:count(events,'callback_state_changed'),needsReview:count(events,'callback_review'),lastAt:timestamp(events,'last_callback_at'),lastSuccessAt:timestamp(events,'last_success_at'),lastReviewAt:timestamp(events,'last_review_at')},
      thresholds: {stalePendingMinutes:15,staleCreatingMinutes:5,staleCreateUnknownMinutes:10},
      alerts: [] as Array<{code:string;severity:'info'|'warning'|'critical';message:string}>,
      orderList
    };
    if (!result.provider.configured) result.alerts.push({code:'provider_not_configured',severity:'critical',message:'支付渠道配置不完整'});
    if (result.payments.needsReview>0) result.alerts.push({code:'payments_need_review',severity:'critical',message:`${result.payments.needsReview} 笔支付需要人工复核`});
    if (result.payments.staleCreateUnknown>0) result.alerts.push({code:'payment_create_unknown',severity:'critical',message:`${result.payments.staleCreateUnknown} 笔支付创建结果超过 10 分钟未知`});
    if (result.payments.staleCreating>0) result.alerts.push({code:'payment_create_stuck',severity:'warning',message:`${result.payments.staleCreating} 笔支付创建状态超过 5 分钟`});
    if (result.payments.stalePending>0 && result.callbacks.total===0) result.alerts.push({code:'callback_not_seen',severity:'warning',message:'存在超过 15 分钟的待支付订单，近 24 小时尚未收到回调'});
    if (result.payments.stalePending>0 && result.callbacks.total>0) result.alerts.push({code:'payment_pending_stale',severity:'warning',message:`${result.payments.stalePending} 笔待支付超过 15 分钟`});
    if (!result.alerts.length) result.alerts.push({code:'payment_healthy',severity:'info',message:'近 24 小时未发现支付异常'});
    return result;
  });
}
