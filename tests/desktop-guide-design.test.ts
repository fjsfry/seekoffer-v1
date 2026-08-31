import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';
import { applicationJourneyStages } from '../lib/desktop-application-flow';

const root = resolve(import.meta.dirname, '..');
const helpCenterPath = resolve(root, 'app/guide/desktop-help-center.tsx');
const guideContentPath = resolve(root, 'app/guide/desktop-guide.tsx');
const websiteGuidePath = resolve(root, 'app/guide/page.tsx');
const shellPath = resolve(root, 'components/desktop-app-shell.tsx');
const layoutPath = resolve(root, 'app/build-surface.desktop.tsx');
const baseCssPath = resolve(root, 'app/guide/guide.module.css');
const supportCssPath = resolve(root, 'app/desktop-guide-center.css');
const cssPath = resolve(root, 'app/desktop-help-center-v2.css');
const helpCenterSource = readFileSync(helpCenterPath, 'utf8');
const guideContentSource = readFileSync(guideContentPath, 'utf8');
const websiteGuideSource = readFileSync(websiteGuidePath, 'utf8');
const shellSource = readFileSync(shellPath, 'utf8');
const layoutSource = readFileSync(layoutPath, 'utf8');
const baseCssSource = readFileSync(baseCssPath, 'utf8');
const supportCssSource = readFileSync(supportCssPath, 'utf8');
const cssSource = readFileSync(cssPath, 'utf8');
const stylesheet = postcss.parse(cssSource, { from: cssPath });

function declarationsForExact(selector: string) {
  const declarations = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (rule.parent?.type !== 'root' || !rule.selectors.includes(selector)) return;
    rule.walkDecls((declaration: Declaration) => {
      declarations.set(declaration.prop, declaration.value);
    });
  });
  return declarations;
}

function declarationsEndingWith(ending: string, ...fragments: string[]) {
  const declarations = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (
      !rule.selectors.some(
        (selector) =>
          selector.trim().endsWith(ending) &&
          fragments.every((fragment) => selector.includes(fragment))
      )
    ) {
      return;
    }
    rule.walkDecls((declaration: Declaration) => {
      declarations.set(declaration.prop, declaration.value);
    });
  });
  return declarations;
}

function declarationsContaining(...fragments: string[]) {
  const declarations = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.some((selector) => fragments.every((fragment) => selector.includes(fragment)))) {
      return;
    }
    rule.walkDecls((declaration: Declaration) => {
      declarations.set(declaration.prop, declaration.value);
    });
  });
  return declarations;
}

function rootAuthorityDeclarationsEnding(ending: string, ...fragments: string[]) {
  const declarations = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (rule.parent?.type !== 'root') return;
    const selectorMatches = rule.selectors.some(
      (selector) =>
        !selector.includes('[data-zoom-level') &&
        selector.trim().endsWith(ending) &&
        fragments.every((fragment) => selector.includes(fragment))
    );
    if (!selectorMatches) return;
    rule.walkDecls((declaration: Declaration) => {
      declarations.set(declaration.prop, declaration.value);
    });
  });
  return declarations;
}

describe('desktop help and feedback v2 design', () => {
  it('keeps the public website guide unchanged and mounts the desktop-only help center', () => {
    expect(websiteGuideSource).toContain('<SiteShell>');
    expect(websiteGuideSource).not.toContain("'use client'");
    expect(websiteGuideSource).toContain('desktop-guide-layout');
    expect(websiteGuideSource).not.toContain('DesktopHelpCenter');
    expect(shellSource).toContain("import('@/app/guide/desktop-help-center')");
    expect(shellSource).toContain("routePathname === '/guide'");
    expect(shellSource).toContain('<DesktopGuide />');
    expect(helpCenterSource).toContain('export default function DesktopHelpCenter()');
    expect(helpCenterSource).toContain('id="desktop-guide-title" className="desktop-page-header-title">帮助与反馈</h1>');
    expect(layoutSource.indexOf("import './desktop-help-center-v2.css'"))
      .toBeGreaterThan(layoutSource.indexOf("import './desktop-guide-center.css'"));
  });

  it('uses the competitor-backed search-first home instead of a nested permanent sidebar', () => {
    expect(helpCenterSource).toContain('className="desktop-guide-home"');
    expect(helpCenterSource).toContain('className="desktop-guide-featured-grid"');
    expect(helpCenterSource).toContain('className="desktop-guide-directory-list"');
    expect(helpCenterSource).toContain('className="desktop-guide-home-faq-list"');
    expect(helpCenterSource).toContain('className="desktop-guide-support-cta"');
    expect(helpCenterSource).toContain('placeholder="搜索功能、问题或关键词');
    expect(helpCenterSource).toContain('matchingTopics');
    expect(helpCenterSource).toContain('matchingQuestions');
    expect(helpCenterSource).toContain("event.key.toLowerCase() === 'f'");
    expect(helpCenterSource).toContain("event.key === '/'");
    expect(helpCenterSource).toContain('searchInputRef.current?.focus()');
    expect(helpCenterSource).not.toContain('role="tablist"');
    expect(helpCenterSource).not.toContain('desktop-guide-sidebar');
    expect(helpCenterSource).not.toContain('个主题</span>');
  });

  it('switches from the home to a clean article state with deep links and a return action', () => {
    expect(helpCenterSource).toContain('id={`desktop-guide-article-${activeItem.id}`}');
    expect(helpCenterSource).toContain('className="desktop-guide-article"');
    expect(helpCenterSource).toContain('返回帮助中心');
    expect(helpCenterSource).toContain('<GuideTopicContent sectionId={activeItem.id} openQuestion={openQuestion} />');
    expect(helpCenterSource).toContain("window.history.replaceState(window.history.state, '', `#${id}`)");
    expect(helpCenterSource).toContain("window.addEventListener('hashchange', handleHashChange)");
    expect(helpCenterSource).toContain('articleRef.current?.focus({ preventScroll: true })');
    expect(helpCenterSource).toContain('这篇内容是否解决了你的问题？');
    expect(helpCenterSource).toContain('有帮助');
    expect(helpCenterSource).toContain('仍未解决');
    expect(helpCenterSource).toContain('相关帮助');
  });

  it('reuses the canonical application journey and preserves critical product boundaries', () => {
    expect(applicationJourneyStages).toEqual([
      '发现',
      '关注',
      '准备材料',
      '已提交',
      '等待通知',
      '面试/复试',
      '结果'
    ]);
    expect(guideContentSource).toContain('applicationJourneyStages.map');
    expect(guideContentSource).toContain('开启“隐藏截止项目”');
    expect(guideContentSource).toContain('只改变当前列表显示，不会删除申请记录');
    expect(guideContentSource).toContain('学校页面与报名系统为准');
    expect(guideContentSource).toContain('版本备注只保存在当前设备');
    expect(guideContentSource).toContain('Windows 横幅');
    expect(guideContentSource).toContain('仅在寻鹿运行期间请求发送');
  });

  it('implements a progressive support flow before exposing the copy template', () => {
    expect(guideContentSource).toContain("useState<'suggestions' | 'template'>('suggestions')");
    expect(guideContentSource).toContain('可能有用的帮助');
    expect(guideContentSource).toContain('仍未解决，准备反馈');
    expect(guideContentSource).toContain('className="desktop-guide-environment-details"');
    expect(guideContentSource).toContain('内容不会自动上传');
    expect(guideContentSource).toContain('await navigator.clipboard.writeText(feedbackTemplate)');
    expect(guideContentSource).toContain('await navigator.clipboard.writeText(QQ_GROUP_NUMBER)');
    expect(guideContentSource).toContain('role="dialog"');
    expect(guideContentSource).toContain('aria-modal="true"');
    expect(guideContentSource).not.toContain('提交反馈');
    expect(guideContentSource).not.toContain('QQ_GROUP_URL');
  });

  it('uses the established width, shared title and notification-aligned surface rhythm', () => {
    const page = rootAuthorityDeclarationsEnding(
      '.desktop-help-center:is(.desktop-help-center)',
      '.desktop-help-center:is(.desktop-help-center)'
    );
    const hero = rootAuthorityDeclarationsEnding(
      '.desktop-help-hero:is(.desktop-help-hero)',
      '.desktop-help-center:is(.desktop-help-center)',
      '.desktop-help-hero:is(.desktop-help-hero)'
    );
    const title = rootAuthorityDeclarationsEnding(
      '.desktop-guide-hero h1',
      '.desktop-help-center:is(.desktop-help-center)',
      '.desktop-guide-hero h1'
    );
    const home = rootAuthorityDeclarationsEnding(
      ':is(.desktop-guide-home, .desktop-guide-article)',
      '.desktop-help-center:is(.desktop-help-center)',
      '.desktop-guide-home'
    );
    const directory = rootAuthorityDeclarationsEnding(
      '.desktop-guide-directory-list',
      '.desktop-help-center:is(.desktop-help-center)',
      '.desktop-guide-directory-list'
    );
    const section = rootAuthorityDeclarationsEnding(
      '.desktop-guide-home-section',
      '.desktop-help-center:is(.desktop-help-center)',
      '.desktop-guide-home-section'
    );
    const featured = rootAuthorityDeclarationsEnding(
      '.desktop-guide-featured-grid',
      '.desktop-help-center:is(.desktop-help-center)',
      '.desktop-guide-featured-grid'
    );
    const featuredCard = rootAuthorityDeclarationsEnding(
      '.desktop-guide-featured-grid > button',
      '.desktop-help-center:is(.desktop-help-center)',
      '.desktop-guide-featured-grid > button'
    );
    const directoryCard = rootAuthorityDeclarationsEnding(
      '.desktop-guide-directory-list > button',
      '.desktop-help-center:is(.desktop-help-center)',
      '.desktop-guide-directory-list > button'
    );
    const cardIcon = rootAuthorityDeclarationsEnding(
      '> button > span:first-child',
      '.desktop-help-center:is(.desktop-help-center)',
      '.desktop-guide-featured-grid',
      '.desktop-guide-directory-list'
    );
    const cardLayout = rootAuthorityDeclarationsEnding(
      '> button',
      '.desktop-help-center:is(.desktop-help-center)',
      ':is(.desktop-guide-featured-grid, .desktop-guide-directory-list)'
    );
    const supportIcon = rootAuthorityDeclarationsEnding(
      '.desktop-guide-support-cta > span',
      '.desktop-help-center:is(.desktop-help-center)',
      '.desktop-guide-support-cta > span'
    );
    const cardTitle = declarationsContaining(
      '.desktop-guide-featured-grid',
      '.desktop-guide-directory-list',
      '> button strong'
    );

    expect(page.get('width')).toBe('100%');
    expect(page.get('max-width')).toBe('1280px');
    expect(page.get('gap')).toBe('20px');
    expect(page.get('overflow-y')).toBe('auto');
    expect(page.get('height')).toBe('100%');
    expect(hero.get('min-height')).toBe('var(--app-page-header-h, 88px)');
    expect(hero.get('height')).toBe('var(--app-page-header-h, 88px)');
    expect(hero.get('padding')).toBe('14px 20px');
    expect(hero.get('border-radius')).toBe('12px');
    expect(title.get('font-size')).toBe('28px');
    expect(title.get('line-height')).toBe('36px');
    expect(home.get('border-radius')).toBe('var(--product-radius-panel, 12px)');
    expect(section.get('padding')).toBe('20px');
    expect(featured.get('grid-template-columns')).toBe('repeat(3, minmax(0, 1fr))');
    expect(featuredCard.get('min-height')).toBe('132px');
    expect(cardLayout.get('padding')).toBe('20px');
    expect(cardLayout.get('grid-template-columns')).toBe('44px minmax(0, 1fr) 18px');
    expect(featuredCard.get('border-radius')).toBe('var(--product-radius-panel, 12px)');
    expect(directory.get('grid-template-columns')).toBe('repeat(2, minmax(0, 1fr))');
    expect(directory.get('border-radius')).toBe('var(--product-radius-panel, 12px)');
    expect(directoryCard.get('min-height')).toBe('100px');
    expect(directoryCard.get('padding')).toBe('20px');
    expect(cardIcon.get('width')).toBe('44px');
    expect(cardIcon.get('height')).toBe('44px');
    expect(cardIcon.get('align-self')).toBe('start');
    expect(supportIcon.get('width')).toBe('44px');
    expect(supportIcon.get('height')).toBe('44px');
    expect(cardTitle.get('font-size')).toBe('16px');
    expect(cardTitle.get('line-height')).toBe('24px');
    expect(cssSource).not.toContain("[data-guide-tone='blue']");
    expect(cssSource).not.toContain('desktop-guide-topic--active');
  });

  it('uses a distinct, continuous article reading state', () => {
    const article = rootAuthorityDeclarationsEnding(
      ':is(.desktop-guide-home, .desktop-guide-article)',
      '.desktop-help-center:is(.desktop-help-center)',
      '.desktop-guide-article'
    );
    const header = declarationsForExact('.desktop-app-shell:is(.desktop-app-shell) .desktop-guide-article-header');
    const body = declarationsForExact('.desktop-app-shell:is(.desktop-app-shell) .desktop-guide-article-body');
    const footer = declarationsForExact('.desktop-app-shell:is(.desktop-app-shell) .desktop-guide-article-footer');

    expect(article.get('border-radius')).toBe('var(--product-radius-panel, 12px)');
    expect(header.get('width')).toBe('min(900px, 100%)');
    expect(header.get('margin')).toBe('0 auto');
    expect(header.get('padding')).toBe('30px 32px 20px');
    expect(body.get('width')).toBe('min(960px, 100%)');
    expect(body.get('margin')).toBe('0 auto');
    expect(footer.get('border-top')).toContain('1px solid');
  });

  it('uses deterministic high-zoom geometry and the zoom-corrected support drawer', () => {
    const hero = declarationsEndingWith(
      '.desktop-help-center:is(.desktop-help-center) .desktop-help-hero:is(.desktop-help-hero)',
      '[data-density]',
      "data-zoom-level='200'"
    );
    const directory = declarationsContaining(
      '[data-density]',
      "data-zoom-level='200'",
      '.desktop-guide-directory-list'
    );

    expect(hero.get('height')).toBe('auto');
    expect(hero.get('min-height')).toBe('var(--app-page-header-h, 88px)');
    expect(directory.get('grid-template-columns')).toBe('minmax(0, 1fr)');
    expect(supportCssSource).toContain(
      'width: calc(var(--desktop-zoomed-viewport-width, 100vw) - 16px)'
    );
    expect(supportCssSource).toContain(
      'height: calc(var(--desktop-zoomed-viewport-height, 100vh) - 16px)'
    );
  });

  it('keeps shared theme variables, readable type and reduced-motion support', () => {
    for (const variable of [
      '--desktop-surface',
      '--desktop-surface-subtle',
      '--desktop-border',
      '--desktop-text',
      '--desktop-text-secondary',
      '--desktop-accent',
      '--desktop-accent-muted'
    ]) {
      expect(baseCssSource).toContain(`var(${variable}`);
    }

    expect(cssSource).not.toMatch(/(?:linear|radial)-gradient\(/);
    expect(cssSource).not.toMatch(/transition:\s*all\b/);
    expect(cssSource).toContain("data-desktop-reduce-motion='true'");

    const pixelSizes: number[] = [];
    const numericWeights: number[] = [];
    stylesheet.walkDecls((declaration: Declaration) => {
      const value = declaration.value.replace(/\s*!important\s*$/, '').trim();
      if (declaration.prop === 'font-size' && /^\d+(?:\.\d+)?px$/.test(value)) {
        pixelSizes.push(Number.parseFloat(value));
      }
      if (declaration.prop === 'font-weight' && /^\d+$/.test(value)) {
        numericWeights.push(Number(value));
      }
    });

    expect(pixelSizes.length).toBeGreaterThan(0);
    expect(Math.min(...pixelSizes)).toBeGreaterThanOrEqual(12);
    expect(numericWeights.length).toBeGreaterThan(0);
    expect(numericWeights.every((weight) => [400, 600, 700].includes(weight))).toBe(true);
  });
});
