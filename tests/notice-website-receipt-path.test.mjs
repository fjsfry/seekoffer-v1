import {test} from 'node:test';
import assert from 'node:assert/strict';
import {websiteReceiptPath} from '../scripts/verify-notice-website-sync.mjs';

test('preflight and verification use separate receipt paths', () => {
  assert.equal(websiteReceiptPath({preflight: true, preflightPath: '/tmp/preflight.json', websitePath: '/tmp/website.json'}), '/tmp/preflight.json');
  assert.equal(websiteReceiptPath({preflight: false, preflightPath: '/tmp/preflight.json', websitePath: '/tmp/website.json'}), '/tmp/website.json');
  assert.equal(websiteReceiptPath({preflight: true, websitePath: '/tmp/website.json'}), '/tmp/website.json');
});
