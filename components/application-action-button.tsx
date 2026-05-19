'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Check, LoaderCircle, Plus } from 'lucide-react';
import { addProjectToApplicationTable, fetchUserProjects, watchApplicationTable } from '@/lib/cloudbase-data';
import { openAuthModal, writeAuthIntent } from '@/lib/auth-intent';
import { useUserSessionState } from '@/hooks/use-user-session';

function getActionErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const message = record.message || record.error_description || record.error || record.details;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return '加入申请表失败，请刷新后重试；如果仍然失败，请通过右下角反馈入口告诉我们。';
}

export function ApplicationActionButton({
  projectId,
  variant = 'primary',
  label = '加入我的申请表',
  addedLabel
}: {
  projectId: string;
  variant?: 'primary' | 'secondary';
  label?: string;
  addedLabel?: string;
}) {
  const pathname = usePathname();
  const { loggedIn } = useUserSessionState();
  const [added, setAdded] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      if (!loggedIn) {
        if (active) {
          setAdded(false);
        }
        return;
      }

      const rows = await fetchUserProjects();
      if (active) {
        setAdded(rows.some((item) => item.projectId === projectId));
      }
    }

    void load();
    const disposeApplications = watchApplicationTable(load);

    return () => {
      active = false;
      disposeApplications();
    };
  }, [loggedIn, projectId]);

  async function handleAdd() {
    if (pending || added) {
      return;
    }

    setPending(true);
    setMessage('');

    try {
      if (!loggedIn) {
        const intent = {
          type: 'add-project' as const,
          projectId,
          returnTo: pathname,
          reason: 'application-action',
          requiredAuth: 'session' as const
        };
        writeAuthIntent(intent);
        openAuthModal(intent);
        return;
      }

      await addProjectToApplicationTable(projectId);
      setAdded(true);
    } catch (error) {
      setMessage(getActionErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  const className =
    variant === 'secondary'
      ? 'w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep disabled:opacity-70'
      : 'rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white';

  return (
    <div className="space-y-2">
      <button onClick={handleAdd} className={className} disabled={pending}>
        <span className="inline-flex items-center gap-2">
          {pending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : added ? (
            <Check className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {added ? addedLabel || (variant === 'secondary' ? '已加入' : '已加入我的申请表') : pending ? '加入中...' : label}
        </span>
      </button>
      {message ? <div className="text-xs leading-5 text-rose-600">{message}</div> : null}
    </div>
  );
}
