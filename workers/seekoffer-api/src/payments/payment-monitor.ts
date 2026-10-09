import type {BootstrapConfig} from '../identity-bootstrap.ts';

type MonitorConfig = Pick<BootstrapConfig,'CLERK_BACKEND_SECRET'> & {
  JIANPAY_CLIENT_NO?: string;
  JIANPAY_MERCHANT_KEY?: string;
};
type CountRow = Record<string, number | string | null>;

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

export async function readPaymentMonitor(db: D1Database, config: MonitorConfig = {}) {
  const window = isoWindow();
  const stalePendingBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const staleCreatingBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const staleUnknownBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const [orders, payments, events] = await Promise.all([
    db.prepare(`SELECT
      count(*) AS total,
      sum(CASE WHEN status='fulfilled' THEN 1 ELSE 0 END) AS fulfilled,
      sum(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
      sum(CASE WHEN status='pending' AND created_at<? THEN 1 ELSE 0 END) AS stale_pending,
      sum(CASE WHEN status='expired' THEN 1 ELSE 0 END) AS expired,
      sum(CASE WHEN status='refunded' THEN 1 ELSE 0 END) AS refunded,
      max(created_at) AS last_created_at
      FROM commerce__orders WHERE created_at>=? AND created_at<=?`).bind(stalePendingBefore, window.from, window.to).first<CountRow>(),
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
      FROM commerce__payments WHERE created_at>=? AND created_at<=?`).bind(staleCreatingBefore, staleUnknownBefore, stalePendingBefore, window.from, window.to).first<CountRow>(),
    db.prepare(`SELECT
      count(*) AS total,
      sum(CASE WHEN source='callback' THEN 1 ELSE 0 END) AS callback_total,
      sum(CASE WHEN source='callback' AND event_type='payment_succeeded' THEN 1 ELSE 0 END) AS callback_success,
      sum(CASE WHEN source='callback' AND event_type LIKE 'payment_needs_review%' THEN 1 ELSE 0 END) AS callback_review,
      sum(CASE WHEN source='callback' AND event_type='payment_state_changed' THEN 1 ELSE 0 END) AS callback_state_changed,
      max(CASE WHEN source='callback' THEN created_at ELSE NULL END) AS last_callback_at,
      max(CASE WHEN event_type='payment_succeeded' THEN created_at ELSE NULL END) AS last_success_at,
      max(CASE WHEN event_type LIKE 'payment_needs_review%' THEN created_at ELSE NULL END) AS last_review_at
      FROM commerce__payment_events WHERE created_at>=? AND created_at<=?`).bind(window.from, window.to).first<CountRow>()
  ]);

  const result = {
    checkedAt: new Date().toISOString(),
    window,
    provider: {
      name: 'jianpay',
      configured: Boolean(config.JIANPAY_CLIENT_NO && config.JIANPAY_MERCHANT_KEY),
      callbackPath: '/v1/payments/jianpay/notify'
    },
    orders: {
      total: count(orders, 'total'),
      pending: count(orders, 'pending'),
      stalePending: count(orders, 'stale_pending'),
      fulfilled: count(orders, 'fulfilled'),
      expired: count(orders, 'expired'),
      refunded: count(orders, 'refunded'),
      lastCreatedAt: timestamp(orders, 'last_created_at')
    },
    payments: {
      total: count(payments, 'total'),
      creating: count(payments, 'creating'),
      staleCreating: count(payments, 'stale_creating'),
      createUnknown: count(payments, 'create_unknown'),
      staleCreateUnknown: count(payments, 'stale_create_unknown'),
      pending: count(payments, 'pending'),
      stalePending: count(payments, 'stale_pending'),
      succeeded: count(payments, 'succeeded'),
      failed: count(payments, 'failed'),
      closed: count(payments, 'closed'),
      needsReview: count(payments, 'needs_review'),
      terminalOther: count(payments, 'terminal_other'),
      succeededAmountCents: count(payments, 'succeeded_amount_cents'),
      lastUpdatedAt: timestamp(payments, 'last_updated_at')
    },
    callbacks: {
      total: count(events, 'callback_total'),
      successful: count(events, 'callback_success'),
      stateChanged: count(events, 'callback_state_changed'),
      needsReview: count(events, 'callback_review'),
      lastAt: timestamp(events, 'last_callback_at'),
      lastSuccessAt: timestamp(events, 'last_success_at'),
      lastReviewAt: timestamp(events, 'last_review_at')
    },
    thresholds: {
      stalePendingMinutes: 15,
      staleCreatingMinutes: 5,
      staleCreateUnknownMinutes: 10
    },
    alerts: [] as Array<{code: string; severity: 'info' | 'warning' | 'critical'; message: string}>
  };

  if (!result.provider.configured) result.alerts.push({code: 'provider_not_configured', severity: 'critical', message: '支付渠道配置不完整'});
  if (result.payments.needsReview > 0) result.alerts.push({code: 'payments_need_review', severity: 'critical', message: `${result.payments.needsReview} 笔支付需要人工复核`});
  if (result.payments.staleCreateUnknown > 0) result.alerts.push({code: 'payment_create_unknown', severity: 'critical', message: `${result.payments.staleCreateUnknown} 笔支付创建结果超过 10 分钟未知`});
  if (result.payments.staleCreating > 0) result.alerts.push({code: 'payment_create_stuck', severity: 'warning', message: `${result.payments.staleCreating} 笔支付创建状态超过 5 分钟`});
  if (result.payments.stalePending > 0 && result.callbacks.total === 0) result.alerts.push({code: 'callback_not_seen', severity: 'warning', message: '存在超过 15 分钟的待支付订单，近 24 小时尚未收到回调'});
  if (result.payments.stalePending > 0 && result.callbacks.total > 0) result.alerts.push({code: 'payment_pending_stale', severity: 'warning', message: `${result.payments.stalePending} 笔待支付超过 15 分钟`});
  if (!result.alerts.length) result.alerts.push({code: 'payment_healthy', severity: 'info', message: '近 24 小时未发现支付异常'});
  return result;
}
