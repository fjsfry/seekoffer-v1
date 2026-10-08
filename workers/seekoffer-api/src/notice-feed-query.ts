// This exact indexed shape has a separate, bounded browsing allowance. Never
// use it for arbitrary filters: they can turn a small LIMIT into a table scan.
export const noticeFeedIndex = 'main__notices_public_feed_v3_idx';
export const noticeFeedPrefix = "SELECT catalog_projection FROM main__notices n INDEXED BY " + noticeFeedIndex + " WHERE n.is_private=0 AND n.admin_status='published' AND n.admin_deleted_at IS NULL AND n.catalog_projection IS NOT NULL AND n.year=? ORDER BY n.publish_date DESC,json_extract(n.catalog_projection,'$.sourceRank')";

export function noticeFeedSql(limit: number, offset: number) {
 if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000 || !Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw new Error('INVALID_FEED_WINDOW');
 return `${noticeFeedPrefix} LIMIT ${limit} OFFSET ${offset}`;
}

export function noticeFeedReservation(sql: string) {
 if (!sql.startsWith(noticeFeedPrefix)) return 0;
 const match = /^ LIMIT ([0-9]+) OFFSET ([0-9]+)$/.exec(sql.slice(noticeFeedPrefix.length));
 if (!match || noticeFeedSql(Number(match[1]), Number(match[2])) !== sql) return 0;
 // One index read plus one table lookup per entry, including skipped entries.
 return 2 * (Number(match[1]) + Number(match[2])) + 4;
}
