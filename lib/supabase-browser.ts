'use client';

import { accountServiceFetch } from './service-availability';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './supabase-env';
import {isD1Backend} from './backend-mode';

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if(isD1Backend())throw new Error('该功能的新后端接口尚未接入，已阻止连接旧服务。');
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase environment variables are missing.');
  }

  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { fetch: accountServiceFetch },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
  }

  return browserClient;
}
