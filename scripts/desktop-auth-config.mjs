import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export const SUPABASE_URL_ENV = 'NEXT_PUBLIC_SUPABASE_URL';
export const SUPABASE_PUBLISHABLE_KEY_ENV = 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY';
export const SUPABASE_LEGACY_ANON_KEY_ENV = 'NEXT_PUBLIC_SUPABASE_ANON_KEY';

const ALLOWED_ENV_NAMES = new Set([
  SUPABASE_URL_ENV,
  SUPABASE_PUBLISHABLE_KEY_ENV,
  SUPABASE_LEGACY_ANON_KEY_ENV,
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SUPABASE_ENABLE_ANONYMOUS',
  'NEXT_PUBLIC_SUPABASE_ENABLE_PHONE_AUTH',
  'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_SECRET_KEY'
]);

function getLocalEnvCandidates(mode) {
  const nodeEnvironment = mode === 'development' ? 'development' : 'production';
  return [
    '.env.desktop.local',
    `.env.${nodeEnvironment}.local`,
    '.env.local',
    `.env.${nodeEnvironment}`,
    '.env',
    path.join('.vercel', '.env.production.local')
  ];
}

function cleanEnvValue(rawValue) {
  const trimmed = String(rawValue ?? '').trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function parsePublicDesktopEnv(text) {
  const values = {};
  for (const line of String(text).split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || !ALLOWED_ENV_NAMES.has(match[1])) continue;
    values[match[1]] = cleanEnvValue(match[2]);
  }
  return values;
}

function isPlaceholder(value) {
  return !value || /^(?:your[_-]|replace[_-]|example|changeme|<|\$\{)/i.test(value);
}

function decodeLegacyKeyRole(key) {
  const parts = key.split('.');
  if (parts.length !== 3) return '';
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload?.role === 'string' ? payload.role : '';
  } catch {
    return '';
  }
}

export function validateDesktopAuthConfig(config) {
  if (isPlaceholder(config.url)) {
    throw new Error(`桌面登录配置缺少 ${SUPABASE_URL_ENV}。`);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(config.url);
  } catch {
    throw new Error(`${SUPABASE_URL_ENV} 不是有效 URL。`);
  }

  const localDevelopmentUrl =
    parsedUrl.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsedUrl.hostname);
  if (parsedUrl.protocol !== 'https:' && !localDevelopmentUrl) {
    throw new Error(`${SUPABASE_URL_ENV} 必须使用 HTTPS（本地回环开发地址除外）。`);
  }

  if (isPlaceholder(config.key)) {
    throw new Error(
      `桌面登录配置缺少 ${SUPABASE_PUBLISHABLE_KEY_ENV} 或 ${SUPABASE_LEGACY_ANON_KEY_ENV}。`
    );
  }

  if (config.key.startsWith('sb_secret_')) {
    throw new Error('拒绝把 Supabase secret key 注入桌面客户端。');
  }

  if (config.key.startsWith('sb_publishable_')) {
    return { ...config, keyType: 'publishable' };
  }

  const legacyRole = decodeLegacyKeyRole(config.key);
  if (legacyRole === 'service_role') {
    throw new Error('拒绝把 Supabase service_role key 注入桌面客户端。');
  }
  if (legacyRole !== 'anon') {
    throw new Error('Supabase legacy 客户端 key 必须是 anon 角色。');
  }

  return { ...config, keyType: 'legacy-anon' };
}

async function readCandidate(filePath) {
  try {
    return parsePublicDesktopEnv(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export async function resolveDesktopAuthConfig({
  projectRoot,
  env = process.env,
  mode = 'production'
}) {
  const sources = [
    {
      label: 'process environment',
      values: Object.fromEntries(
        [...ALLOWED_ENV_NAMES].map((name) => [name, cleanEnvValue(env[name])])
      )
    }
  ];

  for (const relativePath of getLocalEnvCandidates(mode)) {
    const values = await readCandidate(path.join(projectRoot, relativePath));
    if (values) sources.push({ label: relativePath, values });
  }

  for (const source of sources) {
    if (
      source.values.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
      source.values.NEXT_PUBLIC_SUPABASE_SECRET_KEY
    ) {
      throw new Error('检测到 public 命名的 Supabase 高权限 key，已拒绝桌面构建。');
    }
  }

  let foundUrl = false;
  let foundKey = false;
  for (const source of sources) {
    const url = cleanEnvValue(source.values[SUPABASE_URL_ENV]);
    const publishableKey = cleanEnvValue(source.values[SUPABASE_PUBLISHABLE_KEY_ENV]);
    const legacyAnonKey = cleanEnvValue(source.values[SUPABASE_LEGACY_ANON_KEY_ENV]);
    const key = publishableKey || legacyAnonKey;
    foundUrl ||= Boolean(url);
    foundKey ||= Boolean(key);
    if (!url || !key) continue;

    return validateDesktopAuthConfig({
      url,
      key,
      keyEnvName: publishableKey
        ? SUPABASE_PUBLISHABLE_KEY_ENV
        : SUPABASE_LEGACY_ANON_KEY_ENV,
      keyType: publishableKey ? 'publishable' : 'legacy-anon',
      sources: {
        url: source.label,
        key: source.label
      }
    });
  }

  if (!foundUrl) {
    throw new Error(`桌面登录配置缺少 ${SUPABASE_URL_ENV}。`);
  }
  if (!foundKey) {
    throw new Error(
      `桌面登录配置缺少 ${SUPABASE_PUBLISHABLE_KEY_ENV} 或 ${SUPABASE_LEGACY_ANON_KEY_ENV}。`
    );
  }
  throw new Error('未在同一环境来源中找到完整的 Supabase URL 与公开客户端 key。');
}

export async function verifySupabasePublicAuthEndpoint({
  config,
  fetchImpl = fetch,
  timeoutMs = 15_000
}) {
  const settingsUrl = new URL(
    'auth/v1/settings',
    config.url.endsWith('/') ? config.url : `${config.url}/`
  );
  let response;
  try {
    response = await fetchImpl(settingsUrl, {
      method: 'GET',
      headers: { apikey: config.key },
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch {
    throw new Error('无法连接 Supabase Auth 公共配置端点，已停止桌面生产构建。');
  }

  if (!response.ok) {
    throw new Error(
      `Supabase Auth 公共配置校验失败（HTTP ${response.status}），已停止桌面生产构建。`
    );
  }

  return { reachable: true, status: response.status };
}

async function listJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return listJavaScriptFiles(entryPath);
      return entry.isFile() && entry.name.endsWith('.js') ? [entryPath] : [];
    })
  );
  return files.flat();
}

export async function verifyDesktopAuthExport({ distDirectory, config }) {
  const staticDirectory = path.join(distDirectory, '_next', 'static');
  const files = await listJavaScriptFiles(staticDirectory);
  let foundUrl = false;
  let foundKey = false;

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf8');
    if (content.includes(config.url)) foundUrl = true;
    if (content.includes(config.key)) foundKey = true;

    if (/sb_secret_[A-Za-z0-9_-]+/.test(content)) {
      throw new Error('桌面静态产物中检测到 Supabase secret key。');
    }

    for (const match of content.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
      if (decodeLegacyKeyRole(match[0]) === 'service_role') {
        throw new Error('桌面静态产物中检测到 Supabase service_role key。');
      }
    }
  }

  if (!foundUrl || !foundKey) {
    const missing = [!foundUrl ? SUPABASE_URL_ENV : '', !foundKey ? config.keyEnvName : '']
      .filter(Boolean)
      .join('、');
    throw new Error(`桌面静态产物缺少认证配置：${missing}。`);
  }

  return {
    configured: true,
    keyType: config.keyType,
    scannedFiles: files.length
  };
}
