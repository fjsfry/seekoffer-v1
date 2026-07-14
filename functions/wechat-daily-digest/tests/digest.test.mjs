import assert from 'node:assert/strict';
import test from 'node:test';
import {
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
  assert.equal(digest.title, '7月13日｜预推免申请陆续开放');
  assert.match(digest.content, /南开大学/);
  assert.match(digest.content, /软件学院/);
  assert.match(digest.content, /先看这几条/);
  assert.match(digest.content, /文末「阅读原文」可查看全部通知与官方链接/);
  assert.doesNotMatch(digest.content, /DAILY BRIEF|PRE-RECOMMENDATION|font-size:46px/);
  assert.doesNotMatch(digest.content, /2026年南开大学软件学院2027年/);
  assert.equal(
    digest.sourceUrl,
    'https://www.seekoffer.com.cn/notices/?date=2026-07-13&year=2026&sort=publish'
  );
  assert.ok(digest.contentLength < 8_000);
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
  assert.match(result.article.content, /今日收录 2 条/);
  assert.match(result.article.content, /寻鹿 SeekOffer/);
  assert.equal(result.editorial.source, 'rules');
});

test('uses GPT structured output for restrained editorial copy', async () => {
  const calls = [];
  const editorialOutput = {
    titleHook: '先核对申请时间',
    lead: '今天的更新以预推免和开放日为主，建议先核对各项目的报名时间，再根据申请阶段查看院校原文。',
    selectedNoticeIds: ['n-2', 'n-1']
  };

  const result = await runDailyDigest({
    event: { dryRun: true, targetDate: '2026-07-13', notices },
    env: {
      OPENAI_API_KEY: 'test-openai-key',
      OPENAI_EDITORIAL_MODEL: 'gpt-5.4-mini'
    },
    fetchImpl: async (input, options = {}) => {
      const url = String(input);
      calls.push({ url, options });
      assert.equal(url, 'https://api.openai.com/v1/responses');
      const body = JSON.parse(options.body);
      assert.equal(body.model, 'gpt-5.4-mini');
      assert.equal(body.reasoning.effort, 'none');
      assert.equal(body.text.format.type, 'json_schema');
      assert.equal(body.text.format.strict, true);
      return new Response(JSON.stringify({
        id: 'resp_test_editorial',
        output: [{
          type: 'message',
          content: [{ type: 'output_text', text: JSON.stringify(editorialOutput) }]
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(result.article.title, '7月13日｜先核对申请时间');
  assert.equal(result.editorial.source, 'openai');
  assert.equal(result.editorial.model, 'gpt-5.4-mini');
  assert.match(result.article.content, /中南大学/);
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
      assert.equal(media.type, 'image/jpeg');
      const bytes = Buffer.from(await media.arrayBuffer());
      assert.deepEqual([...bytes.subarray(0, 3)], [255, 216, 255]);
      assert.deepEqual([...bytes.subarray(-2)], [255, 217]);
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

test('updates an existing WeChat draft in place when force is enabled', async () => {
  const calls = [];
  const existingMediaId = 'existing-draft-media-id';
  const json = (value, status = 200) => new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

  const fetchImpl = async (input, options = {}) => {
    const url = String(input);
    const method = options.method || 'GET';
    calls.push({ url, method, body: options.body });

    if (url.includes('/rest/v1/notices?')) return json(notices);
    if (url.includes('/rest/v1/wechat_daily_publications?') && method === 'GET') {
      return json([{ status: 'drafted', notice_count: 2, wechat_media_id: existingMediaId }]);
    }
    if (url.includes('/rest/v1/wechat_daily_publications?') && method === 'PATCH') {
      return new Response(null, { status: 204 });
    }
    if (url.endsWith('/cgi-bin/stable_token')) return json({ access_token: 'test-access-token' });
    if (url.includes('/cgi-bin/material/add_material?')) return json({ media_id: 'updated-thumb-media-id' });
    if (url.includes('/cgi-bin/draft/update?')) {
      const body = JSON.parse(options.body);
      assert.equal(body.media_id, existingMediaId);
      assert.equal(body.index, 0);
      assert.match(body.articles.content, /寻鹿 SeekOffer/);
      assert.equal(body.articles.thumb_media_id, 'updated-thumb-media-id');
      return json({ errcode: 0, errmsg: 'ok' });
    }

    throw new Error(`Unexpected request: ${method} ${url}`);
  };

  const result = await runDailyDigest({
    event: { targetDate: '2026-07-13', force: true },
    env: {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      WECHAT_MP_APP_ID: 'test-app-id',
      WECHAT_MP_APP_SECRET: 'test-app-secret'
    },
    fetchImpl
  });

  assert.equal(result.ok, true);
  assert.equal(result.mediaId, existingMediaId);
  assert.ok(calls.some((call) => call.url.includes('/cgi-bin/draft/update?')));
  assert.ok(!calls.some((call) => call.url.includes('/cgi-bin/draft/add?')));
});
