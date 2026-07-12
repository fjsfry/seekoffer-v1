'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { AdminActionBanner, AdminButton, AdminPanel, adminClassNames } from '@/components/admin-ui';
import { AdminShell } from '@/components/admin-shell';
import { getAdminErrorMessage, invokeAdminApi } from '@/lib/admin-api';

type AdminSettingKey =
  | 'content_review_enabled'
  | 'offer_submit_enabled'
  | 'report_alert_enabled'
  | 'operation_log_retention_days';

type AdminSettingValue = boolean | number;

type AdminSettingRow = {
  key: AdminSettingKey;
  value: AdminSettingValue;
  description: string;
  updated_by: string;
  updated_at: string;
};

type SettingDefinition = {
  key: AdminSettingKey;
  title: string;
  type: 'boolean' | 'number';
  defaultValue: AdminSettingValue;
  confirmWhenDisabled?: string;
};

const settingDefinitions: SettingDefinition[] = [
  {
    key: 'content_review_enabled',
    title: '内容审核',
    type: 'boolean',
    defaultValue: true,
    confirmWhenDisabled: '确认关闭内容审核吗？这会降低公开内容的安全边界。'
  },
  {
    key: 'offer_submit_enabled',
    title: 'Offer 提交通道',
    type: 'boolean',
    defaultValue: true,
    confirmWhenDisabled: '确认关闭 Offer 提交通道吗？用户将无法继续发布 Offer 动态。'
  },
  {
    key: 'report_alert_enabled',
    title: '举报提醒',
    type: 'boolean',
    defaultValue: true,
    confirmWhenDisabled: '确认关闭举报提醒吗？这可能延迟风险内容处理。'
  },
  {
    key: 'operation_log_retention_days',
    title: '操作日志保留天数',
    type: 'number',
    defaultValue: 180
  }
];

const defaultSettings = Object.fromEntries(
  settingDefinitions.map((item) => [item.key, item.defaultValue])
) as Record<AdminSettingKey, AdminSettingValue>;

const roleRows = [
  ['超级管理员', '全部后台通道', '设置、封禁、删除、导出', '仅限核心负责人'],
  ['运营管理员', '内容、用户、反馈、日志', '限制用户、处理举报', '适合日常运营'],
  ['内容审核员', '通知与 Offer 审核', '下架内容', '适合内容质检'],
  ['只读管理员', '数据概览与日志', '无写操作', '适合观察和审计']
];

function normalizeSettingRows(rows: AdminSettingRow[]) {
  const nextSettings = { ...defaultSettings };

  for (const row of rows) {
    if (row.key in nextSettings) {
      nextSettings[row.key] = row.value;
    }
  }

  return nextSettings;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<AdminSettingKey, AdminSettingValue>>(defaultSettings);
  const [retentionDraft, setRetentionDraft] = useState(String(defaultSettings.operation_log_retention_days));
  const [savingKey, setSavingKey] = useState<AdminSettingKey | null>(null);
  const [message, setMessage] = useState('');

  const disabledWarnings = useMemo(
    () =>
      settingDefinitions.filter((item) => item.type === 'boolean' && settings[item.key] === false),
    [settings]
  );

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const response = await invokeAdminApi<{ settings: AdminSettingRow[] }>({
        resource: 'settings',
        action: 'list'
      });
      const nextSettings = normalizeSettingRows(response.settings || []);
      setSettings(nextSettings);
      setRetentionDraft(String(nextSettings.operation_log_retention_days));
      setMessage('');
    } catch (error) {
      setMessage(getAdminErrorMessage(error, '系统设置读取失败，请稍后重试。'));
    }
  }

  async function updateSetting(key: AdminSettingKey, value: AdminSettingValue) {
    const definition = settingDefinitions.find((item) => item.key === key);
    if (!definition) {
      return;
    }

    if (definition.type === 'boolean' && value === false && definition.confirmWhenDisabled && !window.confirm(definition.confirmWhenDisabled)) {
      return;
    }

    if (key === 'operation_log_retention_days') {
      const days = Number(value);
      if (!Number.isInteger(days) || days < 7 || days > 3650) {
        setMessage('操作日志保留天数必须是 7 到 3650 之间的整数。');
        return;
      }
    }

    setSavingKey(key);
    try {
      const response = await invokeAdminApi<{ setting: AdminSettingRow }>({
        resource: 'settings',
        action: 'update',
        key,
        value
      });
      const row = response.setting;
      setSettings((current) => ({ ...current, [key]: row.value }));
      if (key === 'operation_log_retention_days') {
        setRetentionDraft(String(row.value));
      }
      setMessage(`${definition.title} 已更新。`);
    } catch (error) {
      setMessage(getAdminErrorMessage(error, `${definition.title} 更新失败。`));
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <AdminShell title="系统设置" description="管理审核开关、风险提醒和日志策略。">
      <div className="space-y-6">

        {message ? (
          <AdminActionBanner tone={message.includes('失败') || message.includes('不可用') ? 'danger' : 'info'}>
            {message}
          </AdminActionBanner>
        ) : null}

        {disabledWarnings.length ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <div className="font-semibold">当前有关键保护通道处于关闭状态</div>
              </div>
            </div>
          </section>
        ) : null}

        <section>
          <AdminPanel title="基础配置">
            <div className="divide-y divide-slate-100">
              {settingDefinitions.map((definition) => (
                <SettingControl
                  key={definition.key}
                  definition={definition}
                  value={settings[definition.key]}
                  saving={savingKey === definition.key}
                  retentionDraft={retentionDraft}
                  onRetentionDraftChange={setRetentionDraft}
                  onUpdate={updateSetting}
                />
              ))}
            </div>
          </AdminPanel>

        </section>

        <AdminPanel title="角色权限矩阵">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-5 py-3">角色</th>
                  <th className="px-5 py-3">可进入通道</th>
                  <th className="px-5 py-3">高风险权限</th>
                  <th className="px-5 py-3">使用建议</th>
                </tr>
              </thead>
              <tbody>
                {roleRows.map((row) => (
                  <tr key={row[0]} className="border-t border-slate-100">
                    {row.map((cell) => (
                      <td key={cell} className="px-5 py-4 text-slate-700">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminPanel>
      </div>
    </AdminShell>
  );
}

function SettingControl({
  definition,
  value,
  saving,
  retentionDraft,
  onRetentionDraftChange,
  onUpdate
}: {
  definition: SettingDefinition;
  value: AdminSettingValue;
  saving: boolean;
  retentionDraft: string;
  onRetentionDraftChange: (value: string) => void;
  onUpdate: (key: AdminSettingKey, value: AdminSettingValue) => void;
}) {
  const enabled = Boolean(value);

  return (
    <div className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-semibold text-slate-950">{definition.title}</h3>
          {definition.type === 'boolean' ? (
            <span
              className={adminClassNames(
                'rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
                enabled ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-amber-50 text-amber-700 ring-amber-100'
              )}
            >
              {enabled ? '已开启' : '已关闭'}
            </span>
          ) : null}
        </div>
      </div>

      {definition.type === 'boolean' ? (
        <button
          type="button"
          aria-pressed={enabled}
          disabled={saving}
          onClick={() => onUpdate(definition.key, !enabled)}
          className={adminClassNames(
            'flex h-12 items-center justify-between rounded-full px-2 pl-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
            enabled ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
          )}
        >
          <span>{saving ? '保存中...' : enabled ? '点击关闭' : '点击开启'}</span>
          <span className={adminClassNames('relative h-7 w-12 rounded-full transition', enabled ? 'bg-white/25' : 'bg-slate-300')}>
            <span
              className={adminClassNames(
                'absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition',
                enabled ? 'right-1' : 'left-1'
              )}
            />
          </span>
        </button>
      ) : (
        <div className="flex gap-2">
          <input
            type="number"
            min={7}
            max={3650}
            value={retentionDraft}
            onChange={(event) => onRetentionDraftChange(event.target.value)}
            className="h-12 min-w-0 flex-1 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          />
          <AdminButton
            disabled={saving}
            onClick={() => onUpdate(definition.key, Number(retentionDraft))}
            className="shrink-0"
          >
            保存
          </AdminButton>
        </div>
      )}
    </div>
  );
}
