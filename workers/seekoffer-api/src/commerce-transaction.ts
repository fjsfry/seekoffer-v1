import {ApiError} from './auth.ts';

// D1 does not expose row locks. Commerce writes therefore use the same
// optimistic revision guard as the existing payment subsystem, but keep an
// independent revision so a resource order cannot interfere with autofill
// entitlement writes.
export class CommerceTransaction {
  private statements: D1PreparedStatement[] = [];

  private constructor(private readonly db: D1Database, private readonly version: number) {}

  static async begin(db: D1Database) {
    const revision = await db.prepare("SELECT version FROM _business_revisions WHERE name='commerce'").first<{version:number}>();
    if (!revision || !Number.isSafeInteger(revision.version)) throw new ApiError(503, 'COMMERCE_SCHEMA_NOT_READY');
    return new CommerceTransaction(db, revision.version);
  }

  async row<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    return this.db.prepare(sql).bind(...params).first<T>();
  }

  async rows<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    return (await this.db.prepare(sql).bind(...params).all<T>()).results;
  }

  add(sql: string, params: unknown[] = []) {
    this.statements.push(this.db.prepare(sql).bind(...params));
  }

  event(input: {
    paymentId: string;
    orderId: string;
    source: 'create' | 'callback' | 'query' | 'local' | 'operator';
    eventType: string;
    providerStatus?: number | null;
    payloadHash: string;
    eventData?: Record<string, unknown>;
  }) {
    this.add(
      `INSERT INTO commerce__payment_events
        (id,payment_id,order_id,source,event_type,provider_status,payload_hash,event_data)
       VALUES(?,?,?,?,?,?,?,?)
       ON CONFLICT(payment_id,event_type,payload_hash) DO NOTHING`,
      [
        crypto.randomUUID(),
        input.paymentId,
        input.orderId,
        input.source,
        input.eventType,
        input.providerStatus ?? null,
        input.payloadHash,
        JSON.stringify(input.eventData ?? {})
      ]
    );
  }

  async commit() {
    if (!this.statements.length) return;
    const guardId = crypto.randomUUID();
    const statements = [
      this.db.prepare(
        `INSERT INTO _business_transaction_guards(id,valid)
         VALUES(?,CASE WHEN (SELECT version FROM _business_revisions WHERE name='commerce')=? THEN 1 ELSE 0 END)`
      ).bind(guardId, this.version),
      ...this.statements,
      this.db.prepare("UPDATE _business_revisions SET version=version+1 WHERE name='commerce'"),
      this.db.prepare('DELETE FROM _business_transaction_guards WHERE id=?').bind(guardId)
    ];
    try {
      await this.db.batch(statements);
    } catch (error) {
      if (error instanceof Error && /CHECK constraint failed: valid=1/.test(error.message)) {
        throw new ApiError(409, 'COMMERCE_TRANSACTION_CONFLICT');
      }
      throw error;
    }
  }
}

export function commerceIsoMicro(ms = Date.now()) {
  return new Date(ms).toISOString().replace('Z', '000Z');
}

export function commerceAddMinutes(value: string, minutes: number) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new ApiError(503, 'COMMERCE_TIMESTAMP_INVALID');
  return commerceIsoMicro(timestamp + minutes * 60_000);
}
