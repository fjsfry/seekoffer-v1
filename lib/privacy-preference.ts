export const ANALYTICS_PREFERENCE_KEY = 'seekoffer-analytics-preference';
export const ANALYTICS_PREFERENCE_EVENT = 'seekoffer-analytics-preference-changed';

export type AnalyticsPreference = 'accepted' | 'declined' | 'unknown';

export function readAnalyticsPreference(): AnalyticsPreference {
  if (typeof window === 'undefined') return 'unknown';
  const value = window.localStorage.getItem(ANALYTICS_PREFERENCE_KEY);
  return value === 'accepted' || value === 'declined' ? value : 'unknown';
}

export function writeAnalyticsPreference(value: Exclude<AnalyticsPreference, 'unknown'>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ANALYTICS_PREFERENCE_KEY, value);
  if (value === 'declined') {
    window.localStorage.removeItem('seekoffer-visitor-id');
    window.sessionStorage.removeItem('seekoffer-session-id');
  }
  window.dispatchEvent(new CustomEvent(ANALYTICS_PREFERENCE_EVENT, { detail: value }));
}
