'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, LoaderCircle, Plus, Save } from 'lucide-react';
import {
  addProjectToApplicationTable,
  fetchApplicationRows,
  updateUserProject,
  watchApplicationTable,
  type ApplicationRow
} from '@/lib/cloudbase-data';
import { openAuthModal, writeAuthIntent } from '@/lib/auth-intent';
import { trackDesktopPendingWrite } from '@/lib/desktop-pending-writes';
import { useUserSessionState } from '@/hooks/use-user-session';
import { DesktopLoadingIndicator, DesktopLoadingState } from '@/components/desktop-loading';
import {
  materialChecklistDefinitions,
  priorityOptions,
  userStatusOptions,
  type MaterialChecklistKey,
  type PriorityLevel,
  type UserProjectRecord
} from '@/lib/mock-data';

const isDesktopSurface = process.env.NEXT_PUBLIC_SEEKOFFER_SURFACE === 'desktop';

function PendingIndicator() {
  return isDesktopSurface
    ? <DesktopLoadingIndicator size="small" />
    : <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />;
}

export function NoticeWorkbenchPanel({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const { loggedIn, ready: sessionReady } = useUserSessionState();
  const [row, setRow] = useState<ApplicationRow | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const savingRef = useRef(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!sessionReady) {
        return;
      }

      if (!loggedIn) {
        if (active) {
          setRow(null);
          setLoadError('');
          setActionError('');
          setReady(true);
        }
        return;
      }

      try {
        const rows = await fetchApplicationRows();
        if (active) {
          const current = rows.find((item) => item.project.id === projectId) || null;
          setRow(current);
          setNote(current?.item.myNotes || '');
          setLoadError('');
        }
      } catch {
        if (active) setLoadError('暂时无法读取申请状态，请检查网络后重试。');
      } finally {
        if (active) setReady(true);
      }
    };

    void load();
    const disposeApplications = watchApplicationTable(load);

    return () => {
      active = false;
      disposeApplications();
    };
  }, [loggedIn, projectId, sessionReady, retryToken]);

  const progress = useMemo(() => row?.item.materialsProgress || 0, [row]);

  async function handleJoin() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setActionError('');

    try {
      if (!loggedIn) {
        const intent = {
          type: 'add-project' as const,
          projectId,
          returnTo: pathname,
          reason: 'notice-workbench',
          requiredAuth: 'session' as const
        };
        writeAuthIntent(intent);
        openAuthModal(intent);
        return;
      }

      await trackDesktopPendingWrite('notice-project-add', () =>
        addProjectToApplicationTable(projectId)
      );
      const rows = await fetchApplicationRows();
      const current = rows.find((item) => item.project.id === projectId) || null;
      setRow(current);
      setNote(current?.item.myNotes || '');
    } catch {
      setActionError('暂未确认加入结果，请刷新状态后重试。');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function handlePatch(patch: Partial<UserProjectRecord>) {
    if (!row || savingRef.current) {
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setActionError('');
    try {
      const next = await trackDesktopPendingWrite('notice-project-update', () =>
        updateUserProject(row.item.userProjectId, patch)
      );
      if (next) {
        const rows = await fetchApplicationRows();
        const current = rows.find((item) => item.project.id === projectId) || null;
        setRow(current);
      }
    } catch {
      setActionError('暂未确认保存结果，当前备注仍保留，请刷新状态后确认。');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function toggleChecklist(key: MaterialChecklistKey, current: boolean) {
    await handlePatch({ [key]: !current });
  }

  async function saveNote() {
    await handlePatch({ myNotes: note });
  }

  if (!ready) {
    if (isDesktopSurface) {
      return <DesktopLoadingState variant="detail" title="正在读取申请状态" detail="通知内容可以继续查看。" rows={3} compact />;
    }
    return (
      <section className="surface-card rounded-[32px] p-6 text-sm text-slate-500">
        正在检查申请状态...
      </section>
    );
  }

  if (loadError && !row) {
    return (
      <section className="surface-card rounded-[32px] p-6 text-sm text-slate-500">
        <p role="alert">{loadError}</p>
        <button type="button" className="mt-4 inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 text-brand" onClick={() => {
          setLoadError('');
          setReady(false);
          setRetryToken((value) => value + 1);
        }}>重新加载</button>
      </section>
    );
  }

  if (!loggedIn) {
    return (
      <section className="surface-card rounded-[32px] p-6">
        <div className="text-lg font-semibold text-ink">加入申请</div>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          登录后可把这条通知直接接入申请管理流程，并继续记录状态、备注和提醒。
        </p>
        <button
          onClick={handleJoin}
          disabled={saving}
          aria-busy={saving}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white"
        >
          {saving ? <PendingIndicator /> : <Plus className="h-4 w-4" />}
          登录并加入
        </button>
        {actionError ? <p role="alert" className="mt-3 text-sm text-rose-600">{actionError}</p> : null}
      </section>
    );
  }

  if (!row) {
    return (
      <section className="surface-card rounded-[32px] p-6">
        <div className="text-lg font-semibold text-ink">加入申请</div>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          一旦加入，这条通知会立刻接到你的申请表、待办和提醒逻辑里，后续就不需要重复整理。
        </p>
        <div className="mt-5 grid gap-3 rounded-[24px] bg-slate-50 p-4 text-sm text-slate-600">
          <div>默认状态：已收藏</div>
          <div>默认提醒：开启 7 天 / 3 天 / 当天提醒</div>
          <div>默认动作：后续可在全部申请中继续补充材料和备注</div>
        </div>
        <button
          onClick={handleJoin}
          disabled={saving}
          aria-busy={saving}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white"
        >
          {saving ? <PendingIndicator /> : <Plus className="h-4 w-4" />}
          加入申请
        </button>
        {actionError ? <p role="alert" className="mt-3 text-sm text-rose-600">{actionError}</p> : null}
      </section>
    );
  }

  return (
    <section className="surface-card rounded-[32px] p-6" aria-busy={saving}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-lg font-semibold text-ink">全部申请</div>
        <span className="rounded-full bg-brand-cream px-3 py-1 text-xs font-semibold text-brand">
          材料完成度 {progress}%
        </span>
      </div>

      {loadError ? <p role="status" className="mt-3 text-sm text-slate-500">{loadError} 当前申请内容已保留。</p> : null}
      {actionError ? <p role="alert" className="mt-3 text-sm text-rose-600">{actionError}</p> : null}

      <div className="mt-5 grid gap-4">
        <label className="block">
          <div className="mb-2 text-sm font-semibold text-ink">当前状态</div>
          <select
            disabled={saving}
            value={row.item.myStatus}
            onChange={(event) => void handlePatch({ myStatus: event.target.value as UserProjectRecord['myStatus'] })}
            className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
          >
            {userStatusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="mb-2 text-sm font-semibold text-ink">优先级</div>
          <select
            disabled={saving}
            value={row.item.priorityLevel}
            onChange={(event) => void handlePatch({ priorityLevel: event.target.value as PriorityLevel })}
            className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
          >
            {priorityOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <button
          disabled={saving}
          onClick={() => void handlePatch({ customReminderEnabled: !row.item.customReminderEnabled })}
          className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
            row.item.customReminderEnabled ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700'
          }`}
        >
          <Bell className="h-4 w-4" />
          {row.item.customReminderEnabled ? '已开启截止提醒' : '开启截止提醒'}
        </button>

        <div className="rounded-[24px] bg-slate-50 p-4">
          <div className="text-sm font-semibold text-ink">材料进度</div>
          <div className="mt-3 grid gap-2">
            {materialChecklistDefinitions.map((field) => (
              <button
                key={field.key}
                disabled={saving}
                onClick={() => void toggleChecklist(field.key, row.item[field.key])}
                className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                  row.item[field.key] ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-slate-600 shadow-sm'
                }`}
              >
                {row.item[field.key] ? '已完成' : '待完成'} · {field.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <div className="mb-2 text-sm font-semibold text-ink">我的备注</div>
          <textarea
            rows={4}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="例如：导师已回信、材料待老师签字、周五前完成提交。"
            className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
          />
        </label>

        <button
          onClick={saveNote}
          disabled={saving}
          aria-busy={saving}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
        >
          {saving ? <PendingIndicator /> : <Save className="h-4 w-4" />}
          保存到全部申请
        </button>
      </div>
    </section>
  );
}
