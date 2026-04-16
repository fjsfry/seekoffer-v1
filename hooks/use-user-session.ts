'use client';

import { useEffect, useState } from 'react';
import { getUserSession, hydrateCloudbaseSession, watchUserSession, type UserSession } from '@/lib/user-session';

export function useUserSessionState() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = async () => {
      setSession(getUserSession());
      await hydrateCloudbaseSession();
      setSession(getUserSession());
      setReady(true);
    };

    void load();
    const dispose = watchUserSession(() => {
      setSession(getUserSession());
    });

    return () => dispose();
  }, []);

  return {
    session,
    ready,
    loggedIn: Boolean(session?.loggedIn)
  };
}
