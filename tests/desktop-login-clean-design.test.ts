import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..');
const flagshipSource = readFileSync(resolve(projectRoot, 'app/desktop-flagship.css'), 'utf8');
const loginScreenSource = readFileSync(
  resolve(projectRoot, 'components/desktop-login-screen.tsx'),
  'utf8'
);
const loginPanelSource = readFileSync(
  resolve(projectRoot, 'components/login-method-panel.tsx'),
  'utf8'
);
const marker = '/* Image2 clean-auth visual authority';
const cleanAuthSource = flagshipSource.slice(flagshipSource.indexOf(marker));
const stylesheet = postcss.parse(cleanAuthSource, { from: 'app/desktop-flagship.css' });

function declarationsForExact(selector: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (rule.parent?.type !== 'root' || !rule.selectors.includes(selector)) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

describe('desktop clean login design', () => {
  it('keeps the normal login card compact and delegates overflow to the stage', () => {
    expect(flagshipSource.indexOf(marker)).toBeGreaterThan(0);

    const stage = declarationsForExact('.desktop-login-shell .desktop-login-stage');
    const formRegion = declarationsForExact('.desktop-login-shell .desktop-auth-form-region');
    const card = declarationsForExact('.desktop-auth-shell .desktop-login-method-panel');
    const field = declarationsForExact('.desktop-auth-shell .desktop-login-field');
    const primary = declarationsForExact(
      ".desktop-auth-shell .desktop-login-method-panel button.desktop-login-primary[type='submit']"
    );

    expect(stage.get('grid-template-rows')).toBe('minmax(0, 1fr)');
    expect(formRegion.get('overflow-x')).toBe('hidden');
    expect(formRegion.get('overflow-y')).toBe('auto');
    expect(card.get('width')).toBe('min(438px, 100%)');
    expect(card.get('max-height')).toBe('none');
    expect(card.get('overflow')).toBe('visible');
    expect(field.get('height')).toBe('46px');
    expect(primary.get('min-height')).toBe('46px');
    expect(primary.get('font-weight')).toBe('600');
    expect(cleanAuthSource).not.toMatch(/\.desktop-login-method-panel[^{}]*\{[^}]*overflow-y:\s*auto/i);
  });

  it('uses one integrated hierarchy instead of a detached security strip', () => {
    const desktopBranch = loginPanelSource.slice(
      loginPanelSource.indexOf("if (mode === 'desktop')"),
      loginPanelSource.indexOf('\n  return (', loginPanelSource.indexOf("if (mode === 'desktop')"))
    );

    expect(loginScreenSource).not.toContain('desktop-auth-trust');
    expect(desktopBranch).toContain('desktop-login-security-note');
    expect(desktopBranch).toContain('继续管理你的申请、材料与截止提醒');
    expect(desktopBranch).toContain('<span>{desktopSubmitBusy ? \'正在处理…\' : desktopActionLabel}</span>');
    expect(desktopBranch).not.toContain('<ArrowRight aria-hidden="true" />');
    expect(declarationsForExact('.desktop-auth-shell .desktop-login-security-note').get('border-top'))
      .toContain('var(--so-border)');
  });

  it('retains complete keyboard, pending, feedback and verification-code behavior', () => {
    expect(loginPanelSource).toContain('role="tablist"');
    expect(loginPanelSource).toContain("role={!registering ? 'tabpanel' : undefined}");
    expect(loginPanelSource).toContain("['ArrowLeft', 'ArrowRight', 'Home', 'End']");
    expect(loginPanelSource).toContain('if (pending) return;');
    expect(loginPanelSource).toContain('disabled={Boolean(pending) || resendIn > 0 || !isEmailAccount}');
    expect(loginPanelSource).toContain("pending === 'send-code' ? <LoaderCircle");
    expect(loginPanelSource).toContain('role="status"');
    expect(loginPanelSource).toContain('role="alert"');
    expect(loginPanelSource).toContain('aria-busy={Boolean(pending)}');
    expect(loginPanelSource).toContain('aria-describedby={message || error');
    expect(loginPanelSource).toContain('desktop-login-feedback-slot');
    expect(loginPanelSource).toContain("errorField === 'account'");
    expect(loginPanelSource).toContain("errorField === 'password'");
    expect(loginPanelSource).toContain("errorField === 'passwordConfirm'");
    expect(loginPanelSource).toContain("errorField === 'code'");
    expect(loginPanelSource).toContain('friendlyAuthErrorMessage(taskError)');
    expect(loginPanelSource).not.toContain('taskError instanceof Error ? taskError.message');
    expect(declarationsForExact('.desktop-auth-shell .desktop-login-feedback-slot').get('min-height'))
      .toBe('18px');
  });

  it('provides explicit 150–200 percent scroll-safe overrides without horizontal overflow', () => {
    for (const zoom of ['150', '175', '200']) {
      expect(cleanAuthSource).toContain(`[data-desktop-zoom-level='${zoom}']`);
    }

    expect(cleanAuthSource).toContain('width: min(420px, 100%) !important;');
    expect(cleanAuthSource).toContain('place-items: start center !important;');
    expect(cleanAuthSource).toContain('overflow-x: hidden !important;');
    expect(cleanAuthSource).not.toMatch(/\b100v(?:w|h)\b/);
  });
});
