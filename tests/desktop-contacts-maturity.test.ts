import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..');
const contactsSource = readFileSync(resolve(projectRoot, 'components/desktop-contacts-workspace.tsx'), 'utf8');
const workspaceCss = readFileSync(resolve(projectRoot, 'components/desktop-workspace.module.css'), 'utf8');
const meSource = readFileSync(resolve(projectRoot, 'app/me/page.tsx'), 'utf8');

describe('desktop contacts mature workspace contract', () => {
  it('keeps the redesign behind the desktop surface boundary', () => {
    expect(contactsSource).toContain("const isDesktopSurface = process.env.NEXT_PUBLIC_SEEKOFFER_SURFACE === 'desktop'");
    expect(contactsSource).toContain("isDesktopSurface ? styles.contactsPage : ''");
    expect(contactsSource).toContain('isDesktopSurface ? (');
  });

  it('uses a full collection and opens details as an inert non-modal side peek', () => {
    expect(contactsSource).toContain('id="contacts-detail-pane"');
    expect(contactsSource).toContain('inert={isDesktopSurface && !detailOpen ? true : undefined}');
    expect(contactsSource).toContain("aria-controls={isDesktopSurface ? 'contacts-detail-pane' : undefined}");
    expect(contactsSource).toContain('data-detail-expanded=');
    expect(workspaceCss).toContain('Contacts workspace: full collection, compact filters and non-modal side peek');
    expect(workspaceCss).toContain('.desktop-route-content):has(> .contactsPage)');
    expect(workspaceCss).toContain('align-content: stretch !important');
    expect(workspaceCss).toContain('.contactsPage .workspace[data-detail-open=\'true\'] .detailPane');
    expect(workspaceCss).toContain('grid-template-rows: minmax(0, 1fr)');
    expect(workspaceCss).toContain('inset: 0 0 0 auto');
    expect(workspaceCss).toContain('height: auto');
    expect(workspaceCss).toContain('transform: translate3d(12px, 0, 0)');
    expect(workspaceCss).toContain('@container contacts-workspace-page (width <= 1240px)');
    expect(workspaceCss).toContain('@container contacts-workspace-page (width > 1240px)');
    expect(workspaceCss).toContain('width: clamp(720px, 60cqi, 860px)');
    expect(workspaceCss).toContain('.contactDetailsBody.formGrid');
    expect(workspaceCss).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
  });

  it('replaces permanent selects with top-layer filter and sort popovers', () => {
    expect(contactsSource).toContain('function ContactAdvancedFilters');
    expect(contactsSource).toContain('function ContactSortPicker');
    expect(contactsSource.match(/popover="auto"/g)?.length || 0).toBeGreaterThanOrEqual(2);
    expect(contactsSource).toContain('toggleAnchoredContactPopover');
    expect(contactsSource).toContain('className={styles.contactsQuickFilter}');
    expect(workspaceCss).toContain('.contactsPopoverSurface:popover-open');
    expect(contactsSource).toContain('function getContactsLayoutScale()');
    expect(contactsSource).toContain('const physicalWidth = Math.min(preferredWidth * scale');
    expect(contactsSource).toContain('const physicalHeight = Math.min(estimatedHeight * scale');
    expect(contactsSource).toContain('const left = physicalLeft / scale;');
    expect(contactsSource).toContain('const top = physicalTop / scale;');
    expect(contactsSource).toContain("surface.style.setProperty('--contacts-popover-max-height'");
    expect(workspaceCss).toContain('max-height: var(--contacts-popover-max-height, 520px)');
  });

  it('uses roomy cards and semantic contact states instead of one all-green treatment', () => {
    expect(contactsSource).toContain('className={`${styles.listRow} ${isDesktopSurface ? styles.contactListRow : \'\'}');
    expect(contactsSource).toContain('data-feedback-status={contact.feedbackStatus}');
    expect(contactsSource).toContain('formatFollowUpLabel');
    for (const status of ['未联系', '已投递', '已回复', '已offer', '需跟进', '无回复', '不合适']) {
      expect(workspaceCss).toContain(`[data-feedback-status='${status}']`);
    }
    expect(contactsSource).toContain('data-contact-metric="last"');
    expect(contactsSource).toContain('data-contact-metric="next"');
    expect(contactsSource).toContain('data-contact-metric="status"');
    expect(contactsSource).toContain('<ChevronRight20Regular className={styles.contactRowChevron}');
    expect(workspaceCss).toContain('.contactsPage .masterScroll');
    expect(workspaceCss).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(workspaceCss).toContain('min-height: 112px');
  });

  it('progressively discloses secondary mentor information and protects high zoom', () => {
    expect(contactsSource).toContain('<strong>更多资料</strong>');
    expect(contactsSource).toContain('<strong>沟通记录</strong>');
    expect(contactsSource).toContain('公开主页照片只缓存在本机');
    expect(contactsSource).toContain('function ContactAvatar');
    expect(contactsSource).toContain('referrerPolicy="no-referrer"');
    expect(contactsSource).toContain('function MentorHomepageField');
    expect(contactsSource).toContain('resolveMentorPhotoFromHomepage');
    expect(contactsSource).toContain('照片来自导师公开主页');
    expect(workspaceCss).toContain("[data-zoom-level='150']");
    expect(workspaceCss).toContain("[data-zoom-level='175']");
    expect(workspaceCss).toContain("[data-zoom-level='200']");
    expect(workspaceCss).toContain('.contactsPage .masterScroll');
    expect(contactsSource).toContain('职称、院校层次、投递与最近联系');
  });

  it('locks the reference selection, field visibility and form-control authority', () => {
    expect(workspaceCss).toContain('Contacts reference completion authority');
    expect(workspaceCss).toContain(".contactListRow[aria-current='true']");
    expect(workspaceCss).toContain(".contactRowMetric[data-contact-metric='last']");
    expect(workspaceCss).toMatch(/data-contact-metric='last'[^}]*display:\s*grid\s*!important/);
    expect(workspaceCss).toMatch(/\.contactListRow\s+:is\(\.contactInlineSelect, \.contactInlineDate\)[\s\S]*?font-size:\s*14px\s*!important/);
    expect(workspaceCss).toContain('display: block !important;');
    expect(meSource).toContain("followUp: activeContacts.filter((item) => item.feedbackStatus === '需跟进').length");
  });

  it('clears stale mentor photos when a synchronized cache key changes or disappears', () => {
    expect(contactsSource).toContain("const previousCacheKey = loadedPhotoKeysRef.current.get(contact.id) || '';");
    expect(contactsSource).toContain('if (previousCacheKey && previousCacheKey !== cacheKey)');
    expect(contactsSource).toContain('delete next[contact.id];');
    expect(contactsSource).toContain('photoRequestSequenceRef.current.set(');
  });
});
