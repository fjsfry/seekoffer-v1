import type { ReactNode } from 'react';
import styles from './desktop-loading.module.css';

export type DesktopLoadingVariant =
  | 'applications'
  | 'notices'
  | 'schedule'
  | 'contacts'
  | 'resources'
  | 'help'
  | 'settings'
  | 'detail';

/** Decorative only: the containing control or region owns its accessible status. */
export function DesktopLoadingIndicator({
  size = 'medium',
  className,
  delayed = false,
  still = false
}: {
  size?: 'small' | 'medium' | 'large';
  className?: string;
  delayed?: boolean;
  still?: boolean;
}) {
  return (
    <span
      className={[styles.indicator, styles[size], delayed ? styles.delayed : '', still ? styles.still : '', className || ''].filter(Boolean).join(' ')}
      data-loading-indicator="ring"
      aria-hidden="true"
    >
      <span className={styles.rotor}>
        <svg viewBox="0 0 24 24" fill="none" focusable="false" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.16" />
          <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
    </span>
  );
}

function PlaceholderLines() {
  return <span className={styles.lines}><i className={styles.lineTitle} /><i className={styles.lineBody} /><i className={styles.lineMeta} /></span>;
}

function PlaceholderRow() {
  return (
    <div className={styles.row}>
      <i className={styles.avatar} />
      <PlaceholderLines />
      <span className={styles.fields}><i /><i /><i /></span>
      <span className={styles.end}><i /><i /></span>
    </div>
  );
}

/** Layout placeholder for an initial read, never a replacement for usable cached content. */
export function DesktopLoadingState({
  title,
  detail,
  variant = 'applications',
  rows = 3,
  compact = false,
  showHeading = true,
  className,
  action
}: {
  title: string;
  detail?: string;
  variant?: DesktopLoadingVariant;
  rows?: number;
  compact?: boolean;
  showHeading?: boolean;
  className?: string;
  action?: ReactNode;
}) {
  const count = Number.isFinite(rows) ? Math.min(8, Math.max(1, Math.trunc(rows))) : 3;
  return (
    <section
      className={[styles.surface, styles[variant], compact ? styles.compact : '', className || ''].filter(Boolean).join(' ')}
      data-desktop-loading={variant}
      role={showHeading ? 'status' : undefined}
      aria-live={showHeading ? 'polite' : undefined}
      aria-busy={showHeading ? true : undefined}
      aria-hidden={!showHeading || undefined}
    >
      {showHeading ? (
        <div className={styles.heading}>
          <DesktopLoadingIndicator delayed />
          <span className={styles.copy}><strong>{title}</strong>{detail ? <span>{detail}</span> : null}</span>
          {action ? <span className={styles.action}>{action}</span> : null}
        </div>
      ) : null}
      <div className={styles.rows} aria-hidden="true">
        {Array.from({ length: count }, (_, index) => <PlaceholderRow key={index} />)}
      </div>
    </section>
  );
}
