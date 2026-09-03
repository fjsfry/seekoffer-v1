import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

export type DesktopDownloadAttempt = {
  attemptId: string;
  releaseVersion: string;
  platform: 'windows_x86_64';
  source: 'website_download_page';
};

type DesktopDownloadAnalyticsDatabase = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      seekoffer_record_desktop_download_attempt: {
        Args: {
          p_attempt_id: string;
          p_release_version: string;
          p_platform: string;
          p_source: string;
        };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let serviceClient: SupabaseClient<DesktopDownloadAnalyticsDatabase> | null = null;

function getDesktopDownloadAnalyticsClient() {
  if (serviceClient) return serviceClient;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url || !serviceRoleKey) {
    throw new Error('Desktop download analytics is not configured.');
  }

  serviceClient = createClient<DesktopDownloadAnalyticsDatabase>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  return serviceClient;
}

export async function recordDesktopDownloadAttempt(
  attempt: DesktopDownloadAttempt,
  signal: AbortSignal
) {
  const { data, error } = await getDesktopDownloadAnalyticsClient()
    .rpc('seekoffer_record_desktop_download_attempt', {
      p_attempt_id: attempt.attemptId,
      p_release_version: attempt.releaseVersion,
      p_platform: attempt.platform,
      p_source: attempt.source
    })
    .abortSignal(signal);

  if (error) {
    throw new Error('Desktop download analytics write failed.');
  }

  return data === true;
}
