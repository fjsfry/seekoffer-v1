import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..');
const cssPath = resolve(projectRoot, 'app/desktop-flagship.css');
const cssSource = readFileSync(cssPath, 'utf8');
const stylesheet = postcss.parse(cssSource, { from: cssPath });
const coherenceSource = readFileSync(resolve(projectRoot, 'app/desktop-app-coherence.css'), 'utf8');
const parityStart = coherenceSource.indexOf('/* FINAL NOTICE-LIBRARY PARITY AUTHORITY');
const parityEnd = coherenceSource.indexOf('/* END FINAL NOTICE-LIBRARY PARITY AUTHORITY */', parityStart);
const parityCss = coherenceSource.slice(parityStart, parityEnd);

const readabilityStart = cssSource.indexOf('/* Final readability and breathing-room authority.');
const followingResourceAuthority = cssSource.indexOf('/* Image2 resource-directory visual authority');

function ruleContaining(fragment: string, property?: string, value?: string) {
  let match: Rule | undefined;
  stylesheet.walkRules((rule: Rule) => {
    if (match || !rule.selectors.some((selector) => selector.includes(fragment))) return;
    if (property && !rule.nodes.some((node) => node.type === 'decl' && node.prop === property && (!value || node.value.includes(value)))) return;
    match = rule;
  });
  return match;
}

function lastRuleContaining(fragment: string, property?: string, value?: string) {
  let match: Rule | undefined;
  stylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.some((selector) => selector.includes(fragment))) return;
    if (property && !rule.nodes.some((node) => node.type === 'decl' && node.prop === property && (!value || node.value.includes(value)))) return;
    match = rule;
  });
  return match;
}

function declarationMap(rule: Rule | undefined) {
  const values = new Map<string, string>();
  rule?.walkDecls((declaration: Declaration) => {
    values.set(declaration.prop, declaration.value.replace(/\s*!important\s*$/, '').trim());
  });
  return values;
}

function classSpecificity(selector: string) {
  return (selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length;
}

describe('desktop readability and density calibration', () => {
  it('stays inside the existing flagship layer and wins later resource rules by specificity', () => {
    expect(readabilityStart).toBeGreaterThan(0);
    expect(followingResourceAuthority).toBeGreaterThan(readabilityStart);
    expect(cssSource).not.toContain('desktop-readability.css');

    const readableTitle = ruleContaining(
      ':is(.desktop-resource-tool-copy, .desktop-resource-link-copy):is',
      'font-size',
      '15px'
    );
    const laterCompactTitle = [...stylesheet.nodes]
      .filter((node): node is Rule => node.type === 'rule')
      .find(
        (rule) =>
          (rule.source?.start?.offset ?? 0) > followingResourceAuthority &&
          rule.selectors.some((selector) =>
            selector.includes(':is(.desktop-resource-tool-copy, .desktop-resource-link-copy) strong')
          )
      );

    expect(readableTitle).toBeTruthy();
    expect(laterCompactTitle).toBeTruthy();
    expect(classSpecificity(readableTitle!.selectors[0])).toBeGreaterThan(
      classSpecificity(laterCompactTitle!.selectors[0])
    );
  });

  it('uses larger application rows without making density a readability tradeoff', () => {
    const description = declarationMap(
      lastRuleContaining(
        '.desktop-app-shell:is(.desktop-app-shell) .desktop-application-object-copy p',
        'display',
        'none'
      )
    );
    const material = declarationMap(
      ruleContaining('.desktop-app-shell:is(.desktop-app-shell) .desktop-project-workspace-checklist > .desktop-project-material-row')
    );

    expect(parityStart).toBeGreaterThanOrEqual(0);
    expect(parityEnd).toBeGreaterThan(parityStart);
    expect(parityCss).toMatch(
      /\.desktop-application-object-row\s*\{[\s\S]*?height:\s*auto[\s\S]*?min-height:\s*218px[\s\S]*?max-height:\s*none[\s\S]*?padding:\s*20px[\s\S]*?border-radius:\s*18px/,
    );
    expect(parityCss).toMatch(
      /\.desktop-application-object-copy strong\s*\{[\s\S]*?font-size:\s*20px[\s\S]*?font-weight:\s*600[\s\S]*?line-height:\s*30px/,
    );
    expect(description.get('display')).toBe('none');
    expect(material.get('min-height')).toBe('60px');
    expect(material.get('font-size')).toBe('14px');
  });

  it('gives resources, settings and secondary workflows readable rhythm', () => {
    const resourceTool = declarationMap(
      ruleContaining('.desktop-app-shell:is(.desktop-app-shell) .desktop-resource-tool-card')
    );
    const resourceLink = declarationMap(
      ruleContaining('.desktop-app-shell:is(.desktop-app-shell) .desktop-resource-link', 'min-height', '86px')
    );
    const resourceTitle = declarationMap(
      ruleContaining(':is(.desktop-resource-tool-copy, .desktop-resource-link-copy):is', 'font-size', '15px')
    );
    const settingRow = declarationMap(
      ruleContaining('.desktop-setting-row', 'min-height', '80px')
    );
    const reading = declarationMap(
      ruleContaining('.desktop-app-shell:is(.desktop-app-shell) .desktop-reading-page')
    );
    const scheduleRow = declarationMap(
      ruleContaining('.desktop-app-shell:is(.desktop-app-shell) .desktop-schedule-row > div:first-child')
    );
    const contactRow = declarationMap(
      ruleContaining('.desktop-app-shell:is(.desktop-app-shell) .desktop-contacts-row-trigger')
    );

    expect(resourceTool.get('min-height')).toBe('88px');
    expect(resourceLink.get('min-height')).toBe('86px');
    expect(resourceTitle.get('font-size')).toBe('15px');
    expect(settingRow.get('min-height')).toBe('80px');
    expect(reading.get('font-size')).toBe('15px');
    expect(reading.get('line-height')).toBe('26px');
    expect(scheduleRow.get('min-height')).toBe('78px');
    expect(contactRow.get('min-height')).toBe('82px');
  });

  it('retains explicit single-column and overflow-safe high-zoom fallbacks', () => {
    const zoomLayout = declarationMap(
      ruleContaining('.desktop-guide-layout', 'grid-template-columns', 'minmax(0, 1fr)')
    );
    const zoomSettings = declarationMap(
      ruleContaining('.desktop-settings-layout', 'grid-template-rows', '48px minmax(0, 1fr)')
    );
    const overflowGuard = ruleContaining("[data-zoom-level='150']", 'overflow-x', 'hidden');

    expect(zoomLayout.get('grid-template-columns')).toBe('minmax(0, 1fr)');
    expect(zoomSettings.get('grid-template-rows')).toBe('48px minmax(0, 1fr)');
    expect(overflowGuard).toBeTruthy();
    expect(cssSource).not.toMatch(/font-size:\s*(?:9|11|11\.5)px/);
    expect(cssSource).not.toMatch(/(?:linear|radial)-gradient\(/);
    expect(cssSource).not.toMatch(/transition:\s*all\b/);
  });
});
