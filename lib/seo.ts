export const SITE_URL = 'https://www.seekoffer.com.cn';
export const SITE_NAME = '寻鹿 Seekoffer';
export const SITE_DESCRIPTION = '保研通知、院校信息、竞赛库、申请工作台与资料资源整合平台。';

export function absoluteUrl(path = '/') {
  return new URL(path, SITE_URL).toString();
}

export function jsonLdScript(data: unknown) {
  return {
    __html: JSON.stringify(data).replace(/</g, '\\u003c')
  };
}

export function buildWebSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: ['Seekoffer', '保研通知', '保研通知库'],
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: 'zh-CN',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/notices/?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  };
}

export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl('/logo.png'),
    sameAs: [SITE_URL]
  };
}
