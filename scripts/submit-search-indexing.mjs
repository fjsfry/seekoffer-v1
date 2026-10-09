const DEFAULT_SITE_URL = 'https://www.seekoffer.com.cn';
const siteUrl = (process.env.SEO_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
const submitLimit = Number.parseInt(process.env.SEO_SUBMIT_LIMIT || '2000', 10);

function extractUrls(xml) {
  return Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/g))
    .map((match) => match[1].trim())
    .filter(Boolean)
    .slice(0, Number.isFinite(submitLimit) && submitLimit > 0 ? submitLimit : 2000);
}

async function loadSitemapUrls() {
  const response = await fetch(`${siteUrl}/sitemap.xml`, {
    headers: {
      'User-Agent': 'SeekofferSearchSubmit/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`读取 sitemap 失败：${response.status} ${response.statusText}`);
  }

  return extractUrls(await response.text());
}

async function submitIndexNow(urls) {
  const key = process.env.INDEXNOW_KEY;

  if (!key) {
    return { skipped: true, reason: '缺少 INDEXNOW_KEY' };
  }

  const endpoint = process.env.INDEXNOW_ENDPOINT || 'https://api.indexnow.org/indexnow';
  const payload = {
    host: new URL(siteUrl).host,
    key,
    keyLocation: `${siteUrl}/${key}.txt`,
    urlList: urls
  };
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(payload)
  });

  return {
    skipped: false,
    ok: response.ok,
    status: response.status,
    body: await response.text()
  };
}

async function submitBaidu(urls) {
  const token = process.env.BAIDU_PUSH_TOKEN;

  if (!token) {
    return { skipped: true, reason: '缺少 BAIDU_PUSH_TOKEN' };
  }

  const endpoint = `http://data.zz.baidu.com/urls?site=${siteUrl}&token=${encodeURIComponent(token)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    },
    body: urls.join('\n')
  });

  return {
    skipped: false,
    ok: response.ok,
    status: response.status,
    body: await response.text()
  };
}

async function main() {
  const urls = await loadSitemapUrls();
  console.log(JSON.stringify({ siteUrl, sitemapUrls: urls.length }, null, 2));

  const [indexNow, baidu] = await Promise.all([submitIndexNow(urls), submitBaidu(urls)]);

  console.log(
    JSON.stringify(
      {
        indexNow,
        baidu,
        manualNextSteps: [
          '在 Google Search Console 提交 sitemap.xml 并检查覆盖率。',
          '在 Bing Webmaster Tools 提交 sitemap.xml；配置 INDEXNOW_KEY 后可运行本脚本主动推送。',
          '在百度搜索资源平台验证站点并配置 BAIDU_PUSH_TOKEN 后运行本脚本主动推送。'
        ]
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
