import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { unstable_cache } from 'next/cache';
import { ServiceUnavailableError } from '@/lib/service-availability';

export const NOTICE_SHARD_BYTES = 256 * 1024;
const TTL_SECONDS = 300;
const TAG = 'seekoffer-public-notices';
type Envelope<T> = { value: T; expires: number } | { error: number; expires: number };

export async function capturePublicRead<T>(loader: () => Promise<T>): Promise<Envelope<T>> {
  try {
    const value = await loader();
    if (Buffer.byteLength(JSON.stringify(value)) > 1024 * 1024) throw new ServiceUnavailableError(503);
    return { value, expires: Date.now() + TTL_SECONDS * 1000 };
  } catch (error) {
    return { error: error instanceof ServiceUnavailableError ? error.status : 503, expires: Date.now() + TTL_SECONDS * 1000 };
  }
}

export function unwrapPublicRead<T>(result: Envelope<T>): T {
  if ('error' in result) throw new ServiceUnavailableError(result.error);
  // Next may return a stale entry while refreshing it. Expired publication data
  // must not become a fallback; the next successful fill can be served normally.
  if (Date.now() >= result.expires) throw new ServiceUnavailableError(503);
  return result.value;
}

function shardCache<T>(key: string, initial?: T[]) {
  // Identical callback and key for writes and reads. Never reconstruct an evicted
  // shard from another generation or by independently rescanning a source page.
  return unstable_cache(async () => {
    if (!initial) throw new ServiceUnavailableError(503);
    return initial;
  }, ['notice-immutable-shard-v1', key], { revalidate: false, tags: [TAG] });
}

export function createNoticeSnapshotCache<T>(loader: () => Promise<T[]>) {
  const getManifest = unstable_cache(async () => capturePublicRead(async () => {
    const rows = await loader();
    const version = randomUUID();
    const groups: T[][] = [];
    let group: T[] = [];
    let bytes = 2;
    for (const row of rows) {
      const size = Buffer.byteLength(JSON.stringify(row)) + 1;
      if (size + 2 > NOTICE_SHARD_BYTES) throw new ServiceUnavailableError(503);
      if (bytes + size > NOTICE_SHARD_BYTES) { groups.push(group); group = []; bytes = 2; }
      group.push(row); bytes += size;
    }
    if (group.length) groups.push(group);
    const shards: { key: string; sha256: string }[] = [];
    for (const [index, items] of groups.entries()) {
      const sha256 = createHash('sha256').update(JSON.stringify(items)).digest('hex');
      const key = `${version}:${index}:${sha256}`;
      await shardCache(key, items)();
      shards.push({ key, sha256 });
    }
    // Publish only after every shard was written; consumers use this one manifest.
    return { version, count: rows.length, shards };
  }), ['notice-atomic-manifest-v1', process.env.NEXT_PUBLIC_SUPABASE_URL || '', 'year=2026'], { revalidate: TTL_SECONDS, tags: [TAG] });

  let pending: Promise<{ items: T[]; version: string }> | null = null;
  return () => {
    if (pending) return pending;
    pending = (async () => {
      const manifest = unwrapPublicRead(await getManifest());
      const items: T[] = [];
      for (const shard of manifest.shards) {
        const rows = await shardCache<T>(shard.key)();
        if (createHash('sha256').update(JSON.stringify(rows)).digest('hex') !== shard.sha256) throw new ServiceUnavailableError(503);
        items.push(...rows);
      }
      if (items.length !== manifest.count) throw new ServiceUnavailableError(503);
      return { items, version: manifest.version };
    })().finally(() => { pending = null; });
    return pending;
  };
}
