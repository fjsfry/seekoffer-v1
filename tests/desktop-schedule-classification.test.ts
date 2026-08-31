import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..');
const scheduleSource = readFileSync(resolve(projectRoot, 'components/desktop-schedule-workspace.tsx'), 'utf8');
const scheduleCss = readFileSync(resolve(projectRoot, 'components/desktop-workspace.module.css'), 'utf8');
const todaySource = readFileSync(resolve(projectRoot, 'components/desktop-today.tsx'), 'utf8');
const meSource = readFileSync(resolve(projectRoot, 'app/me/page.tsx'), 'utf8');

describe('desktop schedule classification and priority contract', () => {
  it('keeps category and four-quadrant priority as separate task dimensions', () => {
    for (const category of ['申请', '学习', '作业', '工作', '生活', '其他']) {
      expect(scheduleSource).toContain(`'${category}'`);
    }
    for (const priority of ['重要且紧急', '重要不紧急', '不重要紧急', '不重要不紧急']) {
      expect(scheduleSource).toContain(`'${priority}'`);
    }
    expect(scheduleSource).toContain('data-category={item.category}');
    expect(scheduleSource).toContain('data-priority={item.priority}');
  });

  it('provides keyboard-reachable pickers, filters and list/quadrant views', () => {
    expect(scheduleSource).toContain('role="radiogroup"');
    expect(scheduleSource).toContain('role="radio"');
    expect(scheduleSource).toContain("viewMode === 'quadrant'");
    expect(scheduleSource).toContain('aria-pressed={viewMode === \'list\'}');
    expect(scheduleSource).toContain('setCategoryFilter');
    expect(scheduleSource).toContain('setPriorityFilter');
    expect(scheduleSource).toContain("isDesktopSurface ? styles.schedulePage : ''");
    expect(meSource).toContain('const priorityCompare = isDesktopSurface');
    expect(scheduleSource).toContain('createMode || !isDesktopSurface');
    expect(scheduleSource).toContain('<ScheduleIdleState');
    expect(scheduleCss).toContain(".workspace[data-detail-open='false']");
    expect(scheduleCss).toContain(".workspace[data-detail-open='false'] .detailPane");
  });

  it('uses small semantic accents instead of one all-green task treatment', () => {
    expect(scheduleCss).toContain("[data-category='学习']");
    expect(scheduleCss).toContain("[data-category='作业']");
    expect(scheduleCss).toContain("[data-category='工作']");
    expect(scheduleCss).toContain("[data-priority='重要且紧急']");
    expect(scheduleCss).toContain("[data-priority='不重要不紧急']");
    expect(scheduleCss).toContain('.quadrantGrid');
    expect(scheduleCss).toContain('@container schedule-workspace-page');
  });

  it('preserves the new fields through the Today secondary writer', () => {
    expect(todaySource).toContain("category: '申请'");
    expect(todaySource).toContain("priority: '重要不紧急'");
    expect(todaySource.match(/item\.category/g)?.length || 0).toBeGreaterThanOrEqual(2);
    expect(todaySource.match(/item\.priority/g)?.length || 0).toBeGreaterThanOrEqual(2);
  });

  it('opens details as a non-modal side peek while keeping a bounded, readable collection', () => {
    expect(scheduleSource).toContain('id="schedule-detail-pane"');
    expect(scheduleSource).toContain('inert={isDesktopSurface && !detailOpen ? true : undefined}');
    expect(scheduleSource).toContain('aria-controls="schedule-detail-pane"');
    expect(scheduleCss).toContain('Schedule side peek');
    expect(scheduleCss).toContain('Schedule detail-open stability authority');
    expect(scheduleCss).toContain('transform: translate3d(12px, 0, 0)');
    expect(scheduleCss).toContain('pointer-events: none');
    expect(scheduleCss).toContain('@container schedule-workspace-page (max-width: 900px)');
  });

  it('uses compact top-layer popovers instead of permanently expanded property grids', () => {
    expect(scheduleSource).toContain('function ScheduleAdvancedFilters');
    expect(scheduleSource).toContain('popover="auto"');
    expect(scheduleSource).toContain('toggleAnchoredPopover');
    expect(scheduleSource).toContain('className={styles.attributePickerTrigger}');
    expect(scheduleCss).toContain('.schedulePopoverSurface:popover-open');
    expect(scheduleCss).toContain('.categoryPopoverSurface .categoryPicker');
    expect(scheduleCss).toContain('.priorityPopoverSurface .priorityPicker');
  });
});
