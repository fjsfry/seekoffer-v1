'use client';

import { useEffect, useState } from 'react';
import { Check, LoaderCircle, Plus } from 'lucide-react';
import { addProjectToApplicationTable, fetchUserProjects, watchApplicationTable } from '@/lib/cloudbase-data';
import { getUserSession, signInWithWechat, watchUserSession } from '@/lib/user-session';

export function ApplicationActionButton({
  projectId,
  variant = 'primary'
}: {
  projectId: string;
  variant?: 'primary' | 'secondary';
}) {
  const [added, setAdded] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      const session = getUserSession();
      if (!session) {
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
    const disposeSession = watchUserSession(load);

    return () => {
      active = false;
      disposeApplications();
      disposeSession();
    };
  }, [projectId]);

  async function handleAdd() {
    if (pending || added) {
      return;
    }

    setPending(true);
    setMessage('');

    try {
      if (!getUserSession()) {
        await signInWithWechat();
      }

      await addProjectToApplicationTable(projectId);
      setAdded(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '请先完成微信登录后再加入申请表。');
    } finally {
      setPending(false);
    }
  }

  const className =
    variant === 'secondary'
      ? 'rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm'
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
          {added ? '已加入我的申请表' : pending ? '加入中...' : '加入我的申请表'}
        </span>
      </button>
      {message ? <div className="text-xs leading-5 text-rose-600">{message}</div> : null}
    </div>
  );
}
