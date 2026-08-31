import type { ReactNode } from 'react';
import styles from './desktop-state-surface.module.css';

export type DesktopStateSurfaceVariant = 'section' | 'full' | 'inline';
export type DesktopStateSurfaceTone = 'neutral' | 'stale' | 'error' | 'success';

export function DesktopStateSurface({
  icon,
  title,
  detail,
  action,
  variant = 'section',
  tone = 'neutral',
  loading = false,
  role,
  ariaLive,
  ariaBusy,
  className
}: {
  icon: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
  variant?: DesktopStateSurfaceVariant;
  tone?: DesktopStateSurfaceTone;
  loading?: boolean;
  role?: 'status' | 'alert';
  ariaLive?: 'off' | 'polite' | 'assertive';
  ariaBusy?: boolean;
  className?: string;
}) {
  const resolvedRole = role ?? (tone === 'error' ? 'alert' : 'status');
  const resolvedAriaLive = ariaLive ?? (tone === 'error' ? 'assertive' : 'polite');
  const classes = [
    styles.surface,
    styles[variant],
    styles[tone],
    loading ? styles.loading : '',
    className || ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      className={classes}
      role={resolvedRole}
      aria-live={resolvedAriaLive}
      aria-atomic="true"
      aria-busy={ariaBusy ?? loading}
      data-desktop-state-variant={variant}
      data-desktop-state-tone={tone}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.copy}>
        <strong className={styles.title}>{title}</strong>
        {detail ? <span className={styles.detail}>{detail}</span> : null}
      </span>
      {action ? <span className={styles.action}>{action}</span> : null}
    </section>
  );
}
