import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCoverSvg,
  buildDailyDigest,
  classifyNotice,
  getBeijingDateString,
  resolveTargetDate,
  runDailyDigest
} from '../digest-core.mjs';

const notices = [
  {
    id: 'n-1',
    school_name: '南开大学',
    department_name: '软件学院',
    project_name: '2026年南开大学软件学院2027年接收优秀应届本科毕业生免试攻读研究生报名通知',
    project_type: '预推免',
    publish_date: '2026-07-13',
    deadline_date: '2026-09-01 23:59',
    apply_link: 'https://example.edu.cn/apply',
    source_link: 'https://example.edu.cn/notice'
  },
  {
    id: 'n-2',
    school_name: '中南大学',
    department_name: '电子信息学院',
    project_name: '2026年中南大学电子信息学院暑期招生宣讲开放日通知',
    project_type: '夏令营',
    publish_date: '2026-07-13',
    deadline_date: '2026-07-20 23:59',
    apply_link: 'https://example.edu.cn/open-day',
    source_link: 'https://example.edu.cn/open-day'
  }
];

test('uses the Asia/Shanghai calendar date', () => {
  assert.equal(getBeijingDateString(new Date('2026-07-13T16:30:00Z')), '2026-07-14');
  assert.equal(resolveTargetDate({}, new Date('2026-07-13T16:30:00Z')), '2026-07-14');
});

test('classifies pre-recommendation and open-day notices', () => {
  assert.equal(classifyNotice(notices[0]), '预推免');
  assert.equal(classifyNotice(notices[1]), '开放日与宣讲');
});

test('builds bounded WeChat HTML and an exact-date source URL', () => {
  const digest = buildDailyDigest(notices, '2026-07-13', {
    siteUrl: 'https://www.seekoffer.com.cn',
    maxContentChars: 8_000
  });

  assert.equal(digest.noticeCount, 2);
  assert.equal(digest.includedCount, 2);
  assert.match(digest.title, /7月13日保研通知汇总/);
  assert.match(digest.content, /南开大学 · 软件学院/);
  assert.doesNotMatch(digest.content, /2026年南开大学软件学院2027年/);
  assert.equal(
    digest.sourceUrl,
    'https://www.seekoffer.com.cn/notices/?date=2026-07-13&year=2026&sort=publish'
  );
  assert.ok(digest.contentLength < 8_000);
});

test('renders an ASCII-only cover SVG for predictable server fonts', () => {
  const digest = buildDailyDigest(notices, '2026-07-13');
  const svg = buildCoverSvg(digest);
  assert.match(svg, /DAILY BRIEF/);
  assert.match(svg, /2026-07-13/);
  assert.match(svg, />2</);
});

test('supports a fixture-only dry run without secrets or network access', async () => {
  const result = await runDailyDigest({
    event: { dryRun: true, targetDate: '2026-07-13', notices },
    env: {},
    fetchImpl: () => {
      throw new Error('network should not be called');
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.noticeCount, 2);
  assert.match(result.article.content, /今日新增 2 条保研通知/);
});

test('runs the complete Supabase-to-WeChat draft workflow', async () => {
  const calls = [];
  const json = (value, status = 200) => new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

  const fetchImpl = async (input, options = {}) => {
    const url = String(input);
    const method = options.method || 'GET';
    calls.push({ url, method, body: options.body });

    if (url.includes('/rest/v1/notices?')) return json(notices);
    if (url.includes('/rest/v1/wechat_daily_publications?') && method === 'GET') return json([]);
    if (url.endsWith('/rest/v1/wechat_daily_publications') && method === 'POST') {
      return new Response('', { status: 201 });
    }
    if (url.includes('/rest/v1/wechat_daily_publications?') && method === 'PATCH') {
      return new Response(null, { status: 204 });
    }
    if (url.endsWith('/cgi-bin/stable_token')) return json({ access_token: 'test-access-token' });
    if (url.includes('/cgi-bin/material/add_material?')) {
      assert.ok(options.body instanceof FormData);
      const media = options.body.get('media');
      assert.equal(media.type, 'image/png');
      const bytes = Buffer.from(await media.arrayBuffer());
      assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      assert.equal(bytes.readUInt32BE(16), 900);
      assert.equal(bytes.readUInt32BE(20), 383);
      return json({ media_id: 'test-thumb-media-id' });
    }
    if (url.includes('/cgi-bin/draft/add?')) return json({ media_id: 'test-draft-media-id' });

    throw new Error(`Unexpected request: ${method} ${url}`);
  };

  const result = await runDailyDigest({
    event: { targetDate: '2026-07-13' },
    env: {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      WECHAT_MP_APP_ID: 'test-app-id',
      WECHAT_MP_APP_SECRET: 'test-app-secret',
      SEEKOFFER_SITE_URL: 'https://www.seekoffer.com.cn'
    },
    fetchImpl
  });

  assert.equal(result.ok, true);
  assert.equal(result.noticeCount, 2);
  assert.equal(result.mediaId, 'test-draft-media-id');
  assert.equal(result.thumbMediaId, 'test-thumb-media-id');
  assert.equal(calls.filter((call) => call.method === 'PATCH').length, 1);
  assert.ok(calls.some((call) => call.url.includes('/cgi-bin/draft/add?')));
});
