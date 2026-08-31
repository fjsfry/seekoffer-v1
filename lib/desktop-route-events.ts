export const DESKTOP_ROUTE_CHANGE_EVENT = 'seekoffer:desktop-route-change';
export const DESKTOP_SYNC_STATUS_EVENT = 'seekoffer:desktop-sync-status';
export const DESKTOP_FEEDBACK_EVENT = 'seekoffer:desktop-feedback';
export const DESKTOP_MODAL_STATE_EVENT = 'seekoffer:desktop-modal-state';
export const DESKTOP_NEW_APPLICATION_EVENT = 'seekoffer:desktop-new-application';
export const DESKTOP_APPLICATION_SYNC_EVENT = 'seekoffer:desktop-application-sync';
export const DESKTOP_NEW_SCHEDULE_EVENT = 'seekoffer:desktop-new-schedule';
export const DESKTOP_NEW_CONTACT_EVENT = 'seekoffer:desktop-new-contact';

const DESKTOP_NEW_APPLICATION_REQUEST_KEY = 'seekoffer:desktop-new-application:pending:v1';
const DESKTOP_APPLICATION_SYNC_REQUEST_KEY = 'seekoffer:desktop-application-sync:pending:v1';

export type DesktopSyncStatus = 'idle' | 'local' | 'syncing' | 'synced' | 'error';

export type DesktopFeedbackTone = 'neutral' | 'success' | 'warning' | 'error';
export type DesktopFeedbackState = 'pending' | 'success' | 'error' | 'undo';

export type DesktopFeedback = {
  message: string;
  detail?: string;
  tone?: DesktopFeedbackTone;
  state?: DesktopFeedbackState;
  group?: string;
  duration?: number;
  actionLabel?: string;
  actionAnnouncement?: string;
  onAction?: () => void | Promise<void>;
};

export function resolveDesktopFeedbackState(feedback: DesktopFeedback): DesktopFeedbackState {
  if (feedback.state) return feedback.state;
  if (feedback.actionLabel === '撤销' && feedback.onAction) return 'undo';
  if (feedback.tone === 'success') return 'success';
  if (feedback.tone === 'error') return 'error';
  return 'pending';
}

export function getDesktopFeedbackGroup(feedback: DesktopFeedback) {
  return feedback.group?.trim() || resolveDesktopFeedbackState(feedback);
}

export type DesktopModalState = {
  source: string;
  open: boolean;
};

export function emitDesktopRouteChange(href: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DESKTOP_ROUTE_CHANGE_EVENT, { detail: href }));
  }
}

export function emitDesktopSyncStatus(status: DesktopSyncStatus) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DESKTOP_SYNC_STATUS_EVENT, { detail: status }));
  }
}

export function emitDesktopFeedback(feedback: DesktopFeedback) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DESKTOP_FEEDBACK_EVENT, { detail: feedback }));
  }
}

export function emitDesktopModalState(source: string, open: boolean) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<DesktopModalState>(DESKTOP_MODAL_STATE_EVENT, {
        detail: { source, open }
      })
    );
  }
}

export function requestDesktopNewApplication() {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(DESKTOP_NEW_APPLICATION_REQUEST_KEY, '1');
  } catch {
    // The event still opens the dialog when storage is unavailable. Session
    // storage only bridges the short gap while another route is unmounting.
  }
  window.dispatchEvent(new Event(DESKTOP_NEW_APPLICATION_EVENT));
}

export function requestDesktopNewSchedule() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(DESKTOP_NEW_SCHEDULE_EVENT));
  }
}

export function requestDesktopNewContact() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(DESKTOP_NEW_CONTACT_EVENT));
  }
}

export function consumeDesktopNewApplicationRequest() {
  if (typeof window === 'undefined') return false;

  try {
    const pending = window.sessionStorage.getItem(DESKTOP_NEW_APPLICATION_REQUEST_KEY) === '1';
    if (pending) window.sessionStorage.removeItem(DESKTOP_NEW_APPLICATION_REQUEST_KEY);
    return pending;
  } catch {
    return false;
  }
}

export function requestDesktopApplicationSync() {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(DESKTOP_APPLICATION_SYNC_REQUEST_KEY, '1');
  } catch {
    // The live event still reaches an already mounted workbench. Session
    // storage only bridges the route transition while Settings is closing.
  }
  window.dispatchEvent(new Event(DESKTOP_APPLICATION_SYNC_EVENT));
}

export function consumeDesktopApplicationSyncRequest() {
  if (typeof window === 'undefined') return false;

  try {
    const pending = window.sessionStorage.getItem(DESKTOP_APPLICATION_SYNC_REQUEST_KEY) === '1';
    if (pending) window.sessionStorage.removeItem(DESKTOP_APPLICATION_SYNC_REQUEST_KEY);
    return pending;
  } catch {
    return false;
  }
}
