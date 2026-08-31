import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..');
const layoutSource = readFileSync(resolve(projectRoot, 'app/build-surface.desktop.tsx'), 'utf8');
const flagshipPath = resolve(projectRoot, 'app/desktop-flagship.css');
const flagshipExists = existsSync(flagshipPath);
const flagshipSource = flagshipExists ? readFileSync(flagshipPath, 'utf8') : '';
const stylesheet = postcss.parse(flagshipSource, { from: flagshipPath });

function selectors() {
  const values: string[] = [];
  stylesheet.walkRules((rule: Rule) => {
    values.push(...rule.selectors);
  });
  return values;
}

function hasSelector(fragment: string) {
  return selectors().some((selector) => selector.includes(fragment));
}

function declarationsForExact(selector: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.includes(selector)) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

function declarationsCovering(
  fragment: string,
  options: { includeResponsive?: boolean; includeStates?: boolean } = {}
) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    const matchingSelectors = rule.selectors.filter((selector) => selector.includes(fragment));
    if (!matchingSelectors.length) return;
    if (
      !options.includeResponsive &&
      matchingSelectors.every((selector) => /\[(?:data-zoom-level|data-layout-mode)/.test(selector))
    ) {
      return;
    }
    if (
      !options.includeStates &&
      matchingSelectors.every((selector) =>
        /:(?:hover|focus|focus-visible|active|disabled)|\[(?:aria-current|aria-disabled|data-state)/.test(
          selector
        )
      )
    ) {
      return;
    }
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

function declarationsForSelectorSuffix(fragment: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.some((selector) => selector.trim().endsWith(fragment))) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

function highZoomDeclarations(fragment: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (
      !rule.selectors.some(
        (selector) =>
          selector.includes(fragment) &&
          /data-zoom-level='(?:150|175|200)'/.test(selector)
      )
    ) {
      return;
    }
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

function rootTokens() {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (
      !rule.selectors.some(
        (selector) =>
          selector === ':root' ||
          selector === '.desktop-app-shell' ||
          selector.includes(':is(.desktop-app-shell') ||
          selector.includes(':where(.desktop-app-shell')
      )
    ) {
      return;
    }
    rule.walkDecls(/^--(?:desktop|so)-/, (declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

function px(value: string | undefined) {
  const match = value?.trim().match(/^(-?\d+(?:\.\d+)?)px$/);
  return match ? Number(match[1]) : Number.NaN;
}

function resolveTokenValue(
  property: string,
  tokens: Map<string, string>,
  visited = new Set<string>()
): string | undefined {
  if (visited.has(property)) return undefined;
  visited.add(property);
  const value = tokens.get(property)?.trim();
  if (!value) return undefined;
  const reference = value.match(/^var\((--(?:desktop|so)-[^),\s]+)\)$/)?.[1];
  return reference ? resolveTokenValue(reference, tokens, visited) : value;
}

function usesOneOfTokens(value: string | undefined, tokens: string[]) {
  return tokens.some((token) => value?.includes(`var(${token})`));
}

function rulesForAtRule(name: string, params: RegExp) {
  const values: string[] = [];
  stylesheet.walkAtRules(name, (atRule) => {
    if (!params.test(atRule.params)) return;
    atRule.walkRules((rule: Rule) => {
      values.push(...rule.selectors);
    });
  });
  return values;
}

describe('SeekOffer desktop flagship design contract', () => {
  it('loads route authorities and the final coherence layer after historical desktop styles', () => {
    const imports = [
      ...layoutSource.matchAll(/import ['"]\.\/(desktop[^'"]*\.css)['"];?/g)
    ].map((match) => match[1]);

    expect(flagshipExists).toBe(true);
    expect(imports).toEqual([
      'desktop.css',
      'desktop-mature.css',
      'desktop-interactions.css',
      'desktop-qq.css',
      'desktop-mchose.css',
      'desktop-flagship.css',
      'desktop-notice-alignment.css',
      'desktop-resource-center.css',
      'desktop-guide-center.css',
      'desktop-help-center-v2.css',
      'desktop-app-coherence.css'
    ]);
    expect(flagshipSource).not.toMatch(/@import\s+url\s*\(\s*['"]?https?:/i);
    expect(flagshipSource).not.toMatch(/url\s*\(\s*['"]?https?:/i);
    expect(flagshipSource).not.toMatch(/(?:mchose\.com|im\.qq\.com|qpic\.cn)/i);
    expect(
      selectors().filter((selector) => /(^|\n)\s*@(?:media|supports|container)\b/.test(selector)),
      'at-rules must never be embedded inside a selector list'
    ).toEqual([]);

    const unsafeTransitions: string[] = [];
    stylesheet.walkDecls(/^transition(?:-property)?$/, (declaration) => {
      if (/(^|,)\s*all(?:\s|,|$)/.test(declaration.value)) {
        unsafeTransitions.push(declaration.toString());
      }
    });
    expect(unsafeTransitions).toEqual([]);
  });

  it('defines a reusable type, spacing, control, radius, motion and focus token system', () => {
    const tokens = rootTokens();
    const requiredTokens = [
      '--desktop-ui-font',
      '--desktop-type-title',
      '--desktop-type-body',
      '--desktop-type-caption',
      '--desktop-line-height-body',
      '--desktop-control-height',
      '--desktop-control-height-compact',
      '--desktop-radius-control',
      '--desktop-radius-panel',
      '--desktop-space-unit',
      '--desktop-motion-fast',
      '--desktop-motion-standard',
      '--desktop-ease-standard',
      '--desktop-focus-ring'
    ];

    for (const token of requiredTokens) {
      expect(tokens.get(token), `${token} must be defined by the flagship layer`).toBeTruthy();
    }

    expect(px(resolveTokenValue('--desktop-control-height', tokens))).toBeGreaterThanOrEqual(38);
    expect(px(resolveTokenValue('--desktop-control-height', tokens))).toBeLessThanOrEqual(48);
    expect(px(resolveTokenValue('--desktop-control-height-compact', tokens))).toBeGreaterThanOrEqual(36);
    expect(px(resolveTokenValue('--desktop-control-height-compact', tokens))).toBeLessThanOrEqual(40);
    expect(px(resolveTokenValue('--desktop-radius-control', tokens))).toBeGreaterThanOrEqual(4);
    expect(px(resolveTokenValue('--desktop-radius-control', tokens))).toBeLessThanOrEqual(12);
    expect(px(resolveTokenValue('--desktop-radius-panel', tokens))).toBeGreaterThanOrEqual(
      px(resolveTokenValue('--desktop-radius-control', tokens))
    );
    expect(px(resolveTokenValue('--desktop-radius-panel', tokens))).toBeLessThanOrEqual(20);

    const shell = declarationsForExact('.desktop-app-shell');
    expect(shell.get('font-family')).toContain('var(--desktop-ui-font)');
    expect(shell.get('font-size')).toContain('var(--desktop-type-body)');
    expect(shell.get('line-height')).toContain('var(--desktop-line-height-body)');

    for (const target of [
      '.desktop-primary-command',
      '.desktop-secondary-command',
      '.desktop-setting-select'
    ]) {
      const control = declarationsCovering(target);
      expect(
        usesOneOfTokens(control.get('min-height'), [
          '--desktop-control-height',
          '--so-control-h'
        ]),
        `${target} must use the shared control height`
      ).toBe(true);
      expect(
        usesOneOfTokens(control.get('border-radius'), [
          '--desktop-radius-control',
          '--so-radius-control'
        ]),
        `${target} must use the shared control radius`
      ).toBe(true);
    }
  });

  it('owns the QQ-like left rail and one bounded right-side work surface in the final cascade', () => {
    const shell = declarationsForExact('.desktop-app-shell');
    const rail = declarationsCovering('.desktop-primary-rail');
    const nav = declarationsCovering('.desktop-nav-list--primary');
    const content = declarationsCovering('.desktop-content-region');
    const stage = declarationsCovering('.desktop-view-stage');

    expect(shell.get('display')).toBe('grid');
    expect(shell.get('grid-template-columns')).toMatch(
      /var\(--(?:desktop-rail-width|so-rail-w)\)\s+minmax\(0,\s*1fr\)/
    );
    expect(shell.get('grid-template-rows')).toMatch(
      /var\(--(?:desktop-titlebar-height|so-titlebar-h)\)\s+minmax\(0,\s*1fr\)/
    );
    expect(rail.get('grid-column')).toBe('1');
    expect(rail.get('grid-row')).toBe('2');
    expect(rail.get('display')).toBe('flex');
    expect(rail.get('flex-direction')).toBe('column');
    expect(rail.get('overflow')).toBe('hidden');
    expect(nav.get('overflow-y')).toBe('auto');
    expect(nav.get('overscroll-behavior')).toBe('contain');
    expect(content.get('grid-column')).toBe('2');
    expect(content.get('grid-row')).toBe('2');
    expect(content.get('min-width')).toBe('0');
    expect(content.get('min-height')).toBe('0');
    expect(content.get('overflow')).toBe('hidden');
    expect(stage.get('width')).toBe('100%');
    expect(stage.get('height')).toBe('100%');
    expect(stage.get('min-width')).toBe('0');
    expect(stage.get('min-height')).toBe('0');
    expect(stage.get('overflow')).toMatch(/^(?:auto|hidden)$/);
    expect(
      usesOneOfTokens(stage.get('border-radius'), [
        '--desktop-radius-panel',
        '--so-radius-card',
        '--so-radius-popup'
      ])
    ).toBe(true);
  });

  it('keeps the application master and detail panes aligned and independently scrollable', () => {
    const layout = declarationsCovering('.desktop-qq-workbench-layout');
    const projectList = declarationsCovering('.desktop-project-table-body');
    const projectDetail = declarationsCovering('.desktop-project-workspace-body');

    expect(layout.get('height')).toBe('100%');
    expect(layout.get('min-height')).toBe('0');
    expect(layout.get('grid-template-rows')).toBe('minmax(0, 1fr)');
    expect(layout.get('overflow')).toBe('hidden');
    expect(layout.get('align-items')).toBe('stretch');

    for (const [label, declarations] of [
      ['application list', projectList],
      ['project detail', projectDetail]
    ] as const) {
      expect(declarations.get('min-height'), `${label} must be shrinkable`).toBe('0');
      expect(declarations.get('overflow-y'), `${label} must own its vertical scroll`).toBe('auto');
      expect(declarations.get('overscroll-behavior'), `${label} must contain wheel scrolling`).toBe(
        'contain'
      );
      expect(declarations.get('scrollbar-gutter'), `${label} must not shift when a scrollbar appears`).toContain(
        'stable'
      );
    }
  });

  it('visually covers every core route and every asynchronous state instead of only the workbench', () => {
    const coreSurfaces = [
      '.desktop-qq-workbench',
      '#schedule-board',
      '#contacts-board',
      '.desktop-notice-library',
      '.desktop-college-hero',
      '.desktop-resource-hero',
      '.desktop-settings-page',
      '.desktop-auth-shell',
      '.desktop-reminder-center',
      '.desktop-command-dialog'
    ];
    const asyncStates = [
      '.desktop-workbench-loading-state',
      '.desktop-project-empty',
      '.desktop-workbench-error-state',
      '.desktop-notice-loading',
      '.desktop-notice-side-loading',
      '.desktop-reminder-state',
      '.desktop-route-error'
    ];

    for (const selector of [...coreSurfaces, ...asyncStates]) {
      expect(hasSelector(selector), `${selector} must be covered by desktop-flagship.css`).toBe(true);
    }

    for (const selector of asyncStates) {
      const state = declarationsForSelectorSuffix(selector);
      expect(state.get('border-radius'), `${selector} must share the flagship radius system`).toContain(
        'var(--desktop-radius-'
      );
    }
  });

  it('restores reminder row title, body and time hierarchy in the final cascade', () => {
    const title = declarationsForExact('.desktop-app-shell .desktop-reminder-item h4');
    const supportingCopy = declarationsForExact('.desktop-app-shell .desktop-reminder-item p');

    expect(title.get('font-size')).toBe('14px');
    expect(title.get('font-weight')).toBe('600');
    expect(title.get('line-height')).toBe('20px');
    expect(supportingCopy.get('font-size')).toBe('12px');
    expect(supportingCopy.get('line-height')).toBe('18px');
  });

  it('provides visible hover, keyboard focus, pressed and disabled states without motion traps', () => {
    const allSelectors = selectors();
    const focusSelectors = allSelectors.filter((selector) => selector.includes(':focus-visible'));
    const pressedSelectors = allSelectors.filter(
      (selector) => selector.includes(':active') || selector.includes("[aria-pressed='true']")
    );
    const disabledSelectors = allSelectors.filter(
      (selector) => selector.includes(':disabled') || selector.includes("[aria-disabled='true']")
    );

    expect(allSelectors.some((selector) => selector.includes(':hover'))).toBe(true);
    expect(focusSelectors.length).toBeGreaterThan(0);
    expect(pressedSelectors.length).toBeGreaterThan(0);
    expect(disabledSelectors.length).toBeGreaterThan(0);
    expect(
      allSelectors.some(
        (selector) =>
          selector.includes("[aria-current='page']") ||
          selector.includes('.desktop-primary-nav-item--active')
      )
    ).toBe(true);

    expect(
      focusSelectors.some((selector) => {
        const focus = declarationsForExact(selector);
        return `${focus.get('outline') || ''} ${focus.get('box-shadow') || ''}`.includes(
          'var(--desktop-focus-ring)'
        );
      })
    ).toBe(true);

    const loginInputFocus = declarationsForExact(
      '.desktop-auth-shell .desktop-login-field input:focus-visible'
    );
    expect(loginInputFocus.get('outline')).toBe('none');
    expect(loginInputFocus.get('box-shadow')).toBe('none');

    const loginFieldFocus = declarationsForExact(
      '.desktop-auth-shell .desktop-login-field:focus-within'
    );
    expect(loginFieldFocus.get('box-shadow')).toContain('var(--desktop-focus-ring)');

    const disabled = declarationsCovering(':disabled', { includeStates: true });
    expect(Number(disabled.get('opacity'))).toBeLessThan(1);
    expect(disabled.get('cursor')).toBe('not-allowed');

    const reducedMotionSelectors = rulesForAtRule('media', /prefers-reduced-motion\s*:\s*reduce/i);
    expect(reducedMotionSelectors.length).toBeGreaterThan(0);
    expect(flagshipSource).toContain("html[data-desktop-reduce-motion='true']");
  });

  it('keeps navigation, workbench, overlays and settings usable at 150%, 175% and 200%', () => {
    for (const zoom of ['150', '175', '200']) {
      expect(flagshipSource).toContain(`[data-zoom-level='${zoom}']`);
    }

    const highZoomSelectors = selectors()
      .filter((selector) => /data-zoom-level='(?:150|175|200)'/.test(selector))
      .join('\n');
    for (const surface of [
      '.desktop-primary-rail',
      '.desktop-content-region',
      '.desktop-qq-workbench',
      '.desktop-settings-layout',
      '.desktop-reminder-center'
    ]) {
      expect(highZoomSelectors, `${surface} needs an explicit high-zoom rule`).toContain(surface);
    }

    for (const zoom of ['150', '175', '200']) {
      expect(flagshipSource).toContain(`[data-desktop-zoom-level='${zoom}']`);
    }
    const authHighZoomSelectors = selectors()
      .filter((selector) => /data-desktop-zoom-level='(?:150|175|200)'/.test(selector))
      .join('\n');
    for (const surface of [
      '.desktop-auth-shell',
      '.desktop-auth-titlebar',
      '.desktop-auth-form-region',
      '.desktop-login-method-panel'
    ]) {
      expect(authHighZoomSelectors, `${surface} needs an explicit login high-zoom rule`).toContain(surface);
    }

    const compactNav = highZoomDeclarations('.desktop-primary-nav-item');
    const tokens = rootTokens();
    const compactTokenSize = px(resolveTokenValue('--desktop-control-height-compact', tokens));
    const compactWidth = usesOneOfTokens(compactNav.get('min-width'), [
      '--desktop-control-height-compact'
    ])
      ? compactTokenSize
      : px(compactNav.get('min-width'));
    const compactHeight = usesOneOfTokens(compactNav.get('min-height'), [
      '--desktop-control-height-compact'
    ])
      ? compactTokenSize
      : px(compactNav.get('min-height'));
    expect(compactWidth).toBeGreaterThanOrEqual(36);
    expect(compactHeight).toBeGreaterThanOrEqual(36);
  });
});
