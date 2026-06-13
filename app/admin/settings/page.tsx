'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BrainCircuit,
  ClipboardList,
  Flag,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  RotateCw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound
} from 'lucide-react';
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
  description: string;
  risk: string;
  type: 'boolean' | 'number';
  defaultValue: AdminSettingValue;
  confirmWhenDisabled?: string;
};

const settingDefinitions: SettingDefinition[] = [
  {
    key: 'content_review_enabled',
    title: '内容审核',
    description: '开启后，用户发布的通知和社区内容需要经过后台审核后再进入公开区域。',
    risk: '关闭后，用户内容可能绕过人工审核直接进入业务流程。',
    type: 'boolean',
    defaultValue: true,
    confirmWhenDisabled: '确认关闭内容审核吗？这会降低公开内容的安全边界。'
  },
  {
    key: 'offer_submit_enabled',
    title: 'Offer 提交通道',
    description: '控制用户是否可以提交 Offer 动态，适合在社区审核规则未完善时临时关闭。',
    risk: '关闭后，前台用户将无法继续提交 Offer 动态。',
    type: 'boolean',
    defaultValue: true,
    confirmWhenDisabled: '确认关闭 Offer 提交通道吗？用户将无法继续发布 Offer 动态。'
  },
  {
    key: 'report_alert_enabled',
    title: '举报提醒',
    description: '开启后，新的举报和纠错会进入后台提醒队列，便于运营及时处理。',
    risk: '关闭后，举报仍会入库，但后台提醒链路会变弱。',
    type: 'boolean',
    defaultValue: true,
    confirmWhenDisabled: '确认关闭举报提醒吗？这可能延迟风险内容处理。'
  },
  {
    key: 'operation_log_retention_days',
    title: '操作日志保留天数',
    description: '后台关键操作日志的保留周期，用于审计、追责和异常排查。',
    risk: '建议至少保留 180 天；过短会削弱后续审计能力。',
    type: 'number',
    defaultValue: 180
  }
];

const defaultSettings = Object.fromEntries(
  settingDefinitions.map((item) => [item.key, item.defaultValue])
) as Record<AdminSettingKey, AdminSettingValue>;

const adminChannels = [
  { href: '/admin/dashboard', label: '数据概览', hint: '指标、趋势与运营总览', icon: LayoutDashboard },
  { href: '/admin/notices', label: '通知管理', hint: '通知审核、发布与下架', icon: Bell },
  { href: '/admin/offers', label: 'Offer 池管理', hint: 'Offer 审核与风险处理', icon: ClipboardList },
  { href: '/admin/ai-leads', label: 'AI 内测管理', hint: '内测登记、需求方向与用户补充说明', icon: BrainCircuit },
  { href: '/admin/users', label: '用户管理', hint: '账号状态、限制与备注', icon: UsersRound },
  { href: '/admin/feedback', label: '反馈举报', hint: '反馈闭环与举报处置', icon: Flag },
  { href: '/admin/logs', label: '操作日志', hint: '审计、导出与追踪', icon: ShieldCheck },
  { href: '/admin/settings', label: '系统设置', hint: '权限、安全与开关', icon: Settings }
];

const roleRows = [
  ['超级管理员', '全部后台通道', '设置、封禁、删除、导出', '仅限核心负责人'],
  ['运营管理员', '内容、用户、反馈、日志', '限制用户、处理举报', '适合日常运营'],
  ['内容审核员', '通知与 Offer 审核', '下架内容', '适合内容质检'],
  ['只读管理员', '数据概览与日志', '无写操作', '适合观察和审计']
];

function formatUpdatedAt(value: string) {
  if (!value) {
    return '尚未更新';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function normalizeSettingRows(rows: AdminSettingRow[]) {
  const nextSettings = { ...defaultSettings };
  const nextMeta: Record<string, Pick<AdminSettingRow, 'description' | 'updated_by' | 'updated_at'>> = {};

  for (const row of rows) {
    if (row.key in nextSettings) {
      nextSettings[row.key] = row.value;
      nextMeta[row.key] = {
        description: row.description,
        updated_by: row.updated_by,
        updated_at: row.updated_at
      };
    }
  }

  return { nextSettings, nextMeta };
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<AdminSettingKey, AdminSettingValue>>(defaultSettings);
  const [settingMeta, setSettingMeta] = useState<Record<string, Pick<AdminSettingRow, 'description' | 'updated_by' | 'updated_at'>>>({});
  const [retentionDraft, setRetentionDraft] = useState(String(defaultSettings.operation_log_retention_days));
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<AdminSettingKey | null>(null);
  const [message, setMessage] = useState('正在读取后台设置...');
  const [lastCheckedAt, setLastCheckedAt] = useState('');

  const disabledWarnings = useMemo(
    () =>
      settingDefinitions.filter((item) => item.type === 'boolean' && settings[item.key] === false),
    [settings]
  );

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const response = await invokeAdminApi<{ settings: AdminSettingRow[] }>({
        resource: 'settings',
        action: 'list'
      });
      const { nextSettings, nextMeta } = normalizeSettingRows(response.settings || []);
      setSettings(nextSettings);
      setSettingMeta(nextMeta);
      setRetentionDraft(String(nextSettings.operation_log_retention_days));
      setLastCheckedAt(new Date().toLocaleString('zh-CN'));
      setMessage('系统设置已更新，当前页面展示最新配置。');
    } catch (error) {
      setMessage(getAdminErrorMessage(error, '系统设置读取失败，请稍后重试。'));
    } finally {
      setLoading(false);
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
      setSettingMeta((current) => ({
        ...current,
        [key]: {
          description: row.description,
          updated_by: row.updated_by,
          updated_at: row.updated_at
        }
      }));
      if (key === 'operation_log_retention_days') {
        setRetentionDraft(String(row.value));
      }
      setMessage(`${definition.title} 已更新，并写入后台操作日志。`);
    } catch (error) {
      setMessage(getAdminErrorMessage(error, `${definition.title} 更新失败。`));
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <AdminShell title="系统设置" description="管理后台通道、安全策略、审核开关和运营基础配置。">
      <div className="space-y-8">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <AdminPanel>
            <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  <LockKeyhole className="h-4 w-4" />
                  运营安全中心
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">后台设置中心</h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
                  集中管理内容审核、Offer 提交、举报提醒和操作记录保留周期。所有调整都会校验管理员权限，并保留变更记录。
                </p>
              </div>
              <AdminButton tone="secondary" onClick={loadSettings} disabled={loading}>
                {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <RotateCw className="mr-2 h-4 w-4" />}
                刷新设置
              </AdminButton>
            </div>
          </AdminPanel>

          <AdminPanel title="保护状态">
            <div className="space-y-4 p-5 text-sm">
              <HealthRow label="登录校验" value="已开启" good />
              <HealthRow label="设置变更" value="核心管理员" good />
              <HealthRow label="访问边界" value="已启用" good />
              <HealthRow label="最近检查" value={lastCheckedAt || '等待刷新'} good={Boolean(lastCheckedAt)} />
            </div>
          </AdminPanel>
        </section>

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
                <p className="mt-1 leading-6">
                  {disabledWarnings.map((item) => item.title).join('、')} 已关闭。请确认这是临时运营策略，而不是误操作。
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <AdminPanel title="基础配置">
            <div className="divide-y divide-slate-100">
              {settingDefinitions.map((definition) => (
                <SettingControl
                  key={definition.key}
                  definition={definition}
                  value={settings[definition.key]}
                  meta={settingMeta[definition.key]}
                  saving={savingKey === definition.key}
                  retentionDraft={retentionDraft}
                  onRetentionDraftChange={setRetentionDraft}
                  onUpdate={updateSetting}
                />
              ))}
            </div>
          </AdminPanel>

          <AdminPanel title="治理策略说明">
            <div className="space-y-4 p-5 text-sm text-slate-600">
              <PolicyItem title="按角色开放操作" description="不同管理员只看到并使用与岗位匹配的操作入口，降低误操作风险。" />
              <PolicyItem title="关键设置受保护" description="只允许修改经过确认的配置项，避免运营策略被随意改动。" />
              <PolicyItem title="关键操作有留痕" description="配置更新、封禁、删除、下架等动作都会保留记录，方便后续复盘。" />
            </div>
          </AdminPanel>
        </section>

        <AdminPanel title="后台通道巡检">
          <div className="grid gap-4 p-5 md:grid-cols-2 2xl:grid-cols-4">
            {adminChannels.map((channel) => {
              const Icon = channel.icon;

              return (
                <Link
                  key={channel.href}
                  href={channel.href}
                  className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-blue-100 group-hover:text-blue-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                      可进入
                    </span>
                  </div>
                  <div className="mt-4 text-base font-semibold text-slate-950">{channel.label}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{channel.hint}</p>
                  <div className="mt-4 text-sm font-semibold text-blue-700">进入通道 →</div>
                </Link>
              );
            })}
          </div>
        </AdminPanel>

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
  meta,
  saving,
  retentionDraft,
  onRetentionDraftChange,
  onUpdate
}: {
  definition: SettingDefinition;
  value: AdminSettingValue;
  meta?: Pick<AdminSettingRow, 'description' | 'updated_by' | 'updated_at'>;
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
        <p className="mt-2 text-sm leading-6 text-slate-500">{definition.description}</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">{definition.risk}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
          <span>更新人：{meta?.updated_by || 'system'}</span>
          <span>更新时间：{formatUpdatedAt(meta?.updated_at || '')}</span>
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

function HealthRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className={adminClassNames('font-semibold', good ? 'text-emerald-700' : 'text-amber-700')}>{value}</span>
    </div>
  );
}

function PolicyItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 font-semibold text-slate-950">
        <SlidersHorizontal className="h-4 w-4 text-blue-600" />
        {title}
      </div>
      <p className="mt-2 leading-6 text-slate-500">{description}</p>
    </div>
  );
}
