import 'server-only';

import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { getDeadlineLevelFromDate } from '@/lib/deadline-display';
import { filterMainNoticeProjects } from '@/lib/notice-quality';
import {
  NOTICE_CATALOG_COLUMNS,
  NOTICE_DEADLINE_COLUMNS,
  NOTICE_DETAIL_COLUMNS,
  NOTICE_TARGET_YEAR,
  mapNoticeRowToProject,
  toNoticeListItem
} from '@/lib/notice-record';
import { getBeijingDateString } from '@/lib/notice-query';
import { baseNoticeProjects } from '@/lib/notice-source';
import type { PublicNoticeProject } from '@/lib/mock-data';

export const PUBLIC_NOTICE_CACHE_TAG = 'seekoffer-public-notices';
export const publicNoticeCacheTag = (id: string) => `seekoffer-notice:${id}`;

const CATALOG_PAGE_SIZE = 500;
const CATALOG_MAX_ROWS = 20_000;
const DEADLINE_PAGE_SIZE = 200;
const DEADLINE_MAX_ROWS = 2_000;

export type PublicNoticeDataSource = 'supabase' | 'bundled';

export type PublicNoticeCatalogResult = {
  items: PublicNoticeProject[];
  source: PublicNoticeDataSource;
};

function getPublicSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url || !anonKey) {
    throw new Error('Public Supabase environment is not configured.');
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

function getBundledCatalog() {
  return filterMainNoticeProjects(baseNoticeProjects).filter(
    (item) => Number(item.year) === NOTICE_TARGET_YEAR
  );
}

function isPublicNoticeApiV2Enabled() {
  return (process.env.NEXT_PUBLIC_NOTICE_API_V2 || 'true').toLowerCase() !== 'false';
}

function hasPublicSupabaseEnvironment() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

async function loadRemotePublicNoticeCatalogPage(pageIndex: number) {
  // Published rows are already moderated. Keep this projection summary-only so a
  // cold cache fill never transfers full notice bodies merely to render lists.
  const supabase = getPublicSupabaseClient();
  const from = pageIndex * CATALOG_PAGE_SIZE;
  const { data, error } = await supabase
    .from('notices')
    .select(NOTICE_CATALOG_COLUMNS)
    .eq('year', NOTICE_TARGET_YEAR)
    .eq('is_private', false)
    .eq('admin_status', 'published')
    .is('admin_deleted_at', null)
    .order('publish_date', { ascending: false })
    .order('id', { ascending: true })
    .range(from, from + CATALOG_PAGE_SIZE - 1);

  if (error) {
    throw error;
  }

  const pageRows = (data || []) as unknown as Record<string, unknown>[];
  return {
    sourceCount: pageRows.length,
    items: pageRows
      .map((row) => mapNoticeRowToProject(row))
      .filter((item): item is PublicNoticeProject => Boolean(item))
  };
}

const getCachedRemotePublicNoticeCatalogPage = unstable_cache(
  loadRemotePublicNoticeCatalogPage,
  ['seekoffer-public-notice-catalog-page-v3'],
  {
    revalidate: 21_600,
    tags: [PUBLIC_NOTICE_CACHE_TAG]
  }
);

async function loadRemotePublicNoticeCatalog(mainFlowOnly = true) {
  const items: PublicNoticeProject[] = [];
  const maxPages = Math.ceil(CATALOG_MAX_ROWS / CATALOG_PAGE_SIZE);

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const page = await getCachedRemotePublicNoticeCatalogPage(pageIndex);
    items.push(...page.items);

    if (page.sourceCount < CATALOG_PAGE_SIZE) {
      return mainFlowOnly ? filterMainNoticeProjects(items) : items;
    }
  }

  throw new Error(`Public notice catalog exceeded the safe ${CATALOG_MAX_ROWS}-row boundary.`);
}

export async function getPublicNoticeCatalog(): Promise<PublicNoticeCatalogResult> {
  if (!isPublicNoticeApiV2Enabled() || !hasPublicSupabaseEnvironment()) {
    return { items: getBundledCatalog(), source: 'bundled' };
  }

  try {
    return {
      items: await loadRemotePublicNoticeCatalog(),
      source: 'supabase'
    };
  } catch (error) {
    console.warn('[public-notices] remote catalog unavailable; using bundled fallback', error);
    return {
      items: getBundledCatalog(),
      source: 'bundled'
    };
  }
}

async function loadRemoteNoticeById(id: string) {
  const supabase = getPublicSupabaseClient();
  const { data, error } = await supabase
    .from('notices')
    .select(NOTICE_DETAIL_COLUMNS)
    .eq('id', id)
    .eq('year', NOTICE_TARGET_YEAR)
    .eq('is_private', false)
    .eq('admin_status', 'published')
    .is('admin_deleted_at', null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? mapNoticeRowToProject(data as unknown as Record<string, unknown>)
    : null;
}

export async function getCachedNoticeById(id: string) {
  const normalizedId = id.trim().slice(0, 180);
  if (!normalizedId) return null;

  if (!isPublicNoticeApiV2Enabled() || !hasPublicSupabaseEnvironment()) {
    return getBundledCatalog().find((item) => item.id === normalizedId) || null;
  }

  const getCachedRemoteNotice = unstable_cache(
    () => loadRemoteNoticeById(normalizedId),
    ['seekoffer-public-notice-detail-v2', normalizedId],
    {
      revalidate: 21_600,
      tags: [PUBLIC_NOTICE_CACHE_TAG, publicNoticeCacheTag(normalizedId)]
    }
  );

  try {
    return await getCachedRemoteNotice();
  } catch (error) {
    console.warn(`[public-notices] remote detail unavailable for ${normalizedId}; using bundled fallback`, error);
    return getBundledCatalog().find((item) => item.id === normalizedId) || null;
  }
}

function normalizeNoticeIds(ids: string[]) {
  return Array.from(
    new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))
  ).slice(0, 100);
}

export async function getPublicNoticesByIds(ids: string[]) {
  const normalizedIds = normalizeNoticeIds(ids);
  if (!normalizedIds.length) {
    return { items: [] as PublicNoticeProject[], source: 'supabase' as const };
  }

  const wanted = new Set(normalizedIds);
  let catalog: PublicNoticeCatalogResult;
  if (!isPublicNoticeApiV2Enabled() || !hasPublicSupabaseEnvironment()) {
    catalog = {
      items: baseNoticeProjects.filter((item) => Number(item.year) === NOTICE_TARGET_YEAR),
      source: 'bundled'
    };
  } else {
    try {
      catalog = {
        items: await loadRemotePublicNoticeCatalog(false),
        source: 'supabase'
      };
    } catch (error) {
      console.warn('[public-notices] remote ID catalog unavailable; using bundled fallback', error);
      catalog = {
        items: baseNoticeProjects.filter((item) => Number(item.year) === NOTICE_TARGET_YEAR),
        source: 'bundled'
      };
    }
  }

  return {
    items: catalog.items.filter((item) => wanted.has(item.id)).map(toNoticeListItem),
    source: catalog.source
  };
}

function addBeijingDays(date: string, days: number) {
  const timestamp = new Date(`${date}T00:00:00+08:00`).getTime();
  return getBeijingDateString(new Date(timestamp + days * 24 * 60 * 60 * 1_000));
}

async function loadRemoteDeadlineNotices(date: string) {
  const supabase = getPublicSupabaseClient();
  const rows: Record<string, unknown>[] = [];

  for (let from = 0; from < DEADLINE_MAX_ROWS; from += DEADLINE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('notices')
      .select(NOTICE_DEADLINE_COLUMNS)
      .eq('year', NOTICE_TARGET_YEAR)
      .eq('is_private', false)
      .eq('admin_status', 'published')
      .is('admin_deleted_at', null)
      .gte('deadline_date', date)
      .lt('deadline_date', addBeijingDays(date, 8))
      .order('deadline_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + DEADLINE_PAGE_SIZE - 1);

    if (error) throw error;

    const pageRows = (data || []) as unknown as Record<string, unknown>[];
    rows.push(...pageRows);
    if (pageRows.length < DEADLINE_PAGE_SIZE) {
      return filterMainNoticeProjects(
        rows
          .map((row) => mapNoticeRowToProject(row))
          .filter((item): item is PublicNoticeProject => Boolean(item))
      ).filter((item) =>
        ['today', 'within3days', 'within7days'].includes(
          getDeadlineLevelFromDate(item.deadlineDate)
        )
      );
    }
  }

  throw new Error(`Deadline notice window exceeded the safe ${DEADLINE_MAX_ROWS}-row boundary.`);
}

export async function getCachedDeadlineNotices(date = getBeijingDateString()) {
  if (!isPublicNoticeApiV2Enabled() || !hasPublicSupabaseEnvironment()) {
    return {
      items: getBundledCatalog().filter((item) =>
        ['today', 'within3days', 'within7days'].includes(
          getDeadlineLevelFromDate(item.deadlineDate)
        )
      ),
      source: 'bundled' as const
    };
  }

  const getCachedRemoteDeadlines = unstable_cache(
    () => loadRemoteDeadlineNotices(date),
    ['seekoffer-public-notice-deadlines-v2', date],
    {
      revalidate: 300,
      tags: [PUBLIC_NOTICE_CACHE_TAG]
    }
  );

  try {
    return {
      items: await getCachedRemoteDeadlines(),
      source: 'supabase' as const
    };
  } catch (error) {
    console.warn('[public-notices] remote deadline window unavailable; using bundled fallback', error);
    return {
      items: getBundledCatalog().filter((item) =>
        ['today', 'within3days', 'within7days'].includes(
          getDeadlineLevelFromDate(item.deadlineDate)
        )
      ),
      source: 'bundled' as const
    };
  }
}
