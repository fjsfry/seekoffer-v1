export const SEEKOFFER_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.seekoffer.com.cn';
export const AUTH_ENABLE_GUEST =
  (process.env.NEXT_PUBLIC_AUTH_ENABLE_GUEST || 'true').toLowerCase() !== 'false';
export const AUTH_ENABLE_PHONE = false;
