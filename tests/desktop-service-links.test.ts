import { describe, expect, it } from 'vitest';
import { desktopServiceLinks, migrateDesktopResourceId } from '../lib/desktop-service-links';

describe('desktop official service hand-offs', () => {
  it('opens the public production pages without carrying desktop or guest order credentials', () => {
    expect(Object.values(desktopServiceLinks).map((href) => {
      const url = new URL(href);
      expect(url.origin).toBe('https://www.seekoffer.com.cn');
      expect(url.username).toBe('');
      expect(url.password).toBe('');
      expect(url.search).toBe('');
      expect(url.hash).toBe('');
      return url.pathname;
    })).toEqual([
      '/resources/complete-application-kit/',
      '/resources/purchases/',
      '/resources/xunlu-autofill/',
      '/pro/'
    ]);
  });

  it('preserves older template favorites and history as the current complete kit', () => {
    for (const id of ['toolkit-resume', 'toolkit-personal-statement', 'toolkit-recommendation-letter']) {
      expect(migrateDesktopResourceId(id)).toBe('toolkit-application-kit');
    }
    const favorites = ['toolkit-resume', 'academic-cnki.net', 'toolkit-recommendation-letter'];
    expect([...new Set(favorites.map(migrateDesktopResourceId))]).toEqual([
      'toolkit-application-kit', 'academic-cnki.net'
    ]);
  });

  it('leaves existing tools and current service identifiers unchanged', () => {
    for (const id of ['toolkit-gpa', 'toolkit-application-kit', 'toolkit-purchases', 'toolkit-autofill', 'official-yz.chsi.com.cn']) {
      expect(migrateDesktopResourceId(id)).toBe(id);
    }
  });
});
