'use client';

import { useUserSessionContext } from '@/components/user-session-provider';

export function useUserSessionState() {
  return useUserSessionContext();
}
