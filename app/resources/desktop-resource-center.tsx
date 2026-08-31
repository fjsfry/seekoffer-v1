'use client';

import {
  ArrowRight,
  ArrowUpRight,
  BookOpenText,
  Calculator,
  ChartPie,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  FileText,
  FolderSearch2,
  Landmark,
  LibraryBig,
  Lightbulb,
  Mail,
  RefreshCw,
  Rocket,
  Search,
  Star,
  Wrench,
  X,
  type LucideIcon
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { emitDesktopFeedback } from '@/lib/desktop-route-events';
import { taobaoTemplatePackHref } from '@/lib/external-links';
import { officialResourceSections } from '@/lib/portal-data';
import styles from './resources.module.css';

type ResourceCategory = 'toolkit' | 'academic' | 'official' | 'services';
type ResourceFilter = 'all' | 'favorites' | 'recent' | ResourceCategory;

type ResourceItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  badge: string;
  category: ResourceCategory;
  categoryLabel: string;
  external: boolean;
  commercial?: boolean;
  keywords?: string[];
  icon?: LucideIcon;
};

type LocalResourceState = {
  favoriteIds: string[];
  recentIds: string[];
};

const RESOURCE_LOCAL_STATE_KEY = 'seekoffer:resource-center:device-state:v1';
const RESOURCE_VIEW_STATE_KEY = 'seekoffer:resource-center:view-state:v1';
const RESOURCE_FILTER_VALUES: ResourceFilter[] = [
  'all',
  'favorites',
  'recent',
  'toolkit',
  'academic',
  'official',
  'services'
];

const applicationKits: ResourceItem[] = [
  {
    id: 'toolkit-resume',
    title: '简历模板',
    description: '适合夏令营、预推免和正式推免投递，突出成绩、科研、竞赛和项目经历。',
    badge: '外部付费',
    category: 'toolkit',
    categoryLabel: '申请资料与工具',
    href: taobaoTemplatePackHref,
    external: true,
    commercial: true,
    keywords: ['一页简历', '科研经历', '项目表达'],
    icon: FileText
  },
  {
    id: 'toolkit-personal-statement',
    title: '个人陈述模板',
    description: '按个人背景、科研经历、目标方向和未来规划组织内容，减少空泛表达。',
    badge: '外部付费',
    category: 'toolkit',
    categoryLabel: '申请资料与工具',
    href: taobaoTemplatePackHref,
    external: true,
    commercial: true,
    keywords: ['结构模板', '常见问题', '修改提示'],
    icon: BookOpenText
  },
  {
    id: 'toolkit-recommendation-letter',
    title: '推荐信模板',
    description: '整理推荐信写作结构、常见表述和提交注意事项，方便提前沟通老师。',
    badge: '外部付费',
    category: 'toolkit',
    categoryLabel: '申请资料与工具',
    href: taobaoTemplatePackHref,
    external: true,
    commercial: true,
    keywords: ['推荐信结构', '老师沟通', '提交提醒'],
    icon: Mail
  },
  {
    id: 'toolkit-gpa',
    title: 'GPA 与材料工具',
    description: '把申请期反复计算和检查的事情工具化，减少低价值重复劳动。',
    badge: '站内工具',
    category: 'toolkit',
    categoryLabel: '申请资料与工具',
    href: '/gpa',
    external: false,
    keywords: ['GPA 换算', '材料进度', '截止提醒'],
    icon: Calculator
  }
];

const sectionCategoryMap: Record<string, ResourceCategory> = {
  高频学术工具: 'academic',
  官方入口: 'official',
  常用服务: 'services'
};

const sectionIcons: Record<ResourceCategory, LucideIcon> = {
  toolkit: ClipboardList,
  academic: BookOpenText,
  official: Landmark,
  services: Wrench
};

const resourceCategoryColors: Record<ResourceCategory, string> = {
  toolkit: '#7666de',
  academic: '#3f7fd1',
  official: '#35a178',
  services: '#d0872d'
};

const externalResources: ResourceItem[] = officialResourceSections.flatMap((section) => {
  const category = sectionCategoryMap[section.title];

  return section.links.map((item) => ({
    id: `${category}-${new URL(item.href).hostname.replace(/^www\./, '')}`,
    title: item.title,
    description: item.description,
    href: item.href,
    badge: item.badge,
    category,
    categoryLabel: section.title,
    external: true
  }));
});

const allResources = [...applicationKits, ...externalResources];
const allowedResourceIds = new Set(allResources.map((item) => item.id));
const featuredResourceIds = [
  'toolkit-gpa',
  'official-yz.chsi.com.cn',
  'official-chsi.com.cn',
  'academic-cnki.net'
];

const groupMeta: Array<{
  id: ResourceCategory;
  title: string;
  description: string;
}> = [
  {
    id: 'toolkit',
    title: '申请资料与工具',
    description: '材料模板、检查工具与申请期常用能力。'
  },
  ...officialResourceSections.map((section) => ({
    id: sectionCategoryMap[section.title],
    title: section.title,
    description: section.description
  }))
];

function uniqueKnownIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  return [...new Set(value.filter((id): id is string => typeof id === 'string' && allowedResourceIds.has(id)))];
}

function parseLocalResourceState(value: string | null): LocalResourceState {
  if (!value) return { favoriteIds: [], recentIds: [] };

  try {
    const parsed = JSON.parse(value) as Partial<LocalResourceState>;
    return {
      favoriteIds: uniqueKnownIds(parsed.favoriteIds),
      recentIds: uniqueKnownIds(parsed.recentIds).slice(0, 8)
    };
  } catch {
    return { favoriteIds: [], recentIds: [] };
  }
}

function withFavoriteValue(
  current: LocalResourceState,
  itemId: string,
  favorite: boolean
): LocalResourceState {
  return {
    ...current,
    favoriteIds: favorite
      ? Array.from(new Set([...current.favoriteIds, itemId]))
      : current.favoriteIds.filter((id) => id !== itemId)
  };
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function ResourceMark({ item }: { item: ResourceItem }) {
  if (item.icon) {
    const Icon = item.icon;
    return (
      <span
        className={`${styles.resourceMark} desktop-resource-mark desktop-resource-tool-icon`}
        data-resource-category={item.category}
        aria-hidden="true"
      >
        <Icon />
      </span>
    );
  }

  return (
    <span
      className={`${styles.resourceMark} desktop-resource-mark desktop-resource-link-mark`}
      data-resource-category={item.category}
      aria-hidden="true"
    >
      <ExternalSiteMark source={item.href} label={item.title} size="sm" layout="square" />
    </span>
  );
}

function ResourceDestination({ item }: { item: ResourceItem }) {
  return (
    <span className={`${styles.openAction} desktop-resource-row-action`} aria-hidden="true">
      <span>{item.external ? '访问' : '打开'}</span>
      {item.external ? (
        <ArrowUpRight className="desktop-resource-open-icon" />
      ) : (
        <ArrowRight className="desktop-resource-open-icon" />
      )}
    </span>
  );
}

function ResourceRow({
  item,
  favorite,
  onOpen,
  onToggleFavorite
}: {
  item: ResourceItem;
  favorite: boolean;
  onOpen: (item: ResourceItem) => void;
  onToggleFavorite: (item: ResourceItem) => void;
}) {
  const isToolkit = item.category === 'toolkit';
  const copyClassName = isToolkit ? 'desktop-resource-tool-copy' : 'desktop-resource-link-copy';
  const itemClassName = isToolkit ? 'desktop-resource-tool-card' : '';
  const content = (
    <>
      <ResourceMark item={item} />
      <span className={`${styles.resourceCopy} desktop-resource-copy ${copyClassName}`}>
        <span
          className={`${styles.resourceTitle} desktop-resource-item-title ${isToolkit ? 'desktop-resource-tool-title' : 'desktop-resource-link-title'}`}
        >
          <strong>{item.title}</strong>
          <small className={item.commercial ? 'desktop-resource-badge--commercial' : undefined}>
            {item.badge}
          </small>
        </span>
        <span className={`${styles.resourceDescription} desktop-resource-item-description`}>
          {item.description}
        </span>
      </span>
      {item.keywords?.length ? (
        <em className={`${styles.resourceKeywords} desktop-resource-item-keywords`}>
          {item.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
        </em>
      ) : null}
      <ResourceDestination item={item} />
    </>
  );

  const accessibleLabel = item.external
    ? `${item.title}，${item.badge}，在新窗口打开`
    : `${item.title}，站内工具`;

  return (
    <li
      className={`${styles.resourceItem} desktop-resource-item ${itemClassName}`}
      data-resource-category={item.category}
      role="listitem"
    >
      {item.external ? (
        <a
          href={item.href}
          target="_blank"
          rel={item.commercial ? 'noreferrer sponsored' : 'noreferrer'}
          className={`${styles.resourceLink} ${isToolkit ? 'desktop-resource-tool-row' : 'desktop-resource-link'}`}
          aria-label={accessibleLabel}
          onClick={() => onOpen(item)}
        >
          {content}
        </a>
      ) : (
        <Link
          href={item.href}
          className={`${styles.resourceLink} desktop-resource-tool-row`}
          aria-label={accessibleLabel}
          onClick={() => onOpen(item)}
        >
          {content}
        </Link>
      )}

      <button
        type="button"
        className={`${styles.favoriteButton} desktop-resource-favorite ${favorite ? styles.favoriteButtonActive : ''}`}
        data-active={favorite ? 'true' : 'false'}
        aria-label={favorite ? `取消收藏 ${item.title}` : `收藏 ${item.title}`}
        aria-pressed={favorite}
        title={favorite ? '取消收藏' : '收藏到当前设备'}
        onClick={() => onToggleFavorite(item)}
      >
        <Star aria-hidden="true" fill={favorite ? 'currentColor' : 'none'} />
      </button>
    </li>
  );
}

function QuickResource({ item, onOpen }: { item: ResourceItem; onOpen: (item: ResourceItem) => void }) {
  const content = (
    <>
      <ResourceMark item={item} />
      <span className={`${styles.quickCopy} desktop-resource-quick-copy`}>
        <strong>{item.title}</strong>
        <span>{item.categoryLabel}</span>
      </span>
      {item.external ? <ArrowUpRight aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
    </>
  );

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel={item.commercial ? 'noreferrer sponsored' : 'noreferrer'}
        className={`${styles.quickResource} desktop-resource-quick-item`}
        aria-label={`${item.title}，在新窗口打开`}
        onClick={() => onOpen(item)}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={item.href}
      className={`${styles.quickResource} desktop-resource-quick-item`}
      onClick={() => onOpen(item)}
    >
      {content}
    </Link>
  );
}

export default function DesktopResourceCenter() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ResourceFilter>('all');
  const [localState, setLocalState] = useState<LocalResourceState>({ favoriteIds: [], recentIds: [] });
  const [localStateReady, setLocalStateReady] = useState(false);
  const [viewStateReady, setViewStateReady] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [featuredIndex, setFeaturedIndex] = useState(0);

  useEffect(() => {
    try {
      setLocalState(parseLocalResourceState(window.localStorage.getItem(RESOURCE_LOCAL_STATE_KEY)));
    } catch {
      setLocalState({ favoriteIds: [], recentIds: [] });
      setAnnouncement('当前设备限制了本机存储，收藏与最近使用将仅在本次打开期间保留。');
    } finally {
      setLocalStateReady(true);
    }
  }, []);

  useEffect(() => {
    try {
      const parsed = JSON.parse(window.sessionStorage.getItem(RESOURCE_VIEW_STATE_KEY) || '{}') as {
        query?: unknown;
        activeFilter?: unknown;
      };
      if (typeof parsed.query === 'string') setQuery(parsed.query);
      if (
        typeof parsed.activeFilter === 'string' &&
        RESOURCE_FILTER_VALUES.includes(parsed.activeFilter as ResourceFilter)
      ) {
        setActiveFilter(parsed.activeFilter as ResourceFilter);
      }
    } catch {
      // Restricted session storage should not block the resource directory.
    } finally {
      setViewStateReady(true);
    }
  }, []);

  useEffect(() => {
    if (!viewStateReady) return;
    try {
      window.sessionStorage.setItem(
        RESOURCE_VIEW_STATE_KEY,
        JSON.stringify({ query, activeFilter })
      );
    } catch {
      // View restoration is a convenience; browsing must continue without it.
    }
  }, [activeFilter, query, viewStateReady]);

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      const isFindShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f';
      const isSlashShortcut = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey;

      if ((!isFindShortcut && !isSlashShortcut) || (isSlashShortcut && isEditableTarget(event.target))) {
        return;
      }

      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };

    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, []);

  const persistLocalState = (nextState: LocalResourceState) => {
    setLocalState(nextState);

    try {
      window.localStorage.setItem(RESOURCE_LOCAL_STATE_KEY, JSON.stringify(nextState));
    } catch {
      setAnnouncement('当前设备无法保存资源偏好，本次操作仅临时生效。');
    }
  };

  const setFavoriteValue = (itemId: string, favorite: boolean) => {
    try {
      const storedState = parseLocalResourceState(
        window.localStorage.getItem(RESOURCE_LOCAL_STATE_KEY)
      );
      const nextState = withFavoriteValue(storedState, itemId, favorite);
      window.localStorage.setItem(RESOURCE_LOCAL_STATE_KEY, JSON.stringify(nextState));
      setLocalState(nextState);
    } catch {
      setLocalState((current) => withFavoriteValue(current, itemId, favorite));
      setAnnouncement('当前设备无法保存资源偏好，本次操作仅临时生效。');
    }
  };

  const handleOpen = (item: ResourceItem) => {
    const nextRecentIds = [item.id, ...localState.recentIds.filter((id) => id !== item.id)].slice(0, 8);
    persistLocalState({ ...localState, recentIds: nextRecentIds });
    setAnnouncement(`已将 ${item.title} 记录到最近使用。`);
  };

  const clearResourceSearch = () => {
    setQuery('');
    window.requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }));
  };

  const handleToggleFavorite = (item: ResourceItem) => {
    const isFavorite = localState.favoriteIds.includes(item.id);
    const nextFavorite = !isFavorite;
    setFavoriteValue(item.id, nextFavorite);
    setAnnouncement(nextFavorite ? `已收藏 ${item.title} 到当前设备。` : `已取消收藏 ${item.title}。`);
    emitDesktopFeedback({
      message: nextFavorite ? '已收藏资源' : '已取消收藏',
      detail: `${item.title} · 仅保存在当前设备`,
      tone: 'success',
      duration: 5200,
      actionLabel: '撤销',
      onAction: () => {
        setFavoriteValue(item.id, isFavorite);
        setAnnouncement(isFavorite ? `已恢复收藏 ${item.title}。` : `已撤销收藏 ${item.title}。`);
      }
    });
  };

  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
  const recentOrder = useMemo(
    () => new Map(localState.recentIds.map((id, index) => [id, index])),
    [localState.recentIds]
  );

  const visibleResources = useMemo(() => {
    const filtered = allResources.filter((item) => {
      if (activeFilter === 'favorites' && !localState.favoriteIds.includes(item.id)) return false;
      if (activeFilter === 'recent' && !localState.recentIds.includes(item.id)) return false;
      if (!['all', 'favorites', 'recent'].includes(activeFilter) && item.category !== activeFilter) return false;

      if (!normalizedQuery) return true;
      const searchableText = [item.title, item.description, item.badge, item.categoryLabel, ...(item.keywords ?? [])]
        .join(' ')
        .toLocaleLowerCase('zh-CN');

      return searchableText.includes(normalizedQuery);
    });

    if (activeFilter === 'recent') {
      return [...filtered].sort(
        (left, right) =>
          (recentOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (recentOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER)
      );
    }

    return filtered;
  }, [activeFilter, localState.favoriteIds, localState.recentIds, normalizedQuery, recentOrder]);

  const visibleGroups = useMemo(() => {
    if (activeFilter === 'favorites') {
      return [{ id: 'favorites', title: '我的收藏', description: '收藏的资源入口。', items: visibleResources }];
    }

    if (activeFilter === 'recent') {
      return [{ id: 'recent', title: '最近使用', description: '最近打开的资源入口。', items: visibleResources }];
    }

    return groupMeta
      .map((group) => ({ ...group, items: visibleResources.filter((item) => item.category === group.id) }))
      .filter((group) => group.items.length > 0);
  }, [activeFilter, visibleResources]);

  const recentResources = localState.recentIds
    .map((id) => allResources.find((item) => item.id === id))
    .filter((item): item is ResourceItem => Boolean(item))
    .slice(0, 4);
  const featuredResources = featuredResourceIds
    .map((id) => allResources.find((item) => item.id === id))
    .filter((item): item is ResourceItem => Boolean(item));
  const quickResources = recentResources.length > 0 ? recentResources : featuredResources;
  const featuredResource = featuredResources[featuredIndex % featuredResources.length];

  const categoryOptions: Array<{ id: ResourceFilter; label: string; icon: LucideIcon; count: number }> = [
    { id: 'all', label: '全部资源', icon: LibraryBig, count: allResources.length },
    { id: 'favorites', label: '我的收藏', icon: Star, count: localState.favoriteIds.length },
    { id: 'recent', label: '最近使用', icon: Clock3, count: localState.recentIds.length },
    ...groupMeta.map((group) => ({
      id: group.id,
      label: group.title,
      icon: sectionIcons[group.id],
      count: allResources.filter((item) => item.category === group.id).length
    }))
  ];
  const sidebarOptions = categoryOptions.filter((option) => option.id !== 'all');
  const resourceStats = groupMeta.map((group) => ({
    id: group.id,
    label: group.title,
    count: allResources.filter((item) => item.category === group.id).length,
    color: resourceCategoryColors[group.id]
  }));
  let resourceStatsCursor = 0;
  const resourceStatsSegments = resourceStats.map((item) => {
    const start = (resourceStatsCursor / allResources.length) * 360;
    resourceStatsCursor += item.count;
    const end = (resourceStatsCursor / allResources.length) * 360;
    return `${item.color} ${start}deg ${end}deg`;
  });
  const resourceStatsBackground = `conic-gradient(${resourceStatsSegments.join(', ')})`;

  const emptyTitle = normalizedQuery
    ? '没有找到匹配的资源'
    : activeFilter === 'favorites'
      ? '还没有收藏资源'
      : activeFilter === 'recent'
        ? '暂无最近使用'
        : '当前分类暂无资源';
  const emptyDescription = normalizedQuery
    ? '换一个关键词，或清除分类筛选后再试。'
    : activeFilter === 'favorites'
      ? '在任意资源右侧点击收藏，即可固定到这个列表。'
      : activeFilter === 'recent'
        ? ''
        : '稍后再来看看。';

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="desktop-route-content desktop-core-page desktop-core-page--scroll outline-none"
    >
      <div className={`${styles.resourcePage} desktop-resource-page`} aria-labelledby="resource-page-title">
        <header className={`${styles.pageHeader} desktop-core-page-header desktop-page-header desktop-page-header--directory desktop-resource-hero page-hero`}>
          <div className={`${styles.headerCopy} desktop-page-header-copy desktop-resource-hero-copy`}>
            <div className="desktop-page-header-title-row">
              <h1 id="resource-page-title" className="desktop-page-header-title">资源中心</h1>
            </div>
            <p className="desktop-page-header-subtitle">申请资料、官方入口与高频学术工具，一处直达。</p>
          </div>
          <div className={`${styles.headerMeta} desktop-page-header-actions desktop-resource-hero-meta`}>
            <span className="desktop-resource-total" aria-label={`共 ${allResources.length} 个资源入口`}>
              <strong>{allResources.length}</strong>
              <small>个入口</small>
            </span>
            <span
              className={styles.deviceBadge}
              title="收藏和最近使用不会跟随账号同步"
              aria-label="本机偏好：收藏和最近使用仅保存在当前设备"
            >
              <Check aria-hidden="true" />
              收藏仅存本机
            </span>
          </div>
        </header>

        <div className={`${styles.workspace} desktop-resource-workspace`}>
          <div className={`${styles.contentColumn} desktop-resource-content`}>
            <section className={`${styles.searchPanel} desktop-resource-toolbar`} aria-label="搜索与筛选资源">
          <div className="desktop-resource-toolbar-row">
            <div className={`${styles.searchField} desktop-resource-search`} role="search">
              <Search aria-hidden="true" />
              <input
                ref={searchInputRef}
                id="resource-search-input"
                type="text"
                role="searchbox"
                aria-label="搜索资源"
                aria-keyshortcuts="Control+F"
                inputMode="search"
                value={query}
                autoComplete="off"
                placeholder="搜索资源名称、用途或分类"
                onChange={(event) => setQuery(event.target.value)}
              />
              {query ? (
                <button type="button" aria-label="清空资源搜索" onClick={clearResourceSearch}>
                  <X aria-hidden="true" />
                </button>
              ) : (
                <kbd>Ctrl F</kbd>
              )}
            </div>
            <span className="desktop-resource-result-summary" aria-live="polite">
              <strong>{visibleResources.length}</strong>
              <span>个结果</span>
            </span>
          </div>

          <nav className={`${styles.categoryList} desktop-resource-filter-list`} aria-label="筛选资源分类">
            {categoryOptions.map((option) => {
              const Icon = option.icon;
              const selected = activeFilter === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  className={`${styles.categoryButton} desktop-resource-filter ${selected ? styles.categoryButtonActive : ''}`}
                  data-resource-filter={option.id}
                  aria-pressed={selected}
                  onClick={() => setActiveFilter(option.id)}
                >
                  <Icon aria-hidden="true" />
                  <span>{option.label}</span>
                  <small>{localStateReady ? option.count : '—'}</small>
                </button>
              );
            })}
          </nav>
            </section>

            {activeFilter === 'all' && !normalizedQuery ? (
              <section className={`${styles.quickPanel} desktop-resource-quick-panel`} aria-labelledby="quick-resource-title">
                <div className={`${styles.panelHeading} desktop-resource-quick-heading`}>
                  <div>
                    <span className={`${styles.panelIcon} desktop-resource-panel-icon`} aria-hidden="true">
                      {recentResources.length > 0 ? <Clock3 /> : <Star />}
                    </span>
                    <span>
                      <h2 id="quick-resource-title">{recentResources.length > 0 ? '最近使用' : '常用入口'}</h2>
                      <p>{recentResources.length > 0 ? '从上次离开的位置继续' : '高频申请工具与权威信息入口'}</p>
                    </span>
                  </div>
                  {recentResources.length > 0 ? (
                    <button type="button" onClick={() => setActiveFilter('recent')}>
                      查看全部 <ChevronRight aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                <div className={`${styles.quickGrid} desktop-resource-quick-grid`} role="list">
                  {quickResources.map((item) => (
                    <div key={item.id} role="listitem">
                      <QuickResource item={item} onOpen={handleOpen} />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className={`${styles.directory} desktop-resource-directory`} aria-labelledby="resource-directory-title">
              <div className={`${styles.directoryHeading} desktop-resource-directory-heading`}>
                <div>
                  <h2 id="resource-directory-title">
                    {categoryOptions.find((option) => option.id === activeFilter)?.label ?? '资源目录'}
                  </h2>
                  <p>按用途分组，点击即可打开</p>
                </div>
                {activeFilter !== 'all' || normalizedQuery ? (
                  <button
                    type="button"
                    className={`${styles.resetButton} desktop-resource-reset`}
                    onClick={() => {
                      setActiveFilter('all');
                      setQuery('');
                    }}
                  >
                    重置筛选
                  </button>
                ) : null}
              </div>

              {visibleGroups.length > 0 ? (
                <div className={`${styles.directoryGroups} desktop-resource-sections`}>
                  {visibleGroups.map((group) => {
                    const category = group.id as ResourceCategory;
                    const Icon = sectionIcons[category] ?? FolderSearch2;
                    const sectionTitleId = `resource-section-${group.id}`;
                    const isToolkit = group.id === 'toolkit';

                    return (
                      <section
                        key={group.id}
                        className={`${styles.resourceGroup} ${isToolkit ? 'desktop-resource-toolkit' : 'desktop-resource-section-card'}`}
                        data-resource-category={category}
                        aria-labelledby={sectionTitleId}
                      >
                        <header className={`${styles.groupHeader} desktop-resource-section-heading`}>
                          <div className="desktop-resource-section-heading-main">
                            <span className="desktop-resource-section-icon">
                              <Icon aria-hidden="true" />
                            </span>
                            <div className="desktop-resource-section-title">
                              <h2 id={sectionTitleId}>{group.title}</h2>
                              <p>{group.description}</p>
                            </div>
                          </div>
                          <span className="desktop-resource-section-count">{group.items.length} 个入口</span>
                        </header>

                        {isToolkit ? (
                          <ul className="desktop-resource-tool-grid desktop-resource-tool-list" role="list">
                            {group.items.map((item) => (
                              <ResourceRow
                                key={item.id}
                                item={item}
                                favorite={localState.favoriteIds.includes(item.id)}
                                onOpen={handleOpen}
                                onToggleFavorite={handleToggleFavorite}
                              />
                            ))}
                          </ul>
                        ) : (
                          <ul className={`${styles.resourceList} desktop-resource-link-grid`} role="list">
                            {group.items.map((item) => (
                              <ResourceRow
                                key={item.id}
                                item={item}
                                favorite={localState.favoriteIds.includes(item.id)}
                                onOpen={handleOpen}
                                onToggleFavorite={handleToggleFavorite}
                              />
                            ))}
                          </ul>
                        )}
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.emptyState} role="status">
                  <span aria-hidden="true">
                    {activeFilter === 'favorites' ? <Star /> : <FolderSearch2 />}
                  </span>
                  <strong>{emptyTitle}</strong>
                  {emptyDescription ? <p>{emptyDescription}</p> : null}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFilter('all');
                      setQuery('');
                      searchInputRef.current?.focus();
                    }}
                  >
                    查看全部资源
                  </button>
                </div>
              )}
            </section>
          </div>

          <aside className={`${styles.resourceSidebar} desktop-resource-sidebar`} aria-label="资源快捷入口与统计">
            <section
              className={`${styles.sidebarCard} desktop-resource-sidebar-card`}
              aria-labelledby="resource-quick-links-title"
            >
              <header className={`${styles.sidebarCardHeader} desktop-resource-sidebar-heading`}>
                <Rocket aria-hidden="true" />
                <h2 id="resource-quick-links-title">快捷入口</h2>
              </header>
              <nav className={`${styles.sidebarQuickList} desktop-resource-sidebar-links`} aria-label="快速筛选资源">
                {sidebarOptions.map((option) => {
                  const Icon = option.icon;
                  const selected = activeFilter === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={selected}
                      data-resource-filter={option.id}
                      onClick={() => setActiveFilter(option.id)}
                    >
                      <Icon aria-hidden="true" />
                      <span>{option.label}</span>
                      <small>{localStateReady ? option.count : '—'}</small>
                      <ChevronRight aria-hidden="true" />
                    </button>
                  );
                })}
              </nav>
            </section>

            {featuredResource ? (
              <section
                className={`${styles.sidebarCard} ${styles.sidebarFeaturedCard} desktop-resource-sidebar-card desktop-resource-featured-card`}
                aria-labelledby="resource-featured-title"
              >
                <header className={`${styles.sidebarCardHeader} desktop-resource-sidebar-heading`}>
                  <Lightbulb aria-hidden="true" />
                  <h2 id="resource-featured-title">精选入口</h2>
                  <button
                    type="button"
                    onClick={() => {
                      const nextIndex = (featuredIndex + 1) % featuredResources.length;
                      setFeaturedIndex(nextIndex);
                      setAnnouncement(`已显示精选入口：${featuredResources[nextIndex]?.title ?? '资源入口'}。`);
                    }}
                    aria-label="换一个精选入口"
                  >
                    <RefreshCw aria-hidden="true" />
                    换一个
                  </button>
                </header>
                <div className={`${styles.sidebarFeaturedBody} desktop-resource-featured-body`}>
                  <ResourceMark item={featuredResource} />
                  <div>
                    <strong>{featuredResource.title}</strong>
                    <p>{featuredResource.description}</p>
                    {featuredResource.external ? (
                      <a
                        href={featuredResource.href}
                        target="_blank"
                        rel={featuredResource.commercial ? 'noreferrer sponsored' : 'noreferrer'}
                        onClick={() => handleOpen(featuredResource)}
                      >
                        查看入口 <ArrowRight aria-hidden="true" />
                      </a>
                    ) : (
                      <Link href={featuredResource.href} onClick={() => handleOpen(featuredResource)}>
                        立即打开 <ArrowRight aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            <section
              className={`${styles.sidebarCard} desktop-resource-sidebar-card`}
              aria-labelledby="resource-stats-title"
            >
              <header className={`${styles.sidebarCardHeader} desktop-resource-sidebar-heading`}>
                <ChartPie aria-hidden="true" />
                <h2 id="resource-stats-title">资源统计</h2>
              </header>
              <div className={`${styles.resourceStatsBody} desktop-resource-stats-body`}>
                <div
                  className={`${styles.resourceStatsChart} desktop-resource-stats-chart`}
                  style={{ background: resourceStatsBackground }}
                  role="img"
                  aria-label={`共 ${allResources.length} 个资源入口`}
                >
                  <span>
                    <strong>{allResources.length}</strong>
                    <small>总入口</small>
                  </span>
                </div>
                <ul className={`${styles.resourceStatsList} desktop-resource-stats-list`}>
                  {resourceStats.map((item) => (
                    <li key={item.id}>
                      <i style={{ backgroundColor: item.color }} aria-hidden="true" />
                      <span>{item.label}</span>
                      <strong>{item.count}</strong>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                className={`${styles.sidebarTextAction} desktop-resource-sidebar-action`}
                onClick={() => {
                  setActiveFilter('all');
                  setQuery('');
                }}
              >
                查看全部资源
                <ArrowRight aria-hidden="true" />
              </button>
            </section>

            <section
              className={`${styles.sidebarCard} ${styles.sidebarHelpCard} desktop-resource-sidebar-card desktop-resource-help-card`}
              aria-labelledby="resource-help-title"
            >
              <CircleHelp aria-hidden="true" />
              <div>
                <h2 id="resource-help-title">需要帮助？</h2>
                <p>找不到需要的资源或遇到使用问题，可以查看帮助与反馈。</p>
                <Link href="/guide">
                  帮助与反馈
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            </section>
          </aside>
        </div>

        <p className={`${styles.srOnly} desktop-resource-announcement`} aria-live="polite">
          {announcement}
        </p>
      </div>
    </main>
  );
}
