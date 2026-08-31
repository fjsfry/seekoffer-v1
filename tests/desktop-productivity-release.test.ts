import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..');
const meSource = readFileSync(resolve(projectRoot, 'app/me/page.tsx'), 'utf8');
const contactsSource = readFileSync(resolve(projectRoot, 'components/desktop-contacts-workspace.tsx'), 'utf8');
const scheduleSource = readFileSync(resolve(projectRoot, 'components/desktop-schedule-workspace.tsx'), 'utf8');
const settingsSource = readFileSync(resolve(projectRoot, 'components/desktop-settings-page.tsx'), 'utf8');
const workspaceCss = readFileSync(resolve(projectRoot, 'components/desktop-workspace.module.css'), 'utf8');

function sourceBlock(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe('desktop productivity release contract', () => {
  it('keeps a new mentor as an ephemeral draft until meaningful input exists', () => {
    expect(meSource).toContain('const [contactDraft, setContactDraft]');
    expect(meSource).toContain('function hasMeaningfulContactDraft');
    expect(meSource).toContain('setContactDraft(contact);');
    expect(meSource).toContain('if (contactDraft?.id === id)');
    expect(meSource).toContain('if (hasMeaningfulContactDraft(nextDraft))');
    expect(meSource).toContain('setContacts((current) => [nextDraft, ...current]);');
    expect(meSource).toContain('draftContactId={contactDraft?.id || \'\'}');
    expect(meSource).toContain('onDiscardContactDraft={handleDiscardContactDraft}');
    expect(meSource).toContain("if (activeSection !== 'contacts') setContactDraft(null);");

    const addContact = sourceBlock(meSource, 'function handleAddContact()', 'function handleContactChange');
    expect(addContact).not.toContain('markLocalChange()');
    expect(addContact).not.toContain('setContacts(');

    expect(contactsSource).toContain('const discardDraftId = selectedId && selectedId === draftContactId');
    expect(contactsSource).toContain('onDiscardContactDraft(discardDraftId);');
    expect(contactsSource).toContain('填写姓名或高校后保存');
    expect(workspaceCss).toContain(".contactSaveState[data-draft='true']");
  });

  it('only exposes popover relationships while open and deliberately moves focus', () => {
    expect(scheduleSource.match(/aria-controls=\{open \? popoverId : undefined\}/g)).toHaveLength(3);
    expect(contactsSource.match(/aria-controls=\{open \? popoverId : undefined\}/g)).toHaveLength(2);
    expect(scheduleSource).toContain("surface.querySelector<HTMLElement>('select, input, button')?.focus");
    expect(contactsSource).toContain("surface.querySelector<HTMLElement>('button[aria-pressed=\"true\"], button, select, input')?.focus");
    expect(contactsSource).toContain('contactDetailCloseButtonRef.current?.focus({ preventScroll: true })');
  });

  it('keeps completed cleanup out of create mode and stable at compact widths', () => {
    expect(scheduleSource).toContain('!createMode && items.some((item) => item.done)');
    expect(workspaceCss).toMatch(/\.schedulePage \.dangerButton\s*\{[^}]*white-space:\s*nowrap/);
    expect(workspaceCss).toMatch(
      /@container schedule-workspace-page \(max-width: 900px\)[\s\S]*?\.schedulePage \.scheduleAdvancedFilters\s*\{[^}]*justify-self:\s*stretch/
    );
  });

  it('supports optimistic schedule completion and save feedback without opening detail', () => {
    expect(scheduleSource).toContain('data-schedule-completion-action');
    expect(scheduleSource).toContain('function toggleItemDone');
    expect(scheduleSource).toContain('showUndoNotice(');
    expect(scheduleSource).toContain('data-recent-action={recentItemId === item.id');
    expect(scheduleSource).toContain('aria-live="polite"');
    expect(scheduleSource).toContain('aria-busy={submitState === \'saving\'}');
    expect(scheduleSource).toContain('保存中…');
    expect(scheduleSource).toContain('重试保存');
    expect(workspaceCss).toContain('.inlineQuickAction');
    expect(workspaceCss).toContain('.productivityToast');
    expect(workspaceCss).toContain(".scheduleListRow[data-recent-action='true']");
  });

  it('supports optimistic mentor status and follow-up updates with undo', () => {
    expect(contactsSource).toContain('data-contact-status-action');
    expect(contactsSource).toContain('data-contact-followup-action');
    expect(contactsSource).toContain('function changeContactStatus');
    expect(contactsSource).toContain('function changeContactFollowUp');
    expect(contactsSource).toContain('showUndoNotice(');
    expect(contactsSource).toContain('disabled={contact.id === draftContactId}');
    expect(contactsSource).toContain('data-recent-action={recentContactId === contact.id');
    expect(workspaceCss).toContain('.contactInlineSelect');
    expect(workspaceCss).toContain('.contactInlineDate');
    expect(workspaceCss).toContain(".contactsPage .contactListRow[data-recent-action='true']");
  });

  it('inherits theme-aware semantic tokens for contact states', () => {
    const contactsRoot = sourceBlock(
      workspaceCss,
      '.contactsPage {',
      ':global(.desktop-app-shell .desktop-route-content):has(> .contactsPage)'
    );
    for (const token of [
      'var(--so-danger, #c9443d)',
      'var(--so-danger-soft, #fff0ef)',
      'var(--so-warning, #8a5200)',
      'var(--so-warning-soft, #fff5e6)',
      'var(--so-success, #2b8a5a)',
      'var(--so-success-soft, #eaf7f0)'
    ]) {
      expect(workspaceCss).toContain(token);
    }
    expect(contactsRoot).not.toContain('--so-danger:');
    expect(contactsRoot).not.toContain('--so-danger-soft:');
    expect(workspaceCss).not.toContain("--contact-status-color: #");
    expect(workspaceCss).toMatch(/\.contactDraftPill\s*\{[\s\S]*?color:\s*var\(--so-warning[\s\S]*?background:\s*var\(--so-warning-soft/);
    expect(workspaceCss).toMatch(/\.contactsPage \.contactListRow \.rowDescription\s*\{[^}]*color:\s*var\(--contacts-secondary\)/);
  });

  it('names density by its actual route scope and keeps compact copy narrow-window safe', () => {
    expect(settingsSource).toContain('列表与卡片密度');
    expect(settingsSource).toContain('日程与导师工作区保持固定密度');
    expect(settingsSource).toContain('版本、快捷键、帮助与服务说明。');
    expect(settingsSource).not.toContain('查看版本信息、常用快捷键，以及寻鹿的数据与服务说明。');
  });
});
