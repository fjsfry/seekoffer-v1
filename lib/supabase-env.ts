export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const SEEKOFFER_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.seekoffer.com.cn';
export const SUPABASE_ENABLE_ANONYMOUS =
  (process.env.NEXT_PUBLIC_SUPABASE_ENABLE_ANONYMOUS || 'true').toLowerCase() !== 'false';
export const SUPABASE_ENABLE_PHONE_AUTH =
  (process.env.NEXT_PUBLIC_SUPABASE_ENABLE_PHONE_AUTH || 'false').toLowerCase() === 'true';

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
