import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

const checks = [
  {
    name: 'No hard-coded admin demo accounts',
    file: 'lib/admin-data.ts',
    assert: (source) => !/adminAccounts|seekoffer-admin|seekoffer-ops/.test(source)
  },
  {
    name: 'Admin login does not import demo accounts',
    file: 'app/admin/login/page.tsx',
    assert: (source) => !/adminAccounts|admin-data/.test(source)
  },
  {
    name: 'Admin shell verifies session through admin API',
    file: 'components/admin-shell.tsx',
    assert: (source) => /refreshAdminSession/.test(source) && !/getAdminSession/.test(source)
  },
  {
    name: 'Admin shell exposes all primary admin channels',
    file: 'components/admin-shell.tsx',
    assert: (source) =>
      ['/admin/dashboard', '/admin/notices', '/admin/offers', '/admin/users', '/admin/feedback', '/admin/logs', '/admin/settings'].every((path) =>
        source.includes(path)
      )
  },
  {
    name: 'Offer moderation uses the same content model as the public community',
    file: 'app/admin/offers/page.tsx',
    assert: (source) => /contentType/.test(source) && /Offer动态/.test(source) && /社区讨论/.test(source)
  },
  {
    name: 'Admin settings page is standalone and reads real settings',
    file: 'app/admin/settings/page.tsx',
    assert: (source) =>
      !/from ['"]\.\.\/crawlers\/page['"]/.test(source) &&
      /resource:\s*['"]settings['"]/.test(source) &&
      /settingDefinitions/.test(source) &&
      /roleRows/.test(source) &&
      /operation_log_retention_days/.test(source)
  },
  {
    name: 'Admin session refresh is cached and de-duplicated',
    file: 'lib/admin-session.ts',
    assert: (source) => /ADMIN_SESSION_TTL_MS/.test(source) && /refreshInFlight/.test(source) && /getFreshAdminSession/.test(source)
  },
  {
    name: 'Cloudflare Worker does not use wildcard CORS',
    file: 'workers/seekoffer-api/src/snapshot-worker.ts',
    assert: (source) => !/Access-Control-Allow-Origin['"]?\s*:\s*['"]\*/.test(source)
  },
  {
    name: 'Admin API resolves permissions from D1 and Clerk identity',
    file: 'workers/seekoffer-api/src/admin.ts',
    assert: (source) => /readClerkUser/.test(source) && /main__admin_users/.test(source) && /permit\(/.test(source)
  },
  {
    name: 'Worker admin route requires a verified bearer and snapshot admin',
    file: 'workers/seekoffer-api/src/snapshot-worker.ts',
    assert: (source) => /path==='\/v1\/admin'/.test(source) && /requireSnapshotAdmin/.test(source) && /Bearer /.test(source)
  },
  {
    name: 'Payment callbacks are signature-verified and scoped to commerce orders',
    file: 'workers/seekoffer-api/src/resource-commerce.ts',
    assert: (source) => /verifyJianPaySignature/.test(source) && /INVALID_PAYMENT_SIGNATURE/.test(source) && /NOT_RESOURCE_PAYMENT/.test(source)
  },
  {
    name: 'Anonymous analytics excludes administration pages and direct account identifiers',
    file: 'components/visitor-presence-tracker.tsx',
    assert: (source) => /pathname\.startsWith\('\/admin'\)/.test(source) && !/\b(?:email|phone|userId)\b/.test(source)
  }
];

const failures = checks.filter((check) => !check.assert(read(check.file)));

if (failures.length) {
  console.error('Admin security audit failed:');
  for (const failure of failures) {
    console.error(`- ${failure.name} (${failure.file})`);
  }
  process.exit(1);
}

console.log(`Admin security audit passed (${checks.length} checks).`);
