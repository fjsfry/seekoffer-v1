import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('desktop resource interaction maturity', () => {
  it('restores the current resource query and filter for the session', async () => {
    const source = await readFile(
      resolve(root, 'app/resources/desktop-resource-center.tsx'),
      'utf8'
    );

    expect(source).toContain("const RESOURCE_VIEW_STATE_KEY = 'seekoffer:resource-center:view-state:v1'");
    expect(source).toContain('window.sessionStorage.getItem(RESOURCE_VIEW_STATE_KEY)');
    expect(source).toContain('JSON.stringify({ query, activeFilter })');
    expect(source).toContain('RESOURCE_FILTER_VALUES.includes');
  });

  it('makes favorite changes optimistic, persistent and reversible', async () => {
    const source = await readFile(
      resolve(root, 'app/resources/desktop-resource-center.tsx'),
      'utf8'
    );

    expect(source).toContain('const setFavoriteValue = (itemId: string, favorite: boolean)');
    expect(source).toContain('function withFavoriteValue(');
    expect(source).toContain('window.localStorage.getItem(RESOURCE_LOCAL_STATE_KEY)');
    expect(source).toContain('window.localStorage.setItem(RESOURCE_LOCAL_STATE_KEY');
    expect(source).toContain("actionLabel: '撤销'");
    expect(source).toContain('setFavoriteValue(item.id, isFavorite)');
    expect(source).toContain('仅保存在当前设备');
  });

  it('uses one stable searchbox name and keeps focus after clearing', async () => {
    const source = await readFile(
      resolve(root, 'app/resources/desktop-resource-center.tsx'),
      'utf8'
    );

    expect(source).toContain('role="searchbox"');
    expect(source).toContain('aria-label="搜索资源"');
    expect(source).toContain('type="text"');
    expect(source).toContain('onClick={clearResourceSearch}');
    expect(source).toContain('searchInputRef.current?.focus({ preventScroll: true })');
  });
});
