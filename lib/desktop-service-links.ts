/** Official browser hand-offs. Never append desktop sessions or order credentials. */
export const desktopServiceLinks = {
  applicationKit: 'https://www.seekoffer.com.cn/resources/complete-application-kit/',
  purchases: 'https://www.seekoffer.com.cn/resources/purchases/',
  autofill: 'https://www.seekoffer.com.cn/resources/xunlu-autofill/',
  pro: 'https://www.seekoffer.com.cn/pro/'
} as const;

const legacyTemplateIds = new Set([
  'toolkit-resume',
  'toolkit-personal-statement',
  'toolkit-recommendation-letter'
]);

/** Keep existing favorites and recent history when the three templates become one kit. */
export function migrateDesktopResourceId(id: string) {
  return legacyTemplateIds.has(id) ? 'toolkit-application-kit' : id;
}
