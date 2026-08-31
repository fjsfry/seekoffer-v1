'use client';

import {
  Add20Regular,
  ArrowLeft20Regular,
  ArrowSort20Regular,
  ArrowSync20Regular,
  Checkmark20Regular,
  CheckmarkCircle20Regular,
  ChevronDown20Regular,
  ChevronRight20Regular,
  Delete20Regular,
  Dismiss20Regular,
  Filter20Regular,
  Image20Regular,
  Info20Regular,
  LockClosed20Regular,
  Mail20Regular,
  Open20Regular,
  People24Regular,
  Person20Regular,
  Search20Regular
} from '@fluentui/react-icons';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject
} from 'react';
import { DesktopConfirmDialog } from '@/components/desktop-confirm-dialog';
import {
  DesktopWorkspaceStatus,
  type DesktopWorkspaceSyncStatus
} from '@/components/desktop-workspace-status';
import type { WorkbenchMentorContact } from '@/lib/workbench-state';
import {
  MentorPhotoClientError,
  loadCachedMentorPhoto,
  resolveMentorPhotoFromHomepage,
  type MentorPhotoResult
} from '@/lib/desktop-mentor-photo';
import { writeSessionStorageValue } from '@/lib/safe-session-storage';
import { DESKTOP_NEW_CONTACT_EVENT } from '@/lib/desktop-route-events';
import styles from './desktop-workspace.module.css';

const isDesktopSurface = process.env.NEXT_PUBLIC_SEEKOFFER_SURFACE === 'desktop';

export type ContactRangeFilter = '全部' | 'C9' | '985' | '211' | '双一流' | '普通高校' | '科研院所' | '其它';
export type ContactFeedbackStatus = '未联系' | '已投递' | '已回复' | '已offer' | '需跟进' | '无回复' | '不合适';
export type ContactDeliveryStatus = '未投递' | '已投递';
export type ContactSortOption = 'updated' | 'school' | 'lastContact';

export type DesktopMentorContact = Omit<WorkbenchMentorContact, 'schoolRange' | 'deliveryStatus' | 'feedbackStatus'> & {
  schoolRange: Exclude<ContactRangeFilter, '全部'>;
  deliveryStatus: ContactDeliveryStatus;
  feedbackStatus: ContactFeedbackStatus;
};

export const CONTACT_RANGE_FILTERS: ContactRangeFilter[] = ['全部', 'C9', '985', '211', '双一流', '普通高校', '科研院所', '其它'];
export const CONTACT_FEEDBACK_FILTERS: ('全部' | ContactFeedbackStatus)[] = ['全部', '未联系', '已投递', '已回复', '已offer', '需跟进', '无回复', '不合适'];
export const CONTACT_DELIVERY_FILTERS: ('全部' | ContactDeliveryStatus)[] = ['全部', '未投递', '已投递'];

type ContactContext = {
  selectedId?: string;
  keyword?: string;
  rangeFilter?: ContactRangeFilter;
  feedbackFilter?: '全部' | ContactFeedbackStatus;
  deliveryFilter?: '全部' | ContactDeliveryStatus;
  sort?: ContactSortOption;
  scrollTop?: number;
};

type MentorPhotoUiState =
  | { phase: 'idle' }
  | { phase: 'loading'; message: string }
  | { phase: 'success'; message: string }
  | { phase: 'error'; message: string; retryable: boolean }
  | { phase: 'candidate'; message: string; candidate: MentorPhotoResult };

type ContactUndoNotice = {
  id: number;
  message: string;
  undo: () => void;
  returnFocus: () => void;
};

function readContext(storageKey: string): ContactContext {
  try {
    const value = window.sessionStorage.getItem(storageKey);
    return value ? JSON.parse(value) as ContactContext : {};
  } catch {
    return {};
  }
}

function isWorkspaceEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function contactTitle(contact: DesktopMentorContact) {
  return contact.mentorName || contact.schoolName || '新导师联系人';
}

function contactSubtitle(contact: DesktopMentorContact) {
  return [contact.schoolName, contact.departmentName, contact.mentorTitle].filter(Boolean).join(' · ') || '补充导师与院校信息';
}

function desktopContactTitle(contact: DesktopMentorContact) {
  return contact.mentorName || contact.schoolName || '未命名导师';
}

function getTodayDateString() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function getDateValue(date?: string) {
  if (!date) return Number.MAX_SAFE_INTEGER;
  const timestamp = Date.parse(`${date}T00:00:00+08:00`);
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function formatFollowUpLabel(date?: string) {
  if (!date) return '未安排跟进';
  const dayDiff = Math.round((getDateValue(date) - getDateValue(getTodayDateString())) / 86_400_000);
  if (dayDiff === 0) return '今天跟进';
  if (dayDiff === 1) return '明天跟进';
  if (dayDiff < 0) return `逾期 ${Math.abs(dayDiff)} 天`;
  const [, month, day] = date.split('-');
  return `${Number(month)}月${Number(day)}日跟进`;
}

function formatLastContactLabel(date?: string, channel?: string) {
  if (!date) return '尚未联系';
  const [, month, day] = date.split('-');
  const dateLabel = `${Number(month)}月${Number(day)}日`;
  return channel ? `${dateLabel} · ${channel}` : dateLabel;
}

function getFollowUpTone(date?: string) {
  if (!date) return 'none';
  const dayDiff = Math.round((getDateValue(date) - getDateValue(getTodayDateString())) / 86_400_000);
  if (dayDiff < 0) return 'overdue';
  if (dayDiff <= 3) return 'soon';
  return 'scheduled';
}

function getContactsLayoutScale() {
  const shell = document.querySelector<HTMLElement>('.desktop-app-shell[data-zoom-level]');
  const zoomLevel = Number(shell?.dataset.zoomLevel || '100');
  return Number.isFinite(zoomLevel) && zoomLevel > 0 ? zoomLevel / 100 : 1;
}

function toggleAnchoredContactPopover(
  trigger: HTMLElement,
  surface: HTMLElement,
  preferredWidth: number,
  estimatedHeight: number
) {
  if (surface.matches(':popover-open')) {
    surface.hidePopover();
    return;
  }
  const scale = getContactsLayoutScale();
  const rect = trigger.getBoundingClientRect();
  const gutter = 12;
  const physicalWidth = Math.min(preferredWidth * scale, window.innerWidth - gutter * 2);
  const physicalHeight = Math.min(estimatedHeight * scale, window.innerHeight - gutter * 2);
  const width = physicalWidth / scale;
  const maxHeight = physicalHeight / scale;
  const physicalLeft = Math.max(
    gutter,
    Math.min(rect.left, window.innerWidth - physicalWidth - gutter)
  );
  const below = rect.bottom + 6;
  const physicalTop = below + physicalHeight <= window.innerHeight - gutter
    ? below
    : Math.max(gutter, rect.top - physicalHeight - 6);
  const left = physicalLeft / scale;
  const top = physicalTop / scale;
  surface.style.setProperty('--contacts-popover-left', `${left}px`);
  surface.style.setProperty('--contacts-popover-top', `${top}px`);
  surface.style.setProperty('--contacts-popover-width', `${width}px`);
  surface.style.setProperty('--contacts-popover-max-height', `${maxHeight}px`);
  surface.showPopover();
}

function closeContactPopover(surface: HTMLElement | null, returnFocus?: HTMLElement | null) {
  if (surface?.matches(':popover-open')) surface.hidePopover();
  window.requestAnimationFrame(() => returnFocus?.focus());
}

function useDismissContactPopoverOnViewportChange(surfaceRef: RefObject<HTMLElement | null>, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const dismiss = (event?: Event) => {
      if (event?.type === 'scroll' && event.target instanceof Node && surfaceRef.current?.contains(event.target)) return;
      if (surfaceRef.current?.matches(':popover-open')) surfaceRef.current.hidePopover();
    };
    document.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      document.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [open, surfaceRef]);
}

export function DesktopContactsWorkspace({
  contacts,
  initialContactId,
  totalCount,
  summary,
  rangeFilter,
  feedbackFilter,
  deliveryFilter,
  keyword,
  sort,
  onRangeFilterChange,
  onFeedbackFilterChange,
  onDeliveryFilterChange,
  onKeywordChange,
  onSortChange,
  onResetFilters,
  onAddContact,
  draftContactId,
  onDiscardContactDraft,
  onContactChange,
  onDeleteContact,
  syncStatus,
  lastSyncedAt,
  onRetrySync,
  contextOwner
}: {
  contacts: DesktopMentorContact[];
  initialContactId: string;
  totalCount: number;
  summary: { total: number; delivered: number; replied: number; followUp: number };
  rangeFilter: ContactRangeFilter;
  feedbackFilter: '全部' | ContactFeedbackStatus;
  deliveryFilter: '全部' | ContactDeliveryStatus;
  keyword: string;
  sort: ContactSortOption;
  onRangeFilterChange: (value: ContactRangeFilter) => void;
  onFeedbackFilterChange: (value: '全部' | ContactFeedbackStatus) => void;
  onDeliveryFilterChange: (value: '全部' | ContactDeliveryStatus) => void;
  onKeywordChange: (value: string) => void;
  onSortChange: (value: ContactSortOption) => void;
  onResetFilters: () => void;
  onAddContact: () => string;
  draftContactId: string;
  onDiscardContactDraft: (id: string) => void;
  onContactChange: <K extends keyof DesktopMentorContact>(id: string, key: K, value: DesktopMentorContact[K]) => void;
  onDeleteContact: (id: string) => void;
  syncStatus: DesktopWorkspaceSyncStatus;
  lastSyncedAt?: string;
  onRetrySync: () => void;
  contextOwner: string;
}) {
  const contextKey = `seekoffer:desktop:contacts-context:v2:${encodeURIComponent(contextOwner)}`;
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollTopRef = useRef(0);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const restoredRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const detailReturnFocusRef = useRef<HTMLElement | null>(null);
  const headerCreateButtonRef = useRef<HTMLButtonElement>(null);
  const contactDetailCloseButtonRef = useRef<HTMLButtonElement>(null);
  const undoTimerRef = useRef<number | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const photoRequestSequenceRef = useRef(new Map<string, number>());
  const loadedPhotoKeysRef = useRef(new Map<string, string>());
  const [selectedId, setSelectedId] = useState(initialContactId);
  const [detailOpen, setDetailOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState('');
  const [photoDataUrls, setPhotoDataUrls] = useState<Record<string, string>>({});
  const [photoUiStates, setPhotoUiStates] = useState<Record<string, MentorPhotoUiState>>({});
  const [undoNotice, setUndoNotice] = useState<ContactUndoNotice | null>(null);
  const [recentContactId, setRecentContactId] = useState('');
  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedId) || null,
    [contacts, selectedId]
  );
  const advancedFilterCount = Number(rangeFilter !== '全部') + Number(feedbackFilter !== '全部') + Number(deliveryFilter !== '全部');
  const hasActiveFilters = advancedFilterCount > 0 || keyword.trim().length > 0 || sort !== 'updated';

  useEffect(() => {
    if (!undoNotice) return;
    const handleUndoShortcut = (event: globalThis.KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.shiftKey ||
        event.key.toLowerCase() !== 'z' ||
        isWorkspaceEditableTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
      undoNotice.undo();
      setUndoNotice(null);
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }
      window.requestAnimationFrame(undoNotice.returnFocus);
    };
    window.addEventListener('keydown', handleUndoShortcut, true);
    return () => window.removeEventListener('keydown', handleUndoShortcut, true);
  }, [undoNotice]);

  useEffect(() => {
    restoredRef.current = false;
    const context = readContext(contextKey);
    onKeywordChange(initialContactId ? '' : context.keyword || '');
    onRangeFilterChange(
      !initialContactId && context.rangeFilter && CONTACT_RANGE_FILTERS.includes(context.rangeFilter)
        ? context.rangeFilter
        : '全部'
    );
    onFeedbackFilterChange(
      !initialContactId && context.feedbackFilter && CONTACT_FEEDBACK_FILTERS.includes(context.feedbackFilter)
        ? context.feedbackFilter
        : '全部'
    );
    onDeliveryFilterChange(
      !initialContactId && context.deliveryFilter && CONTACT_DELIVERY_FILTERS.includes(context.deliveryFilter)
        ? context.deliveryFilter
        : '全部'
    );
    onSortChange(!initialContactId && context.sort && ['updated', 'school', 'lastContact'].includes(context.sort) ? context.sort : 'updated');
    setSelectedId(initialContactId || context.selectedId || '');
    setDetailOpen(Boolean(initialContactId));
    const restoreFrame = window.requestAnimationFrame(() => {
      scrollTopRef.current = Number.isFinite(context.scrollTop) ? context.scrollTop || 0 : 0;
      if (listRef.current) listRef.current.scrollTop = scrollTopRef.current;
      restoredRef.current = true;
    });
    return () => window.cancelAnimationFrame(restoreFrame);
  // Context is restored once per signed-in owner. The page owns the controlled filters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey]);

  useEffect(() => {
    if (!initialContactId) return;
    setSelectedId(initialContactId);
    setDetailOpen(true);
    window.requestAnimationFrame(() => contactDetailCloseButtonRef.current?.focus({ preventScroll: true }));
  }, [initialContactId]);

  useEffect(() => {
    if (!restoredRef.current) return;
    const context: ContactContext = {
      selectedId,
      keyword,
      rangeFilter,
      feedbackFilter,
      deliveryFilter,
      sort,
      scrollTop: scrollTopRef.current
    };
    writeSessionStorageValue(contextKey, JSON.stringify(context));
  }, [contextKey, deliveryFilter, feedbackFilter, keyword, rangeFilter, selectedId, sort]);

  useEffect(() => () => {
    if (!restoredRef.current) return;
    const current = readContext(contextKey);
    writeSessionStorageValue(contextKey, JSON.stringify({ ...current, scrollTop: scrollTopRef.current }));
  }, [contextKey]);

  useEffect(() => () => {
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
    if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current);
  }, []);

  useEffect(() => {
    if (!selectedId || selectedContact) return;
    setSelectedId('');
    if (!isDesktopSurface) return;
    setDetailOpen(false);
    window.requestAnimationFrame(() => {
      const firstContactId = contacts[0]?.id;
      if (firstContactId) rowRefs.current.get(firstContactId)?.focus();
      else if (searchInputRef.current) searchInputRef.current.focus();
      else headerCreateButtonRef.current?.focus();
    });
  }, [contacts, selectedContact, selectedId]);

  useEffect(() => {
    if (!isDesktopSurface) return;
    const currentIds = new Set(contacts.map((contact) => contact.id));
    for (const id of loadedPhotoKeysRef.current.keys()) {
      if (!currentIds.has(id)) loadedPhotoKeysRef.current.delete(id);
    }
    setPhotoDataUrls((current) => {
      const next = { ...current };
      let changed = false;
      for (const id of Object.keys(next)) {
        if (!currentIds.has(id)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : current;
    });

    contacts.forEach((contact) => {
      const cacheKey = contact.photoCacheKey || '';
      const previousCacheKey = loadedPhotoKeysRef.current.get(contact.id) || '';
      if (previousCacheKey && previousCacheKey !== cacheKey) {
        photoRequestSequenceRef.current.set(
          contact.id,
          (photoRequestSequenceRef.current.get(contact.id) || 0) + 1
        );
        setPhotoDataUrls((current) => {
          if (!(contact.id in current)) return current;
          const next = { ...current };
          delete next[contact.id];
          return next;
        });
      }
      if (!cacheKey) {
        loadedPhotoKeysRef.current.delete(contact.id);
        setPhotoUiStates((current) => {
          if (!(contact.id in current)) return current;
          const next = { ...current };
          delete next[contact.id];
          return next;
        });
        return;
      }
      if (loadedPhotoKeysRef.current.get(contact.id) === cacheKey) return;
      loadedPhotoKeysRef.current.set(contact.id, cacheKey);
      void loadCachedMentorPhoto(cacheKey)
        .then((photo) => {
          if (loadedPhotoKeysRef.current.get(contact.id) !== cacheKey) return;
          setPhotoDataUrls((current) => ({ ...current, [contact.id]: photo.dataUrl }));
        })
        .catch((error) => {
          if (loadedPhotoKeysRef.current.get(contact.id) !== cacheKey) return;
          if (error instanceof MentorPhotoClientError && error.code !== 'MENTOR_PHOTO_DESKTOP_ONLY') {
            setPhotoUiStates((current) => ({
              ...current,
              [contact.id]: { phase: 'error', message: '本机照片缓存缺失，可重新从主页查找。', retryable: true }
            }));
          }
        });
    });
  }, [contacts]);

  function setPhotoUiState(id: string, state: MentorPhotoUiState) {
    setPhotoUiStates((current) => ({ ...current, [id]: state }));
  }

  function normalizeHomepageForComparison(value: string) {
    try {
      const url = new URL(value.trim());
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
        ? url.toString()
        : '';
    } catch {
      return '';
    }
  }

  function acceptMentorPhoto(contact: DesktopMentorContact, result: MentorPhotoResult) {
    const pageUrl = normalizeHomepageForComparison(contact.homepage) || result.pageUrl;
    setPhotoDataUrls((current) => ({ ...current, [contact.id]: result.dataUrl }));
    loadedPhotoKeysRef.current.set(contact.id, result.cacheKey);
    onContactChange(contact.id, 'photoCacheKey', result.cacheKey);
    onContactChange(contact.id, 'photoSourceUrl', result.sourceUrl);
    onContactChange(contact.id, 'photoPageUrl', pageUrl);
    onContactChange(contact.id, 'photoUpdatedAt', new Date().toISOString());
    setPhotoUiState(contact.id, { phase: 'success', message: '已从导师公开主页更新照片。' });
  }

  async function resolveContactPhoto(contact: DesktopMentorContact, homepageValue = contact.homepage, force = false) {
    const homepage = normalizeHomepageForComparison(homepageValue);
    if (!homepage) {
      setPhotoUiState(contact.id, { phase: 'error', message: '请输入完整的 http(s) 导师主页地址。', retryable: false });
      return;
    }
    if (!force && contact.photoCacheKey && normalizeHomepageForComparison(contact.photoPageUrl) === homepage) {
      return;
    }
    const sequence = (photoRequestSequenceRef.current.get(contact.id) || 0) + 1;
    photoRequestSequenceRef.current.set(contact.id, sequence);
    setPhotoUiState(contact.id, { phase: 'loading', message: '正在从公开主页查找照片…' });
    try {
      const result = await resolveMentorPhotoFromHomepage(homepage);
      if (photoRequestSequenceRef.current.get(contact.id) !== sequence) return;
      if (result.confidence === 'high') {
        acceptMentorPhoto({ ...contact, homepage }, result);
      } else {
        setPhotoUiState(contact.id, {
          phase: 'candidate',
          message: '找到一张可能的照片，请确认后使用。',
          candidate: result
        });
      }
    } catch (error) {
      if (photoRequestSequenceRef.current.get(contact.id) !== sequence) return;
      const normalized = error instanceof MentorPhotoClientError
        ? error
        : new MentorPhotoClientError('MENTOR_PHOTO_NATIVE_ERROR', '暂时无法读取导师主页。', true);
      setPhotoUiState(contact.id, {
        phase: 'error',
        message: normalized.message,
        retryable: normalized.retryable
      });
    }
  }

  function changeContactHomepage(contact: DesktopMentorContact, value: string) {
    photoRequestSequenceRef.current.set(
      contact.id,
      (photoRequestSequenceRef.current.get(contact.id) || 0) + 1
    );
    onContactChange(contact.id, 'homepage', value);
    setPhotoUiState(contact.id, { phase: 'idle' });
  }

  function removeContactPhoto(contact: DesktopMentorContact) {
    photoRequestSequenceRef.current.set(
      contact.id,
      (photoRequestSequenceRef.current.get(contact.id) || 0) + 1
    );
    loadedPhotoKeysRef.current.delete(contact.id);
    setPhotoDataUrls((current) => {
      const next = { ...current };
      delete next[contact.id];
      return next;
    });
    onContactChange(contact.id, 'photoCacheKey', '');
    onContactChange(contact.id, 'photoSourceUrl', '');
    onContactChange(contact.id, 'photoPageUrl', '');
    onContactChange(contact.id, 'photoUpdatedAt', '');
    setPhotoUiState(contact.id, { phase: 'idle' });
  }

  function persistScrollContext() {
    scrollTopRef.current = listRef.current?.scrollTop || 0;
  }

  function highlightContact(id: string) {
    setRecentContactId(id);
    if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = window.setTimeout(() => setRecentContactId(''), 1400);
  }

  function showUndoNotice(message: string, undo: () => void, returnFocus: () => void) {
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
    setUndoNotice({ id: Date.now(), message, undo, returnFocus });
    undoTimerRef.current = window.setTimeout(() => setUndoNotice(null), 8000);
  }

  function changeContactStatus(contact: DesktopMentorContact, value: ContactFeedbackStatus, trigger: HTMLElement) {
    const previous = contact.feedbackStatus;
    if (value === previous) return;
    const contactIndex = contacts.findIndex((candidate) => candidate.id === contact.id);
    const fallbackContact = contacts[contactIndex + 1] || contacts[contactIndex - 1];
    const leavesCurrentFilter = feedbackFilter !== '全部' && value !== feedbackFilter;
    onContactChange(contact.id, 'feedbackStatus', value);
    highlightContact(contact.id);
    if (leavesCurrentFilter) {
      window.requestAnimationFrame(() => {
        if (fallbackContact) rowRefs.current.get(fallbackContact.id)?.focus({ preventScroll: true });
        else searchInputRef.current?.focus({ preventScroll: true });
      });
    } else {
      window.requestAnimationFrame(() => {
        const control = rowRefs.current.get(contact.id)?.querySelector<HTMLElement>('[data-contact-status-action]');
        (control || trigger).focus({ preventScroll: true });
      });
    }
    showUndoNotice(
      `已将${desktopContactTitle(contact)}设为“${value}”`,
      () => {
        onContactChange(contact.id, 'feedbackStatus', previous);
        highlightContact(contact.id);
      },
      () => {
        const control = rowRefs.current.get(contact.id)?.querySelector<HTMLElement>('[data-contact-status-action]');
        (control || trigger).focus({ preventScroll: true });
      }
    );
  }

  function changeContactFollowUp(contact: DesktopMentorContact, value: string, trigger: HTMLElement) {
    const previous = contact.nextFollowUpDate;
    if (value === previous) return;
    onContactChange(contact.id, 'nextFollowUpDate', value);
    highlightContact(contact.id);
    window.requestAnimationFrame(() => {
      const control = rowRefs.current.get(contact.id)?.querySelector<HTMLElement>('[data-contact-followup-action]');
      (control || trigger).focus({ preventScroll: true });
    });
    showUndoNotice(
      value ? `已安排${desktopContactTitle(contact)}的下次跟进` : `已清除${desktopContactTitle(contact)}的跟进日期`,
      () => {
        onContactChange(contact.id, 'nextFollowUpDate', previous);
        highlightContact(contact.id);
      },
      () => {
        const control = rowRefs.current.get(contact.id)?.querySelector<HTMLElement>('[data-contact-followup-action]');
        (control || trigger).focus({ preventScroll: true });
      }
    );
  }

  function openContact(contact: DesktopMentorContact, focusDetail = false) {
    detailReturnFocusRef.current = rowRefs.current.get(contact.id)
      || (document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : null);
    setSelectedId(contact.id);
    setDetailOpen(true);
    window.requestAnimationFrame(() => {
      if (focusDetail) document.querySelector<HTMLElement>('[data-contact-detail-primary]')?.focus();
      else contactDetailCloseButtonRef.current?.focus({ preventScroll: true });
    });
  }

  function addContact(trigger?: HTMLElement | null) {
    const activeElement = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : null;
    detailReturnFocusRef.current = trigger || activeElement || headerCreateButtonRef.current;
    const id = onAddContact();
    setSelectedId(id);
    setDetailOpen(true);
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-contact-detail-primary]')?.focus());
  }

  function closeDetail() {
    const discardDraftId = selectedId && selectedId === draftContactId ? selectedId : '';
    const returnTarget = discardDraftId
      ? detailReturnFocusRef.current || headerCreateButtonRef.current
      : selectedId
      ? rowRefs.current.get(selectedId) || detailReturnFocusRef.current
      : detailReturnFocusRef.current || headerCreateButtonRef.current;
    if (discardDraftId) {
      onDiscardContactDraft(discardDraftId);
      setSelectedId('');
    }
    setDetailOpen(false);
    window.requestAnimationFrame(() => returnTarget?.focus());
  }

  useEffect(() => {
    const handleCreateRequest = () => {
      detailReturnFocusRef.current = headerCreateButtonRef.current;
      const id = onAddContact();
      setSelectedId(id);
      setDetailOpen(true);
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-contact-detail-primary]')?.focus());
    };
    window.addEventListener(DESKTOP_NEW_CONTACT_EVENT, handleCreateRequest);
    return () => window.removeEventListener(DESKTOP_NEW_CONTACT_EVENT, handleCreateRequest);
  }, [onAddContact]);

  function moveSelection(currentId: string, offset: number) {
    const index = contacts.findIndex((contact) => contact.id === currentId);
    const next = contacts[Math.min(contacts.length - 1, Math.max(0, index + offset))];
    if (!next) return;
    openContact(next);
    window.requestAnimationFrame(() => rowRefs.current.get(next.id)?.focus({ preventScroll: false }));
  }

  function getListColumnCount() {
    const columns = listRef.current ? window.getComputedStyle(listRef.current).gridTemplateColumns : '';
    if (!columns || columns === 'none') return 1;
    return Math.max(1, columns.split(' ').filter(Boolean).length);
  }

  function handleWorkspaceKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === 'n' &&
      !isWorkspaceEditableTarget(event.target)
    ) {
      event.preventDefault();
      addContact();
      return;
    }
    if (event.key === 'Escape' && detailOpen) {
      if (event.defaultPrevented) return;
      event.preventDefault();
      closeDetail();
    }
  }

  return (
    <section
      id="contacts-board"
      aria-labelledby="contacts-page-title"
      className={`${styles.page} ${isDesktopSurface ? styles.contactsPage : ''} desktop-core-page desktop-core-page--fixed`}
      onKeyDown={handleWorkspaceKeyDown}
    >
      <header className={`${styles.pageHeader} desktop-core-page-header desktop-page-header desktop-page-header--workspace`}>
        <div className={`${styles.pageHeading} desktop-page-header-copy`}>
          <div className="desktop-page-header-title-row">
            <h1 id="contacts-page-title" className={`${styles.pageTitle} desktop-page-header-title`}>导师联系</h1>
          </div>
          <p className={`${styles.pageSummary} desktop-page-header-subtitle`}>
            共 {summary.total} 位 · 需跟进 {summary.followUp} 位
          </p>
        </div>
        <div className={`${styles.headerActions} desktop-page-header-actions`}>
          <DesktopWorkspaceStatus status={syncStatus} lastSyncedAt={lastSyncedAt} onRetry={onRetrySync} />
          <button
            ref={headerCreateButtonRef}
            type="button"
            className={`${styles.primaryButton} desktop-page-primary-action`}
            onClick={(event) => addContact(event.currentTarget)}
            title="添加导师（Ctrl+N）"
          >
            <Add20Regular aria-hidden="true" />
            添加导师
          </button>
        </div>
      </header>

      <div className={styles.workspace} data-detail-open={detailOpen ? 'true' : 'false'}>
        <aside className={styles.masterPane} aria-label="导师联系人列表">
          <div className={styles.masterToolbar}>
            {isDesktopSurface ? (
              <div className={styles.contactsToolbarRow}>
                <label className={styles.searchBox}>
                  <Search20Regular aria-hidden="true" />
                  <span className={styles.visuallyHidden}>搜索导师联系人</span>
                  <input
                    ref={searchInputRef}
                    className={styles.searchInput}
                    value={keyword}
                    onChange={(event) => onKeywordChange(event.target.value)}
                    maxLength={160}
                    placeholder="搜索高校、导师、方向或邮箱"
                  />
                </label>
                <button
                  type="button"
                  className={styles.contactsQuickFilter}
                  aria-pressed={feedbackFilter === '需跟进'}
                  onClick={() => onFeedbackFilterChange(feedbackFilter === '需跟进' ? '全部' : '需跟进')}
                >
                  <span aria-hidden="true" />
                  需跟进
                </button>
                <ContactAdvancedFilters
                  rangeFilter={rangeFilter}
                  feedbackFilter={feedbackFilter}
                  deliveryFilter={deliveryFilter}
                  activeCount={advancedFilterCount}
                  onRangeFilterChange={onRangeFilterChange}
                  onFeedbackFilterChange={onFeedbackFilterChange}
                  onDeliveryFilterChange={onDeliveryFilterChange}
                />
                <ContactSortPicker value={sort} onChange={onSortChange} />
              </div>
            ) : (
              <>
                <label className={styles.searchBox}>
                  <Search20Regular aria-hidden="true" />
                  <span className={styles.visuallyHidden}>搜索导师联系人</span>
                  <input
                    className={styles.searchInput}
                    value={keyword}
                    onChange={(event) => onKeywordChange(event.target.value)}
                    maxLength={160}
                    placeholder="搜索高校、导师、方向或邮箱"
                  />
                </label>
                <div className={styles.filterGrid}>
                  <select className={styles.fieldControl} value={feedbackFilter} aria-label="联系反馈" onChange={(event) => onFeedbackFilterChange(event.target.value as '全部' | ContactFeedbackStatus)}>
                    {CONTACT_FEEDBACK_FILTERS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <select className={styles.fieldControl} value={deliveryFilter} aria-label="投递状态" onChange={(event) => onDeliveryFilterChange(event.target.value as '全部' | ContactDeliveryStatus)}>
                    {CONTACT_DELIVERY_FILTERS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <select className={styles.fieldControl} value={rangeFilter} aria-label="学院层次" onChange={(event) => onRangeFilterChange(event.target.value as ContactRangeFilter)}>
                    {CONTACT_RANGE_FILTERS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <select className={styles.fieldControl} value={sort} aria-label="排序方式" onChange={(event) => onSortChange(event.target.value as ContactSortOption)}>
                    <option value="updated">最近更新</option>
                    <option value="school">按高校</option>
                    <option value="lastContact">最近联系</option>
                  </select>
                </div>
                {hasActiveFilters ? (
                  <button type="button" className={styles.secondaryButton} onClick={onResetFilters}>清空筛选</button>
                ) : null}
              </>
            )}
          </div>

          <div ref={listRef} className={`${styles.masterScroll} desktop-contacts-list`} role="list" aria-label="导师联系人" onScroll={persistScrollContext}>
            {contacts.length ? contacts.map((contact) => (
              <div
                key={contact.id}
                ref={(node) => {
                  if (node) rowRefs.current.set(contact.id, node);
                  else rowRefs.current.delete(contact.id);
                }}
                role="listitem"
                aria-label={`${desktopContactTitle(contact)}，${contactSubtitle(contact)}，${contact.researchDirection || '待补充研究方向'}，当前状态${contact.feedbackStatus}，${formatFollowUpLabel(contact.nextFollowUpDate)}`}
                aria-current={selectedId === contact.id ? 'true' : undefined}
                aria-controls={isDesktopSurface ? 'contacts-detail-pane' : undefined}
                data-detail-expanded={isDesktopSurface && detailOpen && selectedId === contact.id ? 'true' : undefined}
                tabIndex={selectedId === contact.id || (!selectedId && contacts[0]?.id === contact.id) ? 0 : -1}
                className={`${styles.listRow} ${isDesktopSurface ? styles.contactListRow : ''} ${selectedId === contact.id ? styles.listRowSelected : ''}`}
                data-recent-action={recentContactId === contact.id ? 'true' : undefined}
                onClick={() => openContact(contact)}
                onDoubleClick={() => openContact(contact, true)}
                onKeyDown={(event) => {
                  if (isWorkspaceEditableTarget(event.target)) return;
                  if (['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(event.key)) {
                    event.preventDefault();
                    const columnCount = getListColumnCount();
                    const offset = event.key === 'ArrowDown'
                      ? columnCount
                      : event.key === 'ArrowUp'
                        ? -columnCount
                        : event.key === 'ArrowRight'
                          ? 1
                          : -1;
                    moveSelection(contact.id, offset);
                  } else if (event.key === 'Enter') {
                    event.preventDefault();
                    openContact(contact, true);
                  } else if (event.key === 'Delete') {
                    event.preventDefault();
                    returnFocusRef.current = event.currentTarget;
                    setPendingDeleteId(contact.id);
                  }
                }}
              >
                {isDesktopSurface ? (
                  <>
                    <ContactAvatar
                      contact={contact}
                      dataUrl={photoDataUrls[contact.id]}
                      className={styles.contactAvatar}
                    />
                    <span className={styles.rowBody}>
                      <span className={styles.contactTitleLine}>
                        <span className={styles.rowTitle}>{desktopContactTitle(contact)}</span>
                        {!contact.mentorName && !contact.schoolName ? <span className={styles.contactDraftPill}>草稿</span> : null}
                      </span>
                      <span className={styles.rowMeta}>
                        {!contact.mentorName && !contact.schoolName ? '尚未填写高校与导师姓名' : contactSubtitle(contact)}
                      </span>
                      <span className={styles.rowDescription}>
                        {contact.researchDirection || '待补充研究方向'}
                      </span>
                    </span>
                    <span className={styles.rowEnd}>
                      <span className={styles.contactRowMetric} data-contact-metric="last">
                        <small>最近联系</small>
                        <span className={styles.contactRowValue}>
                          {formatLastContactLabel(contact.lastContactDate, contact.contactChannel)}
                        </span>
                      </span>
                      <span className={styles.contactRowMetric} data-contact-metric="next">
                        <small>下次跟进</small>
                        <input
                          type="date"
                          className={styles.contactInlineDate}
                          data-contact-followup-action
                          data-follow-up={getFollowUpTone(contact.nextFollowUpDate)}
                          value={contact.nextFollowUpDate}
                          disabled={contact.id === draftContactId}
                          aria-label={`修改${desktopContactTitle(contact)}的下次跟进日期`}
                          onClick={(event) => event.stopPropagation()}
                          onDoubleClick={(event) => event.stopPropagation()}
                          onChange={(event) => changeContactFollowUp(contact, event.target.value, event.currentTarget)}
                        />
                      </span>
                      <span className={styles.contactRowMetric} data-contact-metric="status">
                        <small>当前状态</small>
                        <select
                          className={styles.contactInlineSelect}
                          data-contact-status-action
                          value={contact.feedbackStatus}
                          disabled={contact.id === draftContactId}
                          data-feedback-status={contact.feedbackStatus}
                          aria-label={`修改${desktopContactTitle(contact)}的联系状态`}
                          onClick={(event) => event.stopPropagation()}
                          onDoubleClick={(event) => event.stopPropagation()}
                          onChange={(event) => changeContactStatus(contact, event.target.value as ContactFeedbackStatus, event.currentTarget)}
                        >
                          {CONTACT_FEEDBACK_FILTERS.filter((item) => item !== '全部').map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                      </span>
                      <ChevronRight20Regular className={styles.contactRowChevron} aria-hidden="true" />
                    </span>
                  </>
                ) : (
                  <>
                    <span className={styles.avatar}>{(contact.mentorName || contact.schoolName || '导').slice(0, 1)}</span>
                    <span className={styles.rowBody}>
                      <span className={styles.rowTitle}>{contactTitle(contact)}</span>
                      <span className={styles.rowMeta}>{contactSubtitle(contact)}</span>
                      <span className={styles.rowDescription}>{contact.researchDirection || contact.email || '尚未补充研究方向与邮箱'}</span>
                    </span>
                    <span className={styles.rowEnd}>
                      <span className={styles.statusPill}>{contact.feedbackStatus}</span>
                      <span className={styles.rowDate}>{contact.nextFollowUpDate ? `跟进 ${contact.nextFollowUpDate}` : contact.schoolRange}</span>
                    </span>
                  </>
                )}
              </div>
            )) : (
              <EmptyContacts desktop={isDesktopSurface} filtered={totalCount > 0} onCreate={addContact} onReset={onResetFilters} />
            )}
          </div>
        </aside>

        <section
          id="contacts-detail-pane"
          className={styles.detailPane}
          aria-label="导师联系详情"
          aria-hidden={isDesktopSurface ? !detailOpen : undefined}
          inert={isDesktopSurface && !detailOpen ? true : undefined}
        >
          {selectedContact ? (
            <>
              {isDesktopSurface ? (
                <div className={`${styles.detailHeader} ${styles.contactDetailHeader}`}>
                  <ContactAvatar
                    contact={selectedContact}
                    dataUrl={photoDataUrls[selectedContact.id]}
                    loading={photoUiStates[selectedContact.id]?.phase === 'loading'}
                    className={styles.contactDetailAvatar}
                    eager
                  />
                  <div className={styles.detailHeading}>
                    <h2 className={styles.detailTitle}>{desktopContactTitle(selectedContact)}</h2>
                    <p className={styles.detailSubtitle}>{contactSubtitle(selectedContact)}</p>
                    <div className={styles.contactHeaderMeta}>
                      <span className={`${styles.statusPill} ${styles.contactStatusPill}`} data-feedback-status={selectedContact.feedbackStatus}>
                        {selectedContact.feedbackStatus}
                      </span>
                      <span data-follow-up={getFollowUpTone(selectedContact.nextFollowUpDate)}>
                        {formatFollowUpLabel(selectedContact.nextFollowUpDate)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.contactDetailActions}>
                    <button
                      ref={contactDetailCloseButtonRef}
                      type="button"
                      className={`${styles.backButton} ${styles.contactCloseButton}`}
                      aria-label="关闭导师详情并返回列表"
                      onClick={closeDetail}
                    >
                      <ArrowLeft20Regular className={styles.contactBackIcon} aria-hidden="true" />
                      <Dismiss20Regular className={styles.contactDismissIcon} aria-hidden="true" />
                      <span>返回列表</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.detailHeader}>
                  <button type="button" className={styles.backButton} onClick={closeDetail}>
                    <ArrowLeft20Regular aria-hidden="true" />
                    返回列表
                  </button>
                  <div className={styles.detailHeading}>
                    <h2 className={styles.detailTitle}>{contactTitle(selectedContact)}</h2>
                    <p className={styles.detailSubtitle}>{contactSubtitle(selectedContact)}</p>
                  </div>
                  <span className={styles.statusPill}>{selectedContact.feedbackStatus}</span>
                </div>
              )}
              <ContactDetail
                contact={selectedContact}
                draft={selectedContact.id === draftContactId}
                onChange={onContactChange}
                photoDataUrl={photoDataUrls[selectedContact.id]}
                photoState={photoUiStates[selectedContact.id] || { phase: 'idle' }}
                onHomepageChange={(value) => changeContactHomepage(selectedContact, value)}
                onResolvePhoto={(homepage, force) => resolveContactPhoto(selectedContact, homepage, force)}
                onAcceptPhoto={(result) => acceptMentorPhoto(selectedContact, result)}
                onDismissPhotoCandidate={() => setPhotoUiState(selectedContact.id, { phase: 'idle' })}
                onRemovePhoto={() => removeContactPhoto(selectedContact)}
                onDelete={(button) => {
                  returnFocusRef.current = button;
                  setPendingDeleteId(selectedContact.id);
                }}
              />
            </>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyInner}>
                <span className={styles.emptyIcon}><People24Regular aria-hidden="true" /></span>
                <h2 className={styles.emptyTitle}>选择一位导师查看详情</h2>
                <p className={styles.emptyDescription}>左侧列表用于快速切换联系人，右侧集中维护身份、沟通记录和下一次跟进。</p>
                <div className={styles.formActions}>
                  <button type="button" className={styles.primaryButton} onClick={(event) => addContact(event.currentTarget)}><Add20Regular aria-hidden="true" />添加导师</button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {undoNotice ? (
        <div className={styles.productivityToast} aria-label="导师联系操作反馈">
          <span role="status" aria-live="polite" aria-atomic="true">{undoNotice.message}</span>
          <button
            type="button"
            onClick={() => {
              undoNotice.undo();
              setUndoNotice(null);
              window.requestAnimationFrame(undoNotice.returnFocus);
            }}
          >
            撤销
          </button>
        </div>
      ) : null}

      <DesktopConfirmDialog
        open={Boolean(pendingDeleteId)}
        title="删除这位导师联系人？"
        description="联系人会在本机立即移除，并以删除记录同步到其他设备，避免旧副本重新出现。"
        confirmLabel="确认删除"
        returnFocusTo={returnFocusRef.current}
        onCancel={() => setPendingDeleteId('')}
        onConfirm={() => {
          const deletedIndex = contacts.findIndex((contact) => contact.id === pendingDeleteId);
          const nextContact = contacts[deletedIndex + 1] || contacts[deletedIndex - 1] || null;
          if (pendingDeleteId) onDeleteContact(pendingDeleteId);
          if (selectedId === pendingDeleteId) {
            setSelectedId(isDesktopSurface ? nextContact?.id || '' : '');
            setDetailOpen(false);
            if (isDesktopSurface) {
              window.requestAnimationFrame(() => {
                if (nextContact) rowRefs.current.get(nextContact.id)?.focus();
                else headerCreateButtonRef.current?.focus();
              });
            }
          }
          setPendingDeleteId('');
        }}
      />
    </section>
  );
}

function ContactDetail({
  contact,
  draft,
  onChange,
  photoDataUrl,
  photoState,
  onHomepageChange,
  onResolvePhoto,
  onAcceptPhoto,
  onDismissPhotoCandidate,
  onRemovePhoto,
  onDelete
}: {
  contact: DesktopMentorContact;
  draft: boolean;
  onChange: <K extends keyof DesktopMentorContact>(id: string, key: K, value: DesktopMentorContact[K]) => void;
  photoDataUrl?: string;
  photoState: MentorPhotoUiState;
  onHomepageChange: (value: string) => void;
  onResolvePhoto: (homepage: string, force?: boolean) => void | Promise<void>;
  onAcceptPhoto: (result: MentorPhotoResult) => void;
  onDismissPhotoCandidate: () => void;
  onRemovePhoto: () => void;
  onDelete: (button: HTMLButtonElement) => void;
}) {
  if (isDesktopSurface) {
    return (
      <DesktopContactDetail
        contact={contact}
        draft={draft}
        onChange={onChange}
        photoDataUrl={photoDataUrl}
        photoState={photoState}
        onHomepageChange={onHomepageChange}
        onResolvePhoto={onResolvePhoto}
        onAcceptPhoto={onAcceptPhoto}
        onDismissPhotoCandidate={onDismissPhotoCandidate}
        onRemovePhoto={onRemovePhoto}
        onDelete={onDelete}
      />
    );
  }

  return (
    <div className={styles.detailScroll}>
      <section className={styles.detailSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>导师信息</h3>
            <p className={styles.sectionDescription}>这些字段只用于你的申请工作区，修改后会立即保存在本机。</p>
          </div>
        </div>
        <div className={`${styles.formGrid} ${styles.formGridWide}`}>
          <Field label="所在高校">
            <input data-contact-detail-primary className={styles.fieldControl} value={contact.schoolName} onChange={(event) => onChange(contact.id, 'schoolName', event.target.value)} maxLength={80} placeholder="例如：清华大学" />
          </Field>
          <Field label="所在学院">
            <input className={styles.fieldControl} value={contact.departmentName} onChange={(event) => onChange(contact.id, 'departmentName', event.target.value)} maxLength={80} placeholder="例如：计算机学院" />
          </Field>
          <Field label="导师姓名">
            <input className={styles.fieldControl} value={contact.mentorName} onChange={(event) => onChange(contact.id, 'mentorName', event.target.value)} maxLength={80} placeholder="导师姓名" />
          </Field>
          <Field label="职称">
            <input className={styles.fieldControl} value={contact.mentorTitle} onChange={(event) => onChange(contact.id, 'mentorTitle', event.target.value)} maxLength={80} placeholder="教授 / 副教授" />
          </Field>
          <Field label="院校层次">
            <select className={styles.fieldControl} value={contact.schoolRange} onChange={(event) => onChange(contact.id, 'schoolRange', event.target.value as DesktopMentorContact['schoolRange'])}>
              {CONTACT_RANGE_FILTERS.filter((item) => item !== '全部').map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="导师邮箱">
            <input className={styles.fieldControl} type="email" value={contact.email} onChange={(event) => onChange(contact.id, 'email', event.target.value)} maxLength={160} placeholder="mentor@example.com" />
          </Field>
          <Field label="研究方向" full>
            <input className={styles.fieldControl} value={contact.researchDirection} onChange={(event) => onChange(contact.id, 'researchDirection', event.target.value)} maxLength={240} placeholder="研究方向或关键词" />
          </Field>
          <Field label="导师主页" full>
            <input className={styles.fieldControl} type="url" value={contact.homepage} onChange={(event) => onChange(contact.id, 'homepage', event.target.value)} maxLength={500} placeholder="https://…" />
          </Field>
        </div>
      </section>

      <section className={styles.detailSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>联系状态与下一步</h3>
            <p className={styles.sectionDescription}>状态和跟进日期会共同决定你下一次需要处理的动作。</p>
          </div>
        </div>
        <div className={`${styles.formGrid} ${styles.formGridWide}`}>
          <Field label="投递状态">
            <select className={styles.fieldControl} value={contact.deliveryStatus} onChange={(event) => onChange(contact.id, 'deliveryStatus', event.target.value as ContactDeliveryStatus)}>
              {CONTACT_DELIVERY_FILTERS.filter((item) => item !== '全部').map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="联系反馈">
            <select className={styles.fieldControl} value={contact.feedbackStatus} onChange={(event) => onChange(contact.id, 'feedbackStatus', event.target.value as ContactFeedbackStatus)}>
              {CONTACT_FEEDBACK_FILTERS.filter((item) => item !== '全部').map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="联系渠道">
            <select className={styles.fieldControl} value={contact.contactChannel} onChange={(event) => onChange(contact.id, 'contactChannel', event.target.value)}>
              <option value="">待补充</option>
              <option value="邮件">邮件</option>
              <option value="微信">微信</option>
              <option value="电话">电话</option>
              <option value="官网表单">官网表单</option>
              <option value="其他">其他</option>
            </select>
          </Field>
          <Field label="最近联系">
            <input className={styles.fieldControl} type="date" value={contact.lastContactDate} onChange={(event) => onChange(contact.id, 'lastContactDate', event.target.value)} />
          </Field>
          <Field label="下一次跟进">
            <input className={styles.fieldControl} type="date" value={contact.nextFollowUpDate} onChange={(event) => onChange(contact.id, 'nextFollowUpDate', event.target.value)} />
          </Field>
        </div>
      </section>

      <section className={styles.detailSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>沟通记录</h3>
            <p className={styles.sectionDescription}>把最近一次沟通和下一次动作连续记录在这里，不再散落到多个表格。</p>
          </div>
        </div>
        <div className={styles.timeline} aria-label="导师沟通时间线">
          <div className={styles.timelineItem}>
            <strong>{contact.lastContactDate || '尚未联系'}</strong>
            <div>{contact.contactChannel ? `通过${contact.contactChannel}联系` : '补充联系日期与渠道后会形成一条时间记录。'}</div>
          </div>
          <div className={styles.timelineItem}>
            <strong>{contact.nextFollowUpDate || '尚未安排下一次跟进'}</strong>
            <div>{contact.nextFollowUpDate ? '到期后会作为需要处理的下一步。' : '建议为需要继续沟通的导师设置跟进日期。'}</div>
          </div>
        </div>
        <div className={styles.formGrid}>
          <Field label="沟通记录" full>
            <textarea className={styles.fieldControl} value={contact.contactNotes} onChange={(event) => onChange(contact.id, 'contactNotes', event.target.value)} maxLength={1000} placeholder="记录沟通重点、导师反馈、团队情况和招生倾向" />
          </Field>
          <Field label="跟进备注" full>
            <textarea className={styles.fieldControl} value={contact.notes} onChange={(event) => onChange(contact.id, 'notes', event.target.value)} maxLength={1000} placeholder="记录下一次要发送的材料、问题或行动" />
          </Field>
        </div>
      </section>

      <section className={styles.detailSection}>
        <div className={styles.privacyNotice}>
          <LockClosed20Regular aria-hidden="true" />
          <div className={styles.privacyText}>
            <strong>隐私提示</strong>
            <p className={styles.sectionDescription}>联系人信息仅用于你的申请跟进。如需分享，请先确认已获得对方许可。</p>
            <input className={styles.fieldControl} value={contact.privacyNotice} onChange={(event) => onChange(contact.id, 'privacyNotice', event.target.value)} maxLength={240} aria-label="联系人隐私提示" />
          </div>
        </div>
        <div className={styles.formActions}>
          {contact.email ? (
            <a className={styles.secondaryButton} href={`mailto:${contact.email}`}>
              <Mail20Regular aria-hidden="true" />
              写邮件
            </a>
          ) : null}
          <button type="button" className={styles.dangerButton} onClick={(event) => onDelete(event.currentTarget)}>
            <Delete20Regular aria-hidden="true" />
            删除联系人
          </button>
          <span className={styles.statusPill}>
            {draft ? <><Info20Regular aria-hidden="true" />填写姓名或高校后保存</> : <><Checkmark20Regular aria-hidden="true" />已自动保存</>}
          </span>
        </div>
      </section>
    </div>
  );
}

function DesktopContactDetail({
  contact,
  draft,
  onChange,
  photoDataUrl,
  photoState,
  onHomepageChange,
  onResolvePhoto,
  onAcceptPhoto,
  onDismissPhotoCandidate,
  onRemovePhoto,
  onDelete
}: {
  contact: DesktopMentorContact;
  draft: boolean;
  onChange: <K extends keyof DesktopMentorContact>(id: string, key: K, value: DesktopMentorContact[K]) => void;
  photoDataUrl?: string;
  photoState: MentorPhotoUiState;
  onHomepageChange: (value: string) => void;
  onResolvePhoto: (homepage: string, force?: boolean) => void | Promise<void>;
  onAcceptPhoto: (result: MentorPhotoResult) => void;
  onDismissPhotoCandidate: () => void;
  onRemovePhoto: () => void;
  onDelete: (button: HTMLButtonElement) => void;
}) {
  return (
    <div className={`${styles.detailScroll} ${styles.contactDetailScroll}`}>
      <section className={`${styles.detailSection} ${styles.contactDetailSection}`}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>基本信息</h3>
            <p className={styles.sectionDescription}>先记录导师和院校，其他资料可以稍后补充。</p>
          </div>
        </div>
        <div className={`${styles.formGrid} ${styles.formGridWide} ${styles.contactCoreGrid}`}>
          <Field label="导师姓名">
            <input data-contact-detail-primary className={styles.fieldControl} value={contact.mentorName} onChange={(event) => onChange(contact.id, 'mentorName', event.target.value)} maxLength={80} placeholder="导师姓名" />
          </Field>
          <Field label="所在高校">
            <input className={styles.fieldControl} value={contact.schoolName} onChange={(event) => onChange(contact.id, 'schoolName', event.target.value)} maxLength={80} placeholder="例如：清华大学" />
          </Field>
          <Field label="所在学院">
            <textarea className={`${styles.fieldControl} ${styles.contactCompactTextarea}`} rows={2} value={contact.departmentName} onChange={(event) => onChange(contact.id, 'departmentName', event.target.value)} maxLength={80} placeholder="例如：计算机学院" />
          </Field>
          <Field label="导师邮箱">
            <input className={styles.fieldControl} type="email" value={contact.email} onChange={(event) => onChange(contact.id, 'email', event.target.value)} maxLength={160} placeholder="mentor@example.com" />
          </Field>
          <Field label="研究方向" full>
            <textarea className={`${styles.fieldControl} ${styles.contactCompactTextarea}`} rows={2} value={contact.researchDirection} onChange={(event) => onChange(contact.id, 'researchDirection', event.target.value)} maxLength={240} placeholder="研究方向或关键词" />
          </Field>
          <MentorHomepageField
            contact={contact}
            photoDataUrl={photoDataUrl}
            state={photoState}
            onChange={onHomepageChange}
            onResolve={onResolvePhoto}
            onAccept={onAcceptPhoto}
            onDismissCandidate={onDismissPhotoCandidate}
            onRemovePhoto={onRemovePhoto}
          />
        </div>
      </section>

      <section className={`${styles.detailSection} ${styles.contactDetailSection}`}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>下一步</h3>
            <p className={styles.sectionDescription}>明确当前进度和下一次联系时间，避免遗漏跟进。</p>
          </div>
        </div>
        <div className={`${styles.formGrid} ${styles.formGridWide} ${styles.contactNextGrid}`}>
          <Field label="当前状态">
            <select
              className={styles.fieldControl}
              value={contact.feedbackStatus}
              data-feedback-status={contact.feedbackStatus}
              onChange={(event) => onChange(contact.id, 'feedbackStatus', event.target.value as ContactFeedbackStatus)}
            >
              {CONTACT_FEEDBACK_FILTERS.filter((item) => item !== '全部').map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="下一次跟进">
            <input className={styles.fieldControl} type="date" value={contact.nextFollowUpDate} onChange={(event) => onChange(contact.id, 'nextFollowUpDate', event.target.value)} />
          </Field>
        </div>
      </section>

      <details className={styles.contactDetailsGroup}>
        <summary>
          <span><strong>更多资料</strong><small>职称、院校层次、投递与最近联系</small></span>
          <ChevronDown20Regular aria-hidden="true" />
        </summary>
        <div className={`${styles.formGrid} ${styles.contactDetailsBody}`}>
          <Field label="职称">
            <input className={styles.fieldControl} value={contact.mentorTitle} onChange={(event) => onChange(contact.id, 'mentorTitle', event.target.value)} maxLength={80} placeholder="教授 / 副教授" />
          </Field>
          <Field label="院校层次">
            <select className={styles.fieldControl} value={contact.schoolRange} onChange={(event) => onChange(contact.id, 'schoolRange', event.target.value as DesktopMentorContact['schoolRange'])}>
              {CONTACT_RANGE_FILTERS.filter((item) => item !== '全部').map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="投递状态">
            <select className={styles.fieldControl} value={contact.deliveryStatus} onChange={(event) => onChange(contact.id, 'deliveryStatus', event.target.value as ContactDeliveryStatus)}>
              {CONTACT_DELIVERY_FILTERS.filter((item) => item !== '全部').map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="联系渠道">
            <select className={styles.fieldControl} value={contact.contactChannel} onChange={(event) => onChange(contact.id, 'contactChannel', event.target.value)}>
              <option value="">待补充</option>
              <option value="邮件">邮件</option>
              <option value="微信">微信</option>
              <option value="电话">电话</option>
              <option value="官网表单">官网表单</option>
              <option value="其他">其他</option>
            </select>
          </Field>
          <Field label="最近联系">
            <input className={styles.fieldControl} type="date" value={contact.lastContactDate} onChange={(event) => onChange(contact.id, 'lastContactDate', event.target.value)} />
          </Field>
          <Field label="隐私备注" full>
            <textarea className={`${styles.fieldControl} ${styles.contactCompactTextarea}`} rows={2} value={contact.privacyNotice} onChange={(event) => onChange(contact.id, 'privacyNotice', event.target.value)} maxLength={240} placeholder="可选：记录这位联系人的隐私边界" />
          </Field>
        </div>
      </details>

      <details className={styles.contactDetailsGroup}>
        <summary>
          <span><strong>沟通记录</strong><small>联系计划、导师反馈与下一次动作</small></span>
          <ChevronDown20Regular aria-hidden="true" />
        </summary>
        <div className={styles.contactDetailsBody}>
          <div className={styles.timeline} aria-label="导师联系计划">
            <div className={styles.timelineItem}>
              <strong>{contact.lastContactDate || '尚未联系'}</strong>
              <div>{contact.contactChannel ? `通过${contact.contactChannel}联系` : '补充联系日期与渠道后会形成联系记录。'}</div>
            </div>
            <div className={styles.timelineItem}>
              <strong>{contact.nextFollowUpDate || '尚未安排下一次跟进'}</strong>
              <div>{contact.nextFollowUpDate ? '这一天会作为下一次需要处理的动作。' : '建议为需要继续沟通的导师设置跟进日期。'}</div>
            </div>
          </div>
          <div className={styles.formGrid}>
            <Field label="沟通记录" full>
              <textarea className={styles.fieldControl} value={contact.contactNotes} onChange={(event) => onChange(contact.id, 'contactNotes', event.target.value)} maxLength={1000} placeholder="记录沟通重点、导师反馈、团队情况和招生倾向" />
            </Field>
            <Field label="跟进备注" full>
              <textarea className={styles.fieldControl} value={contact.notes} onChange={(event) => onChange(contact.id, 'notes', event.target.value)} maxLength={1000} placeholder="记录下一次要发送的材料、问题或行动" />
            </Field>
          </div>
        </div>
      </details>

      <div className={styles.contactDetailFooter}>
        <div className={styles.contactPrivacyCopy}>
          <LockClosed20Regular aria-hidden="true" />
          <span>联系人信息仅用于个人申请跟进；公开主页照片只缓存在本机。</span>
        </div>
        <div className={styles.contactFooterActions}>
          <span className={styles.contactSaveState} data-draft={draft ? 'true' : undefined}>
            {draft ? <><Info20Regular aria-hidden="true" />填写姓名或高校后保存</> : <><Checkmark20Regular aria-hidden="true" />已自动保存</>}
          </span>
          {contact.email ? (
            <a className={styles.secondaryButton} href={`mailto:${contact.email}`}>
              <Mail20Regular aria-hidden="true" />
              写邮件
            </a>
          ) : null}
          <button type="button" className={styles.dangerButton} onClick={(event) => onDelete(event.currentTarget)}>
            <Delete20Regular aria-hidden="true" />
            删除
          </button>
        </div>
      </div>
    </div>
  );
}

function ContactAvatar({
  contact,
  dataUrl,
  className,
  loading = false,
  eager = false
}: {
  contact: DesktopMentorContact;
  dataUrl?: string;
  className: string;
  loading?: boolean;
  eager?: boolean;
}) {
  const [failedDataUrl, setFailedDataUrl] = useState('');
  useEffect(() => {
    if (failedDataUrl && failedDataUrl !== dataUrl) setFailedDataUrl('');
  }, [dataUrl, failedDataUrl]);
  const showPhoto = Boolean(dataUrl && dataUrl !== failedDataUrl);
  const fallback = (contact.mentorName || contact.schoolName || '导').slice(0, 1);

  return (
    <span
      className={`${styles.avatar} ${className} ${showPhoto ? styles.contactAvatarHasPhoto : ''}`}
      aria-hidden="true"
      title={showPhoto ? '照片来自导师公开主页' : undefined}
    >
      {showPhoto ? (
        <>
          {/* The source is a bounded native-cache data URL, not a Next image asset. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dataUrl}
            alt=""
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFailedDataUrl(dataUrl || '')}
          />
        </>
      ) : fallback}
      {loading ? <span className={styles.contactPhotoLoadingIndicator} aria-hidden="true" /> : null}
    </span>
  );
}

function MentorHomepageField({
  contact,
  photoDataUrl,
  state,
  onChange,
  onResolve,
  onAccept,
  onDismissCandidate,
  onRemovePhoto
}: {
  contact: DesktopMentorContact;
  photoDataUrl?: string;
  state: MentorPhotoUiState;
  onChange: (value: string) => void;
  onResolve: (homepage: string, force?: boolean) => void | Promise<void>;
  onAccept: (result: MentorPhotoResult) => void;
  onDismissCandidate: () => void;
  onRemovePhoto: () => void;
}) {
  const inputId = useId();
  let normalizedHomepage = '';
  try {
    const url = new URL(contact.homepage.trim());
    normalizedHomepage = ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.toString()
      : '';
  } catch {
    normalizedHomepage = '';
  }
  const hasPhoto = Boolean(photoDataUrl || contact.photoCacheKey);

  return (
    <div className={`${styles.field} ${styles.fieldFull} ${styles.mentorHomepageField}`}>
      <label htmlFor={inputId} className={styles.fieldLabel}>导师主页</label>
      <div className={styles.mentorHomepageControl}>
        <textarea
          id={inputId}
          className={`${styles.fieldControl} ${styles.contactCompactTextarea}`}
          value={contact.homepage}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => {
            if (event.currentTarget.value.trim()) void onResolve(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          maxLength={500}
          rows={2}
          placeholder="https://faculty.example.edu/mentor"
          aria-describedby={`${inputId}-photo-status`}
        />
        {normalizedHomepage ? (
          <a
            className={styles.mentorHomepageOpenButton}
            href={normalizedHomepage}
            target="_blank"
            rel="noreferrer"
            aria-label="在浏览器中打开导师主页"
          >
            <Open20Regular aria-hidden="true" />
            打开
          </a>
        ) : null}
      </div>

      <div
        id={`${inputId}-photo-status`}
        className={styles.mentorPhotoStatus}
        data-phase={state.phase}
        aria-live="polite"
      >
        {state.phase === 'loading' ? (
          <><span className={styles.mentorPhotoSpinner} aria-hidden="true" /><span>{state.message}</span></>
        ) : state.phase === 'candidate' ? (
          <div className={styles.mentorPhotoCandidate}>
            {/* Native validation bounds the candidate bytes and dimensions before this preview. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={state.candidate.dataUrl} alt="候选导师照片" />
            <div>
              <strong>{state.message}</strong>
              <span>照片来自公开主页，确认后才会替换当前头像。</span>
            </div>
            <button type="button" onClick={() => onAccept(state.candidate)}>使用照片</button>
            <button type="button" onClick={onDismissCandidate}>忽略</button>
          </div>
        ) : state.phase === 'success' ? (
          <><CheckmarkCircle20Regular aria-hidden="true" /><span>{state.message}</span></>
        ) : state.phase === 'error' ? (
          <>
            <Info20Regular aria-hidden="true" />
            <span>{state.message}</span>
            {normalizedHomepage ? (
              <button type="button" className={styles.contactPhotoTextButton} onClick={() => void onResolve(normalizedHomepage, true)}>
                重新查找
              </button>
            ) : null}
          </>
        ) : hasPhoto ? (
          <>
            <CheckmarkCircle20Regular aria-hidden="true" />
            <span>照片来自导师公开主页，仅在本机缓存。</span>
            {contact.photoSourceUrl ? (
              <a className={styles.contactPhotoTextButton} href={contact.photoSourceUrl} target="_blank" rel="noreferrer">查看来源</a>
            ) : null}
            {normalizedHomepage ? (
              <button type="button" className={styles.contactPhotoTextButton} onClick={() => void onResolve(normalizedHomepage, true)}>
                <ArrowSync20Regular aria-hidden="true" />重新查找
              </button>
            ) : null}
            <button type="button" className={styles.contactPhotoTextButton} onClick={onRemovePhoto}>移除照片</button>
          </>
        ) : (
          <>
            <Image20Regular aria-hidden="true" />
            <span>保存有效主页后，安装版会自动从公开页面查找照片。</span>
          </>
        )}
      </div>
    </div>
  );
}

function ContactAdvancedFilters({
  rangeFilter,
  feedbackFilter,
  deliveryFilter,
  activeCount,
  onRangeFilterChange,
  onFeedbackFilterChange,
  onDeliveryFilterChange
}: {
  rangeFilter: ContactRangeFilter;
  feedbackFilter: '全部' | ContactFeedbackStatus;
  deliveryFilter: '全部' | ContactDeliveryStatus;
  activeCount: number;
  onRangeFilterChange: (value: ContactRangeFilter) => void;
  onFeedbackFilterChange: (value: '全部' | ContactFeedbackStatus) => void;
  onDeliveryFilterChange: (value: '全部' | ContactDeliveryStatus) => void;
}) {
  const popoverId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useDismissContactPopoverOnViewportChange(surfaceRef, open);

  return (
    <div className={styles.contactsToolbarControl}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.contactsToolbarButton}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => {
          if (triggerRef.current && surfaceRef.current) {
            toggleAnchoredContactPopover(triggerRef.current, surfaceRef.current, 360, 520);
          }
        }}
      >
        <Filter20Regular aria-hidden="true" />
        <span>筛选</span>
        {activeCount ? <span className={styles.contactsFilterCount}>{activeCount}</span> : null}
        <ChevronDown20Regular aria-hidden="true" />
      </button>
      <div
        ref={surfaceRef}
        id={popoverId}
        popover="auto"
        role="dialog"
        aria-modal="false"
        aria-label="筛选导师联系人"
        className={`${styles.contactsPopoverSurface} ${styles.contactsFilterPopover}`}
        onToggle={(event) => {
          const surface = event.currentTarget;
          const nextOpen = surface.matches(':popover-open');
          setOpen(nextOpen);
          if (nextOpen) {
            window.requestAnimationFrame(() => surface.querySelector<HTMLElement>('button[aria-pressed="true"], button, select, input')?.focus({ preventScroll: true }));
          }
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          closeContactPopover(surfaceRef.current, triggerRef.current);
        }}
      >
        <div className={styles.contactsPopoverHeader}>
          <strong>筛选导师</strong>
          <span>按沟通进度、投递状态和院校层次缩小范围。</span>
        </div>

        <fieldset className={styles.contactsFilterGroup}>
          <legend>沟通状态</legend>
          <div className={`${styles.contactsFilterOptions} ${styles.contactsStatusOptions}`}>
            {CONTACT_FEEDBACK_FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={feedbackFilter === item}
                data-feedback-status={item === '全部' ? undefined : item}
                onClick={() => onFeedbackFilterChange(item)}
              >
                <span aria-hidden="true" />
                {item === '全部' ? '全部状态' : item}
                {feedbackFilter === item ? <Checkmark20Regular aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.contactsFilterGroup}>
          <legend>投递状态</legend>
          <div className={styles.contactsSegmentedOptions}>
            {CONTACT_DELIVERY_FILTERS.map((item) => (
              <button key={item} type="button" aria-pressed={deliveryFilter === item} onClick={() => onDeliveryFilterChange(item)}>
                {item === '全部' ? '全部' : item}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.contactsFilterGroup}>
          <legend>院校层次</legend>
          <div className={styles.contactsRangeOptions}>
            {CONTACT_RANGE_FILTERS.map((item) => (
              <button key={item} type="button" aria-pressed={rangeFilter === item} onClick={() => onRangeFilterChange(item)}>
                {item === '全部' ? '全部层次' : item}
              </button>
            ))}
          </div>
        </fieldset>

        <div className={styles.contactsPopoverFooter}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => {
              onFeedbackFilterChange('全部');
              onDeliveryFilterChange('全部');
              onRangeFilterChange('全部');
            }}
          >
            清除筛选
          </button>
          <button type="button" className={styles.primaryButton} onClick={() => closeContactPopover(surfaceRef.current, triggerRef.current)}>
            完成
          </button>
        </div>
      </div>
    </div>
  );
}

const CONTACT_SORT_OPTIONS: { value: ContactSortOption; label: string; description: string }[] = [
  { value: 'updated', label: '最近更新', description: '最近修改的联系人优先' },
  { value: 'lastContact', label: '最近联系', description: '最近沟通过的导师优先' },
  { value: 'school', label: '按高校', description: '按高校名称整理联系人' }
];

function ContactSortPicker({ value, onChange }: { value: ContactSortOption; onChange: (value: ContactSortOption) => void }) {
  const popoverId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const current = CONTACT_SORT_OPTIONS.find((option) => option.value === value) || CONTACT_SORT_OPTIONS[0];
  useDismissContactPopoverOnViewportChange(surfaceRef, open);

  return (
    <div className={styles.contactsToolbarControl}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.contactsToolbarButton}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => {
          if (triggerRef.current && surfaceRef.current) {
            toggleAnchoredContactPopover(triggerRef.current, surfaceRef.current, 286, 238);
          }
        }}
      >
        <ArrowSort20Regular aria-hidden="true" />
        <span>{current.label}</span>
        <ChevronDown20Regular aria-hidden="true" />
      </button>
      <div
        ref={surfaceRef}
        id={popoverId}
        popover="auto"
        role="dialog"
        aria-modal="false"
        aria-label="联系人排序方式"
        className={`${styles.contactsPopoverSurface} ${styles.contactsSortPopover}`}
        onToggle={(event) => {
          const surface = event.currentTarget;
          const nextOpen = surface.matches(':popover-open');
          setOpen(nextOpen);
          if (nextOpen) window.requestAnimationFrame(() => surface.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus({ preventScroll: true }));
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          closeContactPopover(surfaceRef.current, triggerRef.current);
        }}
      >
        <div className={styles.contactsPopoverHeader}>
          <strong>排序方式</strong>
          <span>选择最适合当前联系节奏的顺序。</span>
        </div>
        <div className={styles.contactsSortOptions} role="radiogroup" aria-label="联系人排序方式">
          {CONTACT_SORT_OPTIONS.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={value === option.value}
              tabIndex={value === option.value ? 0 : -1}
              onClick={() => {
                onChange(option.value);
                closeContactPopover(surfaceRef.current, triggerRef.current);
              }}
              onKeyDown={(event) => {
                let nextIndex = index;
                if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = (index + 1) % CONTACT_SORT_OPTIONS.length;
                else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') nextIndex = (index - 1 + CONTACT_SORT_OPTIONS.length) % CONTACT_SORT_OPTIONS.length;
                else if (event.key === 'Home') nextIndex = 0;
                else if (event.key === 'End') nextIndex = CONTACT_SORT_OPTIONS.length - 1;
                else return;
                event.preventDefault();
                onChange(CONTACT_SORT_OPTIONS[nextIndex].value);
                window.requestAnimationFrame(() => surfaceRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus());
              }}
            >
              <span><strong>{option.label}</strong><small>{option.description}</small></span>
              {value === option.value ? <Checkmark20Regular aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyContacts({ desktop, filtered, onCreate, onReset }: { desktop: boolean; filtered: boolean; onCreate: () => void; onReset: () => void }) {
  return (
    <div className={`${styles.emptyState} desktop-contacts-empty`} role="status">
      <div className={styles.emptyInner}>
        <span className={styles.emptyIcon}>{filtered ? <Person20Regular aria-hidden="true" /> : <People24Regular aria-hidden="true" />}</span>
        <h2 className={styles.emptyTitle}>{filtered ? '没有匹配的联系人' : '还没有导师联系人'}</h2>
        <p className={styles.emptyDescription}>{filtered ? '调整筛选后再查看，联系人记录不会被删除。' : '添加第一位导师，集中记录联系渠道、反馈和下一次跟进。'}</p>
        <div className={styles.formActions}>
          {filtered ? <button type="button" className={styles.secondaryButton} onClick={onReset}>清空筛选</button> : null}
          {!filtered || !desktop ? <button type="button" className={styles.primaryButton} onClick={onCreate}><Add20Regular aria-hidden="true" />添加导师</button> : null}
        </div>
      </div>
    </div>
  );
}

function Field({ label, full = false, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`${styles.field} ${full ? styles.fieldFull : ''}`}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}
