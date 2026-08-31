import * as React from 'react';
import type { DeadlineLevel } from '@/lib/mock-data';
import { getDeadlineBadgeMeta } from '@/lib/deadline-display';

type BadgeTone =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'muted';

type BadgeSize = 'sm' | 'md';

export interface StatusBadgeProps {
  status?: string | null;
  label?: string;
  children?: React.ReactNode;
  className?: string;
  tone?: BadgeTone;
  variant?: BadgeTone;
  size?: BadgeSize;
}

function joinClasses(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(' ');
}

function normalizeTone(input?: string | null): BadgeTone {
  if (!input) return 'default';

  const value = input.toLowerCase().trim();

  if (
    ['success', 'active', 'open', 'published', 'done', 'completed', 'available'].includes(value)
  ) {
    return 'success';
  }

  if (
    ['warning', 'pending', 'soon', 'reviewing', 'draft'].includes(value)
  ) {
    return 'warning';
  }

  if (
    ['danger', 'error', 'failed', 'closed', 'expired', 'rejected'].includes(value)
  ) {
    return 'danger';
  }

  if (
    ['info', 'new', 'notice'].includes(value)
  ) {
    return 'info';
  }

  if (
    ['muted', 'unknown', 'inactive'].includes(value)
  ) {
    return 'muted';
  }

  return 'default';
}

const toneClassMap: Record<BadgeTone, string> = {
  default: 'bg-slate-100 text-slate-700 border border-slate-200',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border border-rose-200',
  info: 'bg-sky-50 text-sky-700 border border-sky-200',
  muted: 'bg-zinc-100 text-zinc-600 border border-zinc-200',
};

const sizeClassMap: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export function StatusBadge({
  status,
  label,
  children,
  className,
  tone,
  variant,
  size = 'sm',
}: StatusBadgeProps) {
  const finalTone = tone ?? variant ?? normalizeTone(status);
  const content = children ?? label ?? status ?? '未知状态';

  return (
    <span
      data-status-tone={finalTone}
      className={joinClasses(
        'desktop-status-badge inline-flex items-center rounded-full font-medium whitespace-nowrap',
        `desktop-status-badge--${finalTone}`,
        sizeClassMap[size],
        toneClassMap[finalTone],
        className
      )}
    >
      {content}
    </span>
  );
}

export function DeadlineBadge({
  level,
  className,
  size = 'sm',
}: {
  level?: DeadlineLevel | null;
  className?: string;
  size?: BadgeSize;
}) {
  const meta = getDeadlineBadgeMeta(level);

  return (
    <StatusBadge
      label={meta.label}
      tone={meta.tone}
      size={size}
      className={className}
    />
  );
}

export default StatusBadge;
