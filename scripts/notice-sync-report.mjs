import fs from 'node:fs';

// Only aggregate fields may enter a public Actions summary or runner receipt.
export function noticeSyncReceipt(result) {
  const receipt = {schemaVersion: 1, at: new Date().toISOString(),
    destination: result.destination === 'd1.main__notices' ? result.destination : 'dry-run',
    complete: result.complete === true, stoppedReason: null};
  if (result.stoppedReason) receipt.stoppedReason = /^[A-Z_0-9]{1,80}$/.test(result.stoppedReason) ? result.stoppedReason : 'SYNC_FAILED';
  for (const key of ['mergedProjects','noticesReceived','noticesUpserted','unchanged','protected','remainingCandidates','rowsRead','rowsWritten','completedBatches','quarantinedCount']) {
    const value = Number(result[key] ?? 0);
    if (!Number.isSafeInteger(value) || value < 0) throw Error('INVALID_SYNC_RECEIPT');
    receipt[key] = value;
  }
  const quarantined = Array.isArray(result.quarantined) ? result.quarantined : [];
  receipt.quarantined = quarantined.slice(0, 100).map((item, index) => ({
    id: /^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/.test(String(item?.id || '')) ? String(item.id) : `record-${index + 1}`,
    code: /^[A-Z_0-9]{1,80}$/.test(String(item?.code || '')) ? String(item.code) : 'INVALID_INGEST_RECORD'
  }));
  const latest = result.sourceStats?.maxSourcePublishDate;
  if (/^20\d{2}-\d{2}-\d{2}$/.test(latest || '')) receipt.latestSourceDate = latest;
  return receipt;
}

export function saveNoticeSyncReceipt(result, env = process.env) {
  const receipt = noticeSyncReceipt(result);
  if (env.NOTICE_SYNC_RECEIPT_PATH) fs.writeFileSync(env.NOTICE_SYNC_RECEIPT_PATH, JSON.stringify(receipt, null, 2), {mode: 0o600});
  if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY,
    `### Notice acquisition → D1\n\nStatus: **${receipt.complete && receipt.quarantinedCount === 0 ? 'Complete' : receipt.complete ? 'Complete with quarantine' : 'Paused / incomplete'}**\n\n` +
    `Processed ${receipt.noticesReceived}; changed ${receipt.noticesUpserted}; unchanged ${receipt.unchanged}; protected ${receipt.protected}; quarantined ${receipt.quarantinedCount}; remaining ${receipt.remainingCandidates}.\n\n` +
    `D1 reported reads ${receipt.rowsRead}, writes ${receipt.rowsWritten}. Failed responses may not include usage.\n\n` +
    (receipt.stoppedReason ? `Stop: ${receipt.stoppedReason}. Existing data is retained; this is not a completed import.\n\n` : ''));
  return receipt;
}
