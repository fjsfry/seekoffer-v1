import 'server-only';
import {isD1Backend} from '@/lib/backend-mode';
import {isWebsiteRecovery} from '@/lib/website-recovery';
import {getLiveRecoveryCatalog,getRecoveryDetail} from './recovery-public-catalog';

import { createNoticeSnapshotCache, capturePublicRead, unwrapPublicRead } from './notice-snapshot-cache';
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
import { ServiceUnavailableError, createAvailabilityFetch } from '@/lib/service-availability';
import { readFileSync } from 'node:fs';
import type { PublicNoticeProject } from '@/lib/mock-data';

export const PUBLIC_NOTICE_CACHE_TAG = 'seekoffer-public-notices';
export const publicNoticeCacheTag = (id: string) => `seekoffer-notice:${id}`;

const upstreamFetch = createAvailabilityFetch();
const CATALOG_PAGE_SIZE = 200;
const CATALOG_MAX_ROWS = 20_000;
const DEADLINE_PAGE_SIZE = 200;
const DEADLINE_MAX_ROWS = 2_000;

export type PublicNoticeDataSource = 'supabase' | 'bundled' | 'recovery';

export type PublicNoticeCatalogResult = {
  items: PublicNoticeProject[];
  source: PublicNoticeDataSource;
  version?: string;
};

function getPublicSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url || !anonKey) {
    throw new Error('Public Supabase environment is not configured.');
  }

  return createClient(url, anonKey, {
    global: { fetch: async (input, init) => {
      try { return await upstreamFetch(input, { ...init, signal: init?.signal || AbortSignal.timeout(12_000) }); }
      catch (error) {
        if (error instanceof ServiceUnavailableError) return Response.json({ message: 'service_restricted' }, { status: error.status });
        throw error;
      }
    } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

function getBundledCatalog(): PublicNoticeProject[] {
  const fixturePath = process.env.SEEKOFFER_OFFLINE_FIXTURE;
  if (!fixturePath || process.env.VERCEL) throw new ServiceUnavailableError(503);
  return JSON.parse(readFileSync(fixturePath, 'utf8')) as PublicNoticeProject[];
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
  const { data, error, status } = await supabase
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
    throw new ServiceUnavailableError(status || 503);
  }

  const pageRows = (data || []) as unknown as Record<string, unknown>[];
  return {
    sourceCount: pageRows.length,
    items: pageRows
      .map((row) => mapNoticeRowToProject(row))
      .filter((item): item is PublicNoticeProject => Boolean(item))
  };
}



async function loadRemotePublicNoticeCatalog() {
  const items: PublicNoticeProject[] = [];
  const maxPages = Math.ceil(CATALOG_MAX_ROWS / CATALOG_PAGE_SIZE);

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const page = await loadRemotePublicNoticeCatalogPage(pageIndex);
    items.push(...page.items);

    if (page.sourceCount < CATALOG_PAGE_SIZE) {
      return filterMainNoticeProjects(items);
    }
  }

  throw new Error(`Public notice catalog exceeded the safe ${CATALOG_MAX_ROWS}-row boundary.`);
}

const getSnapshot = createNoticeSnapshotCache(loadRemotePublicNoticeCatalog);

export async function getPublicNoticeCatalog(): Promise<PublicNoticeCatalogResult> {
  if(isWebsiteRecovery())return getLiveRecoveryCatalog();
  if(isD1Backend())throw new ServiceUnavailableError(503,'D1_PUBLIC_CATALOG_ADAPTER_REQUIRED');
  if (!isPublicNoticeApiV2Enabled() || !hasPublicSupabaseEnvironment()) {
    return { items: getBundledCatalog(), source: 'bundled' };
  }

  return { ...await getSnapshot(), source: 'supabase' };
}

async function loadRemoteNoticeById(id: string) {
  const supabase = getPublicSupabaseClient();
  const { data, error, status } = await supabase
    .from('notices')
    .select(NOTICE_DETAIL_COLUMNS)
    .eq('id', id)
    .eq('year', NOTICE_TARGET_YEAR)
    .eq('is_private', false)
    .eq('admin_status', 'published')
    .is('admin_deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new ServiceUnavailableError(status || 503);
  }

  return data
    ? mapNoticeRowToProject(data as unknown as Record<string, unknown>)
    : null;
}

export async function getCachedNoticeById(id: string) {
  if(isWebsiteRecovery())return getRecoveryDetail(id.trim());
  if(isD1Backend())throw new ServiceUnavailableError(503,'D1_PUBLIC_DETAIL_ADAPTER_REQUIRED');
  const normalizedId = id.trim();
  if (normalizedId.length > 180) throw new ServiceUnavailableError(400, 'invalid_id');
  if (!normalizedId) return null;

  if (!isPublicNoticeApiV2Enabled() || !hasPublicSupabaseEnvironment()) {
    return getBundledCatalog().find((item) => item.id === normalizedId) || null;
  }

  const getCachedRemoteNotice = unstable_cache(
    () => capturePublicRead(() => loadRemoteNoticeById(normalizedId)),
    ['seekoffer-public-notice-detail-emergency-v1', normalizedId],
    {
      revalidate: 300,
      tags: [PUBLIC_NOTICE_CACHE_TAG, publicNoticeCacheTag(normalizedId)]
    }
  );

  return unwrapPublicRead(await getCachedRemoteNotice());
}

export async function getPublicNoticesByIds(ids: string[]) {
  if(isWebsiteRecovery()){
    if(ids.some(id=>typeof id!=='string'||!id.trim()||id.length>180))throw new ServiceUnavailableError(400,'invalid_ids');
    const wanted=new Set(ids.map(i=>i.trim()));return {items:(await getLiveRecoveryCatalog()).items.filter(i=>wanted.has(i.id)).map(toNoticeListItem),source:'recovery' as const};
  }
  if(isD1Backend())throw new ServiceUnavailableError(503,'D1_PUBLIC_BATCH_ADAPTER_REQUIRED');
  if (ids.some(id => typeof id !== 'string' || !id.trim() || id.length > 180)) {
    throw new ServiceUnavailableError(400, 'invalid_ids');
  }
  const normalizedIds = Array.from(new Set(ids.map(id => id.trim())));
  if (!normalizedIds.length) return { items: [], source: 'supabase' as const };
  if (process.env.SEEKOFFER_OFFLINE_FIXTURE && !process.env.VERCEL) {
    const wanted = new Set(normalizedIds);
    return { items: getBundledCatalog().filter(item => wanted.has(item.id)).map(toNoticeListItem), source: 'bundled' as const };
  }
  const supabase = getPublicSupabaseClient();
  const items = [];
  for (let offset = 0; offset < normalizedIds.length; offset += 100) {
    const { data, error, status } = await supabase.from('notices')
      .select(NOTICE_CATALOG_COLUMNS)
      .in('id', normalizedIds.slice(offset, offset + 100))
      .eq('year', NOTICE_TARGET_YEAR).eq('is_private', false)
      .eq('admin_status', 'published').is('admin_deleted_at', null);
    if (error) throw new ServiceUnavailableError(status || 503);
    items.push(...((data || []) as unknown as Record<string, unknown>[])
      .map(mapNoticeRowToProject).filter((item): item is PublicNoticeProject => Boolean(item)).map(toNoticeListItem));
  }
  return { items, source: 'supabase' as const };
}

function addBeijingDays(date: string, days: number) {
  const timestamp = new Date(`${date}T00:00:00+08:00`).getTime();
  return getBeijingDateString(new Date(timestamp + days * 24 * 60 * 60 * 1_000));
}

async function loadRemoteDeadlineNotices(date: string) {
  const supabase = getPublicSupabaseClient();
  const rows: Record<string, unknown>[] = [];

  for (let from = 0; from < DEADLINE_MAX_ROWS; from += DEADLINE_PAGE_SIZE) {
    const { data, error, status } = await supabase
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

    if (error) throw new ServiceUnavailableError(status || 503);

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
  if(isWebsiteRecovery())return {items:(await getLiveRecoveryCatalog()).items.filter(i=>['today','within3days','within7days'].includes(getDeadlineLevelFromDate(i.deadlineDate))),source:'recovery' as const};
  if(isD1Backend())throw new ServiceUnavailableError(503,'D1_DEADLINE_ADAPTER_REQUIRED');
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
    () => capturePublicRead(() => loadRemoteDeadlineNotices(date)),
    ['seekoffer-public-notice-deadlines-emergency-v1', date],
    {
      revalidate: 300,
      tags: [PUBLIC_NOTICE_CACHE_TAG]
    }
  );

  return { items: unwrapPublicRead(await getCachedRemoteDeadlines()), source: 'supabase' as const };
}
