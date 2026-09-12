'use strict';

exports.main = async (event = {}, context = {}) => {
  const { invokeD1Digest } = await import('./d1-runner.mjs');
  const result = await invokeD1Digest(event);

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
