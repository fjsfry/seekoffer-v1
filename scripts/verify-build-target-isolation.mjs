import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const TARGETS = new Set(['web', 'desktop']);
const DESKTOP_HTML_MARKERS = [
  'seekoffer-desktop-surface',
  'desktop-preference-bootstrap'
];
const DESKTOP_CSS_MARKERS = [
  '.desktop-titlebar',
  '.desktop-primary-nav-item',
  '.desktop-update-toast'
];
const DESKTOP_JS_MARKERS = [
  'desktop_frontend_ready',
  'desktop-app-shell',
  'desktop-update-toast'
];

function collectFiles(directory, extension, result = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectFiles(entryPath, extension, result);
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      result.push(entryPath);
    }
  }
  return result;
}

function collectLoadedAssets(distDirectory, htmlFiles) {
  const assets = new Set();
  const assetPattern = /(?:src|href)=["']([^"']+\.(?:css|js)(?:[?#][^"']*)?)["']/g;

  for (const htmlFile of htmlFiles) {
    const html = readFileSync(htmlFile, 'utf8');
    for (const match of html.matchAll(assetPattern)) {
      const assetUrl = new URL(match[1], 'https://seekoffer.local');
      const relativePath = decodeURIComponent(assetUrl.pathname).replace(/^\/+/, '');
      const assetPath = path.join(distDirectory, ...relativePath.split('/'));
      if (!existsSync(assetPath)) {
        throw new Error(`构建产物引用了不存在的资源：${assetUrl.pathname}`);
      }
      assets.add(assetPath);
    }
  }

  return [...assets];
}

function assertMarkers({ target, kind, content, markers }) {
  const found = markers.filter((marker) => content.includes(marker));
  if (target === 'desktop' && found.length !== markers.length) {
    const missing = markers.filter((marker) => !found.includes(marker));
    throw new Error(`desktop ${kind} 产物缺少必需标记：${missing.join(', ')}`);
  }
  if (target === 'web' && found.length > 0) {
    throw new Error(`web ${kind} 产物泄漏了桌面标记：${found.join(', ')}`);
  }
}

export function verifyBuildTargetIsolation({ target, distDirectory }) {
  if (!TARGETS.has(target)) {
    throw new Error(`未知构建目标：${target}`);
  }

  const resolvedDistDirectory = path.resolve(distDirectory);
  if (!existsSync(resolvedDistDirectory) || !statSync(resolvedDistDirectory).isDirectory()) {
    throw new Error(`构建产物目录不存在：${resolvedDistDirectory}`);
  }

  const htmlFiles = collectFiles(resolvedDistDirectory, '.html');
  if (htmlFiles.length === 0) {
    throw new Error(`构建产物中没有 HTML：${resolvedDistDirectory}`);
  }

  const htmlContent = htmlFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
  const loadedAssets = collectLoadedAssets(resolvedDistDirectory, htmlFiles);
  const cssAssets = loadedAssets.filter((file) => file.endsWith('.css'));
  const jsAssets = loadedAssets.filter((file) => file.endsWith('.js'));
  const cssContent = cssAssets.map((file) => readFileSync(file, 'utf8')).join('\n');
  const jsContent = jsAssets.map((file) => readFileSync(file, 'utf8')).join('\n');

  assertMarkers({ target, kind: 'HTML', content: htmlContent, markers: DESKTOP_HTML_MARKERS });
  assertMarkers({ target, kind: 'CSS', content: cssContent, markers: DESKTOP_CSS_MARKERS });
  assertMarkers({ target, kind: 'JS', content: jsContent, markers: DESKTOP_JS_MARKERS });

  return {
    target,
    distDirectory: resolvedDistDirectory,
    htmlFiles: htmlFiles.length,
    loadedAssets: loadedAssets.length,
    cssAssets: cssAssets.length,
    jsAssets: jsAssets.length,
    loadedBytes: loadedAssets.reduce((sum, file) => sum + statSync(file).size, 0)
  };
}

function isDirectInvocation() {
  return Boolean(process.argv[1]) && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isDirectInvocation()) {
  const target = process.argv[2];
  const defaultDistDirectory = target === 'desktop' ? '.next-desktop' : '.next-web';
  const result = verifyBuildTargetIsolation({
    target,
    distDirectory: process.argv[3] || defaultDistDirectory
  });
  console.log(
    `${result.target} 构建隔离校验通过（${result.htmlFiles} 个 HTML，` +
      `${result.cssAssets} 个 CSS，${result.jsAssets} 个 JS，` +
      `实际引用资源 ${result.loadedBytes} 字节）。`
  );
}
