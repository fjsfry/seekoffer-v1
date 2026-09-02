export const SITE_ANNOUNCEMENT = {
  id: 'users-10000-desktop-v022',
  storageKey: 'seekoffer:site-announcement:users-10000-desktop-v022',
  expiresAt: '2026-09-23T23:59:59+08:00',
  badge: '10,000+ 位同学',
  title: '感谢一路同行，寻鹿桌面端现已上线',
  body: '感谢每一位同学的使用与信任。现在，你可以在 Windows 桌面端持续跟进通知、申请进度和关键截止。',
  actionLabel: '了解桌面端',
  actionHref: '/download'
} as const;

export function buildSiteAnnouncementBootstrapScript() {
  const expiration = Date.parse(SITE_ANNOUNCEMENT.expiresAt);
  const storageKey = JSON.stringify(SITE_ANNOUNCEMENT.storageKey);

  return `(function(){try{var dismissed=window.localStorage.getItem(${storageKey});if(dismissed==='dismissed'||Date.now()>${expiration}){document.documentElement.setAttribute('data-seekoffer-announcement-hidden','true');}}catch(error){}})();`;
}
