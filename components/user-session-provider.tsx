'use client';

import { createContext, startTransition, useContext, useEffect, useState } from 'react';
import {
  getUserSession,
  hydrateSupabaseSession,
  isLoggedInSession,
  isMemberSession,
  watchSupabaseAuthState,
  watchUserSession,
  type UserSession
} from '@/lib/user-session';

type UserSessionContextValue = {
  session: UserSession | null;
  ready: boolean;
  loggedIn: boolean;
  isMember: boolean;
  refresh: () => Promise<UserSession | null>;
};

const UserSessionContext = createContext<UserSessionContextValue | null>(null);

export function UserSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      startTransition(() => {
        setSession(getUserSession());
      });

      const hydrated = await hydrateSupabaseSession();
      if (!active) {
        return;
      }

      startTransition(() => {
        setSession(hydrated ?? getUserSession());
        setReady(true);
      });
    };

    void load();

    const dispose = watchUserSession(() => {
      if (!active) {
        return;
      }

      startTransition(() => {
        setSession(getUserSession());
      });
    });

    const disposeSupabase = watchSupabaseAuthState(() => {
      if (!active) {
        return;
      }

      startTransition(() => {
        setSession(getUserSession());
        setReady(true);
      });
    });

    return () => {
      active = false;
      dispose();
      disposeSupabase();
    };
  }, []);

  async function refresh() {
    const hydrated = await hydrateSupabaseSession();
    const nextSession = hydrated ?? getUserSession();

    startTransition(() => {
      setSession(nextSession);
      setReady(true);
    });

    return nextSession;
  }

  return (
    <UserSessionContext.Provider
      value={{
        session,
        ready,
        loggedIn: isLoggedInSession(session),
        isMember: isMemberSession(session),
        refresh
      }}
    >
      {children}
    </UserSessionContext.Provider>
  );
}

export function useUserSessionContext() {
  const context = useContext(UserSessionContext);

  if (!context) {
    throw new Error('useUserSessionContext must be used inside UserSessionProvider.');
  }

  return context;
}
