'use strict';

exports.main = async (event = {}, context = {}) => {
  const { runDailyDigest } = await import('./digest-core.mjs');
  const result = await runDailyDigest({ event, env: process.env });

  console.log(JSON.stringify({
    requestId: context.requestId || context.request_id || '',
    ok: result.ok,
    dryRun: Boolean(result.dryRun),
    skipped: Boolean(result.skipped),
    reason: result.reason || '',
    targetDate: result.targetDate,
    noticeCount: result.noticeCount,
    includedCount: result.includedCount || 0
  }));

  return result;
};
