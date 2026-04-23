'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { addProjectToApplicationTable } from '@/lib/cloudbase-data';
import { clearAuthIntent, readAuthIntent } from '@/lib/auth-intent';
import { useUserSessionState } from '@/hooks/use-user-session';
import { satisfiesAuthRequirement } from '@/lib/user-session';

export function AuthActionBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, session } = useUserSessionState();
  const runningRef = useRef(false);

  useEffect(() => {
    if (!ready || !session || runningRef.current) {
      return;
    }

    const intent = readAuthIntent();
    if (!intent) {
      return;
    }

    if (!satisfiesAuthRequirement(session, intent.requiredAuth)) {
      return;
    }

    runningRef.current = true;

    const run = async () => {
      try {
        if (intent.type === 'add-project') {
          await addProjectToApplicationTable(intent.projectId);
          if (intent.returnTo && intent.returnTo !== pathname) {
            router.push(intent.returnTo);
          }
          return;
        }

        if (intent.type === 'open-workspace') {
          if (intent.returnTo && intent.returnTo !== pathname) {
            router.push(intent.returnTo);
            return;
          }

          if (!intent.returnTo && pathname !== '/me') {
            router.push('/me');
          }

          return;
        }

        if (intent.type === 'publish-offer') {
          router.push(intent.returnTo || '/publish');
        }
      } finally {
        clearAuthIntent();
        runningRef.current = false;
      }
    };

    void run();
  }, [pathname, ready, router, session]);

  return null;
}
