import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';
import {
  DESKTOP_WORKBENCH_KEYBOARD_LARGE_STEP,
  DESKTOP_WORKBENCH_KEYBOARD_STEP,
  DESKTOP_WORKBENCH_MAX_LEFT_WIDTH,
  DESKTOP_WORKBENCH_MIN_LEFT_WIDTH,
  DESKTOP_WORKBENCH_MIN_RIGHT_WIDTH,
  DESKTOP_WORKBENCH_PANE_PREFERENCE_KEY,
  clampDesktopWorkbenchLeftPaneWidth,
  getDesktopWorkbenchKeyboardPaneWidth,
  getDesktopWorkbenchPaneBounds,
  parseDesktopWorkbenchPanePreference,
  readDesktopWorkbenchPanePreference,
  writeDesktopWorkbenchPanePreference
} from '@/lib/desktop-workbench-splitter';

const projectRoot = resolve(import.meta.dirname, '..');
const homeSource = readFileSync(resolve(projectRoot, 'components/desktop-home.tsx'), 'utf8');
const flagshipSource = readFileSync(resolve(projectRoot, 'app/desktop-flagship.css'), 'utf8');
const layoutSource = readFileSync(resolve(projectRoot, 'app/build-surface.desktop.tsx'), 'utf8');
const stylesheet = postcss.parse(flagshipSource, { from: 'app/desktop-flagship.css' });

function declarations(fragment: string, exact = false) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.some((selector) => exact ? selector === fragment : selector.includes(fragment))) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

function createMemoryStorage(initialValue: string | null = null) {
  let value = initialValue;
  return {
    getItem(key: string) {
      return key === DESKTOP_WORKBENCH_PANE_PREFERENCE_KEY ? value : null;
    },
    setItem(key: string, nextValue: string) {
      if (key === DESKTOP_WORKBENCH_PANE_PREFERENCE_KEY) value = nextValue;
    },
    value() {
      return value;
    }
  };
}

describe('desktop workbench resizable splitter', () => {
  it('clamps the master pane against both a mature list minimum and the detail minimum', () => {
    expect(DESKTOP_WORKBENCH_MIN_LEFT_WIDTH).toBeGreaterThanOrEqual(320);
    expect(DESKTOP_WORKBENCH_MIN_LEFT_WIDTH).toBeLessThanOrEqual(340);
    expect(DESKTOP_WORKBENCH_MIN_RIGHT_WIDTH).toBeGreaterThanOrEqual(560);

    expect(getDesktopWorkbenchPaneBounds(1_000)).toEqual({
      min: DESKTOP_WORKBENCH_MIN_LEFT_WIDTH,
      max: 1_000 - DESKTOP_WORKBENCH_MIN_RIGHT_WIDTH
    });
    expect(getDesktopWorkbenchPaneBounds(1_600).max).toBe(
      DESKTOP_WORKBENCH_MAX_LEFT_WIDTH
    );
    expect(clampDesktopWorkbenchLeftPaneWidth(100, 1_000)).toBe(
      DESKTOP_WORKBENCH_MIN_LEFT_WIDTH
    );
    expect(clampDesktopWorkbenchLeftPaneWidth(900, 1_000)).toBe(
      1_000 - DESKTOP_WORKBENCH_MIN_RIGHT_WIDTH
    );
    expect(clampDesktopWorkbenchLeftPaneWidth(Number.NaN, 1_200)).toBe(
      getDesktopWorkbenchPaneBounds(1_200).max
    );
  });

  it('supports small and large arrow steps plus Home and End', () => {
    const request = {
      currentWidth: 400,
      layoutWidth: 1_400,
      shiftKey: false
    };
    expect(getDesktopWorkbenchKeyboardPaneWidth({ ...request, key: 'ArrowLeft' })).toBe(
      400 - DESKTOP_WORKBENCH_KEYBOARD_STEP
    );
    expect(getDesktopWorkbenchKeyboardPaneWidth({ ...request, key: 'ArrowRight' })).toBe(
      400 + DESKTOP_WORKBENCH_KEYBOARD_STEP
    );
    expect(
      getDesktopWorkbenchKeyboardPaneWidth({
        ...request,
        key: 'ArrowRight',
        shiftKey: true
      })
    ).toBe(400 + DESKTOP_WORKBENCH_KEYBOARD_LARGE_STEP);
    expect(getDesktopWorkbenchKeyboardPaneWidth({ ...request, key: 'Home' })).toBe(
      DESKTOP_WORKBENCH_MIN_LEFT_WIDTH
    );
    expect(getDesktopWorkbenchKeyboardPaneWidth({ ...request, key: 'End' })).toBe(
      getDesktopWorkbenchPaneBounds(request.layoutWidth).max
    );
    expect(getDesktopWorkbenchKeyboardPaneWidth({ ...request, key: 'Enter' })).toBeNull();
  });

  it('persists a versioned preference and ignores malformed or stale records', () => {
    const storage = createMemoryStorage();
    expect(writeDesktopWorkbenchPanePreference(storage, 472)).toBe(true);
    expect(JSON.parse(storage.value() || '{}')).toEqual({
      version: 1,
      leftPaneWidth: 472
    });
    expect(readDesktopWorkbenchPanePreference(storage)).toBe(472);
    expect(parseDesktopWorkbenchPanePreference('{"version":2,"leftPaneWidth":500}')).toBeNull();
    expect(parseDesktopWorkbenchPanePreference('{broken')).toBeNull();
    expect(writeDesktopWorkbenchPanePreference(storage, Number.NaN)).toBe(false);
  });

  it('uses pointer capture, keyboard controls and complete separator ARIA in the source', () => {
    expect(homeSource).toContain('role="separator"');
    expect(homeSource).toContain('aria-orientation="vertical"');
    expect(homeSource).toContain('aria-valuemin={splitterBounds.min}');
    expect(homeSource).toContain('aria-valuemax={splitterBounds.max}');
    expect(homeSource).toContain('aria-valuenow={masterPaneWidth}');
    expect(homeSource).toContain('setPointerCapture(event.pointerId)');
    expect(homeSource).toContain('releasePointerCapture(event.pointerId)');
    expect(homeSource).toContain('onDoubleClick={resetWorkbenchPaneWidth}');
    expect(homeSource).toContain('onKeyDown={handleSplitterKeyDown}');
    expect(homeSource).toContain('!compactInspector ? (');
  });

  it('wins the final cascade with an overlay hit target and no horizontal overflow', () => {
    expect(layoutSource.indexOf("'./desktop-flagship.css'"))
      .toBeGreaterThan(layoutSource.indexOf("'./desktop-mchose.css'"));

    const layout = declarations('.desktop-app-shell .desktop-workbench-layout');
    const splitter = declarations('.desktop-app-shell .desktop-workbench-splitter', true);
    const drawerSplitter = declarations("[data-layout-mode='drawer'] .desktop-workbench-splitter");

    expect(layout.get('position')).toBe('relative');
    expect(layout.get('overflow')).toBe('hidden');
    expect(layout.get('grid-template-columns')).toContain('var(--desktop-master-width)');
    expect(splitter.get('position')).toBe('absolute');
    expect(splitter.get('left')).toContain('--desktop-master-width');
    expect(splitter.get('cursor')).toBe('col-resize');
    expect(splitter.get('touch-action')).toBe('none');
    expect(drawerSplitter.get('display')).toBe('none');
    expect(drawerSplitter.get('pointer-events')).toBe('none');
  });
});
