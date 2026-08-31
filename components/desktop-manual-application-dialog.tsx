'use client';

import { CalendarClock, Link2, Plus, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  createManualApplicationEntry,
  type ManualProjectInput
} from '@/lib/cloudbase-data';
import { validateManualApplicationInput } from '@/lib/desktop-manual-application';
import { trackDesktopPendingWrite } from '@/lib/desktop-pending-writes';
import { emitDesktopModalState } from '@/lib/desktop-route-events';
import { useAccessibleModal } from '@/hooks/use-accessible-modal';

const projectTypeOptions: ManualProjectInput['projectType'][] = [
  '夏令营',
  '预推免',
  '正式推免',
  '九推',
  '推免',
  '宣讲会',
  '入营名单'
];

const initialForm: ManualProjectInput = {
  schoolName: '',
  departmentName: '',
  projectName: '',
  projectType: '夏令营',
  discipline: '',
  deadlineDate: '',
  eventStartDate: '',
  eventEndDate: '',
  applyLink: ''
};

export type ManualApplicationCreationResult = Awaited<
  ReturnType<typeof createManualApplicationEntry>
>;

type DesktopManualApplicationDialogProps = {
  userId: string;
  onCancel: () => void;
  onCreated: (result: ManualApplicationCreationResult) => void | Promise<void>;
};

export function DesktopManualApplicationDialog({
  userId,
  onCancel,
  onCreated
}: DesktopManualApplicationDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const [form, setForm] = useState<ManualProjectInput>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<keyof ManualProjectInput | null>(null);
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  function requestClose(force = false) {
    if ((!force && submitting) || closeTimerRef.current !== null) return;
    const reduceMotion =
      document.documentElement.dataset.desktopReduceMotion === 'true' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setVisible(false);
    if (reduceMotion) {
      onCancel();
      return;
    }
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      onCancel();
    }, 120);
  }

  const { dialogRef, overlayRef, handleModalKeyDown } = useAccessibleModal(requestClose);

  useEffect(() => {
    emitDesktopModalState('manual-application', true);
    const frame = window.requestAnimationFrame(() => setVisible(true));
    return () => {
      window.cancelAnimationFrame(frame);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      emitDesktopModalState('manual-application', false);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog || dialog.contains(document.activeElement)) return;
      dialog
        .querySelector<HTMLElement>('[data-modal-initial-focus]')
        ?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [dialogRef, visible]);

  function updateField<K extends keyof ManualProjectInput>(
    key: K,
    value: ManualProjectInput[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    if (fieldError === key) {
      setFieldError(null);
      setMessage('');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const validation = validateManualApplicationInput(form);
    if (!validation.ok) {
      setFieldError(validation.field);
      setMessage(validation.message);
      window.requestAnimationFrame(() => {
        dialogRef.current
          ?.querySelector<HTMLElement>(`[name="${validation.field}"]`)
          ?.focus({ preventScroll: false });
      });
      return;
    }

    setSubmitting(true);
    setFieldError(null);
    setMessage('');

    try {
      const result = await trackDesktopPendingWrite('manual-application-create', () =>
        createManualApplicationEntry(validation.value, userId)
      );
      await onCreated(result);
      setSubmitting(false);
      requestClose(true);
      return;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '申请保存失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="desktop-manual-application-backdrop"
      data-state={visible ? 'open' : 'closed'}
      aria-hidden={visible ? undefined : true}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      onKeyDown={handleModalKeyDown}
    >
      <div
        ref={dialogRef}
        className="desktop-manual-application-dialog"
        data-state={visible ? 'open' : 'closed'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={`${descriptionId}${message ? ` ${errorId}` : ''}`}
        aria-busy={submitting}
        tabIndex={-1}
      >
        <header className="desktop-manual-application-header">
          <span className="desktop-manual-application-icon" aria-hidden="true">
            <Plus size={20} />
          </span>
          <div>
            <h2 id={titleId}>手动添加申请</h2>
            <p id={descriptionId}>通知库未收录时，也可以先建立项目并纳入进度、材料和截止提醒。</p>
          </div>
          <button
            type="button"
            className="desktop-manual-application-close"
            aria-label="关闭手动添加申请窗口"
            disabled={submitting}
            onClick={() => requestClose()}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <form className="desktop-manual-application-form" onSubmit={handleSubmit} noValidate>
          <section aria-labelledby={`${titleId}-basic`}>
            <h3 id={`${titleId}-basic`}>基本信息</h3>
            <div className="desktop-manual-application-grid">
              <DialogField label="学校名称" required error={fieldError === 'schoolName' ? message : ''}>
                <input
                  data-modal-initial-focus
                  name="schoolName"
                  autoComplete="organization"
                  value={form.schoolName}
                  onChange={(event) => updateField('schoolName', event.target.value)}
                  placeholder="例如：清华大学"
                  aria-invalid={fieldError === 'schoolName'}
                />
              </DialogField>
              <DialogField label="学院 / 系 / 实验室">
                <input
                  name="departmentName"
                  value={form.departmentName}
                  onChange={(event) => updateField('departmentName', event.target.value)}
                  placeholder="例如：计算机科学与技术系"
                />
              </DialogField>
              <DialogField label="项目名称" required error={fieldError === 'projectName' ? message : ''}>
                <input
                  name="projectName"
                  value={form.projectName}
                  onChange={(event) => updateField('projectName', event.target.value)}
                  placeholder="例如：2027 年预推免招生"
                  aria-invalid={fieldError === 'projectName'}
                />
              </DialogField>
              <DialogField label="项目类型">
                <select
                  name="projectType"
                  value={form.projectType}
                  onChange={(event) =>
                    updateField('projectType', event.target.value as ManualProjectInput['projectType'])
                  }
                >
                  {projectTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </DialogField>
              <DialogField label="学科方向" wide>
                <input
                  name="discipline"
                  value={form.discipline}
                  onChange={(event) => updateField('discipline', event.target.value)}
                  placeholder="选填，例如：人工智能 / 计算机视觉"
                />
              </DialogField>
            </div>
          </section>

          <section aria-labelledby={`${titleId}-schedule`}>
            <h3 id={`${titleId}-schedule`}>
              <CalendarClock size={16} aria-hidden="true" />
              关键时间
            </h3>
            <div className="desktop-manual-application-grid">
              <DialogField
                label="申请截止时间"
                required
                error={fieldError === 'deadlineDate' ? message : ''}
              >
                <input
                  type="datetime-local"
                  name="deadlineDate"
                  value={form.deadlineDate}
                  onChange={(event) => updateField('deadlineDate', event.target.value)}
                  aria-invalid={fieldError === 'deadlineDate'}
                />
              </DialogField>
              <DialogField label="报名或通知链接" error={fieldError === 'applyLink' ? message : ''}>
                <span className="desktop-manual-application-input-with-icon">
                  <Link2 size={16} aria-hidden="true" />
                  <input
                    type="url"
                    inputMode="url"
                    name="applyLink"
                    value={form.applyLink}
                    onChange={(event) => updateField('applyLink', event.target.value)}
                    placeholder="https://…"
                    aria-invalid={fieldError === 'applyLink'}
                  />
                </span>
              </DialogField>
              <DialogField
                label="活动开始时间"
                error={fieldError === 'eventStartDate' ? message : ''}
              >
                <input
                  type="datetime-local"
                  name="eventStartDate"
                  value={form.eventStartDate}
                  onChange={(event) => updateField('eventStartDate', event.target.value)}
                  aria-invalid={fieldError === 'eventStartDate'}
                />
              </DialogField>
              <DialogField
                label="活动结束时间"
                error={fieldError === 'eventEndDate' ? message : ''}
              >
                <input
                  type="datetime-local"
                  name="eventEndDate"
                  value={form.eventEndDate}
                  onChange={(event) => updateField('eventEndDate', event.target.value)}
                  aria-invalid={fieldError === 'eventEndDate'}
                />
              </DialogField>
            </div>
          </section>

          <div className="desktop-manual-application-feedback" aria-live="polite">
            {message ? (
              <p id={errorId} role="alert">
                {message}
              </p>
            ) : (
              <p>添加后会自动出现在“全部申请”，你可以继续补充材料和申请状态。</p>
            )}
          </div>

          <footer className="desktop-manual-application-actions">
            <button type="button" className="desktop-button-secondary" disabled={submitting} onClick={() => requestClose()}>
              取消
            </button>
            <button type="submit" className="desktop-button-primary" disabled={submitting}>
              {submitting ? '正在保存…' : '添加到全部申请'}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body
  );
}

function DialogField({
  label,
  required = false,
  wide = false,
  error,
  children
}: {
  label: string;
  required?: boolean;
  wide?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className={wide ? 'desktop-manual-application-field desktop-manual-application-field--wide' : 'desktop-manual-application-field'}>
      <span>
        {label}
        {required ? <em aria-hidden="true">必填</em> : null}
      </span>
      {children}
      {error ? <small>{error}</small> : null}
    </label>
  );
}
