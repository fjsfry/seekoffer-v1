import { invokeD1Digest } from './wechat-d1-runner.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { renderCoverJpeg } from '../functions/wechat-daily-digest/digest-core.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');

function readArgument(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] || fallback) : fallback;
}

function validateDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid --target-date value: ${value}`);
  }
  return value;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildPreviewDocument(result, coverFilename) {
  const article = result.article;
  const title = escapeHtml(article.title);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · 手机端预览</title>
  <style>
    * { box-sizing: border-box; }
    html { background: #edf1f3; }
    body {
      margin: 0;
      padding: 28px 16px 56px;
      color: #263746;
      background:
        radial-gradient(circle at 10% 0%, rgba(57, 122, 130, 0.12), transparent 34rem),
        #edf1f3;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    }
    .review-meta {
      width: min(390px, 100%);
      margin: 0 auto 12px;
      color: #687b88;
      font-size: 12px;
      line-height: 1.7;
      letter-spacing: 0.04em;
    }
    .phone {
      width: min(390px, 100%);
      margin: 0 auto;
      overflow: hidden;
      border: 1px solid rgba(16, 42, 67, 0.08);
      border-radius: 24px;
      background: #ffffff;
      box-shadow: 0 24px 70px rgba(25, 45, 60, 0.15);
    }
    .phone-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 18px 10px;
      color: #203849;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .phone-bar::after { content: "•••"; letter-spacing: 0.1em; }
    .article { padding: 8px 18px 34px; overflow-wrap: anywhere; }
    h1 { margin: 8px 0 10px; color: #172f43; font-size: 22px; line-height: 1.42; }
    .byline { margin: 0 0 18px; color: #8a9aa5; font-size: 13px; }
    .byline strong { color: #397a82; font-weight: 600; }
    .cover { display: block; width: 100%; height: auto; margin: 0 0 18px; border-radius: 8px; }
    .wechat-content { min-width: 0; }
    @media (max-width: 420px) {
      body { padding: 0; background: #ffffff; }
      .review-meta { display: none; }
      .phone { width: 100%; border: 0; border-radius: 0; box-shadow: none; }
      .article { padding-right: 16px; padding-left: 16px; }
    }
  </style>
</head>
<body>
  <p class="review-meta">WECHAT ARTICLE · 390 PX REVIEW</p>
  <main class="phone" data-preview="wechat-daily-digest">
    <div class="phone-bar"><span>21:30</span></div>
    <article class="article">
      <h1>${title}</h1>
      <p class="byline">寻鹿Seekoffer&nbsp;&nbsp;<strong>${escapeHtml(result.targetDate)}</strong></p>
      <img class="cover" src="./${escapeHtml(coverFilename)}" alt="${title}封面">
      <div class="wechat-content">${article.content}</div>
    </article>
  </main>
</body>
</html>`;
}

const beijingDate = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
const targetDate = validateDate(readArgument('--target-date', beijingDate));
const editorialFile = readArgument('--editorial-file');
const editorial = editorialFile
  ? JSON.parse(await readFile(path.resolve(repositoryRoot, editorialFile), 'utf8'))
  : undefined;
const outputDirectory = path.resolve(
  repositoryRoot,
  readArgument('--out', 'docs/previews/wechat-daily-digest-v3')
);
const result = await invokeD1Digest({dryRun:true,targetDate,...(editorial ? {editorial} : {})});
const coverFilename = `cover-${targetDate}.jpg`;
const cover = await renderCoverJpeg({ targetDate, noticeCount: Number(result.noticeCount) });
const preview = buildPreviewDocument(result, coverFilename);
const manifest = {
  artifact: 'SeekOffer WeChat Daily Digest v3',
  generatedAt: new Date().toISOString(),
  targetDate,
  noticeCount: Number(result.noticeCount),
  includedCount: Number(result.includedCount),
  omittedCount: Number(result.omittedCount),
  title: result.article.title,
  sourceUrl: result.article.sourceUrl,
  dimensions: { previewWidth: 390, coverWidth: 900, coverHeight: 383 },
  renderer: 'D1 public notices, reviewed copy and a deterministic JPEG cover',
  generatedLayers: [],
  editorial: result.editorial || { source: 'unknown', model: '', fallbackReason: '' },
  provenance: {
    content: 'D1-backed public API; dry-run without external model calls',
    fonts: 'Lato and a SeekOffer subset of Noto Sans SC from Google Fonts, licensed under SIL Open Font License 1.1'
  }
};

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(path.join(outputDirectory, coverFilename), cover),
  writeFile(path.join(outputDirectory, 'preview.html'), preview, 'utf8'),
  writeFile(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
]);

console.log(JSON.stringify({
  ok: true,
  outputDirectory,
  targetDate,
  noticeCount: manifest.noticeCount,
  contentLength: result.article.contentLength,
  coverBytes: cover.length
}));
