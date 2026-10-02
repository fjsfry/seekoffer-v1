import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isSafePublicUrl} from '../scripts/sync-baoyan-notices-to-supabase.mjs';

test('public source URL guard rejects redirect targets that can reach local or credentialed services', () => {
  for (const value of [
    'http://127.0.0.1/admin',
    'https://localhost/admin',
    'http://169.254.169.254/latest/meta-data',
    'https://192.168.1.10/private',
    'https://user:password@example.edu.cn/notice',
    'ftp://example.edu.cn/notice'
  ]) assert.equal(isSafePublicUrl(value), false, value);

  assert.equal(isSafePublicUrl('https://example.edu.cn/notice'), true);
  assert.equal(isSafePublicUrl('http://example.edu.cn/notice'), true);
});
