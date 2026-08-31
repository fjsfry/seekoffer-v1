import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('canonical desktop applications information architecture', () => {
  it('uses a server redirect for the legacy /applications route', async () => {
    const source = await readFile(resolve(root, 'app/applications/page.tsx'), 'utf8');

    expect(source).toContain("import { redirect } from 'next/navigation'");
    expect(source).toContain("redirect('/')");
    expect(source).not.toContain('LegacyWorkbenchRedirect');
    expect(source).not.toContain('/me?view=applications');
  });

  it('canonicalizes legacy routes during desktop launch and route handling', async () => {
    const source = await readFile(resolve(root, 'components/desktop-app-shell.tsx'), 'utf8');

    expect(source).toContain('canonicalizeDesktopRoute,');
    expect(source).toContain('canonicalizeDesktopRoute(requestedRoute, window.location.href)');
    expect(source).toContain('canonicalizeDesktopRoute(currentRoute, window.location.href)');
    expect(source).not.toContain("pathname === '/applications'");
    expect(source).not.toContain('view=applications');
    expect(source).not.toContain("activeView || 'applications'");
  });

  it('keeps /me for schedule and contacts while redirecting its legacy applications view', async () => {
    const source = await readFile(resolve(root, 'app/me/page.tsx'), 'utf8');

    expect(source).toContain("const activeSection = normalizeWorkbenchSection(searchParams.get('view'))");
    expect(source).toContain("if (!activeSection) router.replace('/')");
    expect(source).toContain('if (!activeSection) return null');
    expect(source).toContain("value === 'schedule' || value === 'contacts'");
    expect(source).not.toContain("activeSection === 'applications'");
    expect(source).not.toContain('ApplicationFillAssistant');
    expect(source).not.toContain('ApplicationProgressCard');
    expect(source).not.toContain('id="application-board"');
  });

  it('uses the canonical copy and root entry in user-facing application actions', async () => {
    const [actionButton, notices, manualEntry, sessionEntry, traySource] = await Promise.all([
      readFile(resolve(root, 'components/application-action-button.tsx'), 'utf8'),
      readFile(resolve(root, 'app/notices/page.tsx'), 'utf8'),
      readFile(resolve(root, 'components/manual-project-entry-card.tsx'), 'utf8'),
      readFile(resolve(root, 'components/user-session-entry.tsx'), 'utf8'),
      readFile(resolve(root, 'src-tauri/src/lib.rs'), 'utf8')
    ]);

    const source = [actionButton, notices, manualEntry, sessionEntry, traySource].join('\n');
    expect(source).not.toContain('加入工作台');
    expect(source).not.toContain('申请工作台');
    expect(actionButton).toContain("label = '加入申请'");
    expect(sessionEntry).toContain('href="/"');
    expect(sessionEntry).toContain('>全部申请</span>');
    expect(traySource).toContain('MenuItem::with_id(app, "open-workbench", "全部申请"');
  });
});
