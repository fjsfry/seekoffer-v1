'use client';

import { useEffect, useState } from 'react';
import { LoginMethodPanel } from '@/components/login-method-panel';
import { watchAuthModal } from '@/lib/auth-intent';

export function AuthModal() {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const dispose = watchAuthModal(() => {
      setOpen(true);
    });

    return () => dispose();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsMobile(media.matches);

    apply();
    media.addEventListener?.('change', apply);
    return () => media.removeEventListener?.('change', apply);
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        aria-label="关闭登录弹层"
        className="absolute inset-0 bg-slate-900/24 backdrop-blur-xl"
        onClick={() => setOpen(false)}
      />

      <div className="absolute inset-0 flex items-end justify-center p-0 sm:items-center sm:p-6">
        <LoginMethodPanel
          mode={isMobile ? 'popover' : 'modal'}
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
        />
      </div>
    </div>
  );
}
