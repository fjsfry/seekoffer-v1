import { AuthActionBridge } from '@/components/auth-action-bridge';
import { AuthModal } from '@/components/auth-modal';
import { UserSessionProvider } from '@/components/user-session-provider';
import { VisitorPresenceTracker } from '@/components/visitor-presence-tracker';

export const buildSurfaceDocument = {
  className: undefined,
  suppressHydrationWarning: false
} as const;

export function BuildSurface({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <UserSessionProvider>
      <AuthActionBridge />
      <AuthModal />
      <VisitorPresenceTracker />
      {children}
    </UserSessionProvider>
  );
}
