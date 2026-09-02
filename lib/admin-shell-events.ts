export const ADMIN_DASHBOARD_SNAPSHOT_EVENT = 'seekoffer:admin-dashboard-snapshot';

export type AdminDashboardShellSnapshot = {
  pendingNotices: number;
  pendingOffers: number;
  pendingFeedback: number;
  onlineVisitors: number;
  totalVisitors: number;
  todayPageViews: number;
};
