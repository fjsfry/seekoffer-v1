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
    assert: (source) =>
      /contentType/.test(source) &&
      /Offer动态/.test(source) &&
      /社区讨论/.test(source)
  },
  {
    name: 'Admin settings page is standalone and reads real settings',
    file: 'app/admin/settings/page.tsx',
    assert: (source) =>
      !/from ['"]\.\.\/crawlers\/page['"]/.test(source) &&
      /resource:\s*['"]settings['"]/.test(source) &&
      /adminChannels/.test(source) &&
      /operation_log_retention_days/.test(source)
  },
  {
    name: 'Admin session refresh is cached and de-duplicated',
    file: 'lib/admin-session.ts',
    assert: (source) => /ADMIN_SESSION_TTL_MS/.test(source) && /refreshInFlight/.test(source) && /getFreshAdminSession/.test(source)
  },
  {
    name: 'Admin Edge Function does not use wildcard CORS',
    file: 'supabase/functions/admin-api/index.ts',
    assert: (source) => !/Access-Control-Allow-Origin['"]?\s*:\s*['"]\*/.test(source)
  },
  {
    name: 'Admin Edge Function has no email allowlist fallback',
    file: 'supabase/functions/admin-api/index.ts',
    assert: (source) => !/SEEKOFFER_ADMIN_EMAILS|fallbackAdmin/.test(source)
  },
  {
    name: 'Admin Edge Function enforces role permissions',
    file: 'supabase/functions/admin-api/index.ts',
    assert: (source) => /requireAdminPermission/.test(source) && /admin_permission_denied/.test(source)
  },
  {
    name: 'Admin Edge Function validates status and setting keys',
    file: 'supabase/functions/admin-api/index.ts',
    assert: (source) => /requireOneOf/.test(source) && /allowedSettingKeys/.test(source) && /normalizeSettingValue/.test(source)
  },
  {
    name: 'Admin database hardening migration revokes public security definer execution',
    file: 'supabase/migrations/20260508_0005_admin_security_hardening.sql',
    assert: (source) => /revoke execute on function public\.handle_new_user_profile/.test(source) && /seekoffer_user_has_active_pro/.test(source)
  },
  {
    name: 'Public insert policies validate user-supplied payloads',
    file: 'supabase/migrations/20260508_0005_admin_security_hardening.sql',
    assert: (source) => /length\(trim\(wechat_id\)\) between 2 and 80/.test(source) && /length\(trim\(content\)\) between 4 and 2000/.test(source)
  },
  {
    name: 'Private admin tables explicitly deny browser client access',
    file: 'supabase/migrations/20260508_0006_admin_private_deny_policies.sql',
    assert: (source) =>
      /admin_users_private_deny/.test(source) &&
      /admin_operation_logs_private_deny/.test(source) &&
      /admin_system_settings_private_deny/.test(source) &&
      /user_moderation_private_deny/.test(source)
  },
  {
    name: 'Launch migration protects community writes and analytics retention',
    file: 'supabase/migrations/20260711013116_launch_readiness_hardening.sql',
    assert: (source) =>
      /offer_comments_insert_authenticated/.test(source) &&
      /offer_post_follows_insert_own/.test(source) &&
      /seekoffer_purge_expired_analytics/.test(source) &&
      /interval '180 days'/.test(source)
  },
  {
    name: 'Public community reads do not expose ownership or moderation columns',
    file: 'supabase/migrations/20260711013116_launch_readiness_hardening.sql',
    assert: (source) =>
      /revoke select on public\.offer_posts from anon, authenticated/.test(source) &&
      /grant select \([\s\S]*?reports_count,[\s\S]*?created_at[\s\S]*?\) on public\.offer_posts to anon, authenticated/.test(source) &&
      /grant select \([\s\S]*?post_id,[\s\S]*?updated_at[\s\S]*?\) on public\.offer_comments to anon, authenticated/.test(source)
  },
  {
    name: 'Database performance migration indexes foreign keys and caches auth checks',
    file: 'supabase/migrations/20260711060000_database_performance_hardening.sql',
    assert: (source) =>
      /notices_created_by_idx/.test(source) &&
      /user_entitlements_source_order_id_idx/.test(source) &&
      /notices_select_authenticated/.test(source) &&
      /\(select auth\.uid\(\)\)/.test(source)
  },
  {
    name: 'Community clients can filter only on non-sensitive moderation state',
    file: 'supabase/migrations/20260711063000_community_public_read_fix.sql',
    assert: (source) =>
      /review_status/.test(source) &&
      /hidden_at/.test(source) &&
      /deleted_at/.test(source) &&
      !/user_id/.test(source) &&
      !/review_note/.test(source)
  },
  {
    name: 'Anonymous analytics only starts after an explicit preference',
    file: 'components/visitor-presence-tracker.tsx',
    assert: (source) =>
      /readAnalyticsPreference\(\) === 'accepted'/.test(source) &&
      /!analyticsAllowed/.test(source)
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
