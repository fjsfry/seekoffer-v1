import {afterEach, beforeEach, expect, it, vi} from 'vitest';

const owner = '00000000-0000-4000-8000-000000000001';
const mocks = vi.hoisted(() => ({
  userId: '00000000-0000-4000-8000-000000000001', loggedIn: true, legacy: vi.fn(), client: vi.fn()
}));
vi.mock('../lib/user-session', () => ({
  getUserSession: () => ({loggedIn: mocks.loggedIn, authProvider: 'password', userId: mocks.userId}),
  updateUserProfile: vi.fn()
}));
vi.mock('../lib/clerk-d1-session', () => ({d1ClientForUser: mocks.client, updateD1Profile: vi.fn(), D1SessionChangedError: class extends Error {}}));
vi.mock('../lib/supabase-browser', () => ({getSupabaseBrowserClient: mocks.legacy}));

beforeEach(() => {
  vi.resetModules(); vi.stubEnv('NEXT_PUBLIC_BACKEND_PROVIDER', 'd1');
  mocks.userId = owner; mocks.loggedIn = true; mocks.legacy.mockReset(); mocks.client.mockReset();
  const row = {id: 'local-application', project_id: null, sync_revision: 3, is_favorited: true,
    my_status: '已收藏', priority_level: '中', materials_progress: 0, cv_ready: false, transcript_ready: false,
    ranking_proof_ready: false, recommendation_ready: false, personal_statement_ready: false,
    contact_supervisor_done: false, submitted_at: '', interview_time: '', result_status: '未出结果',
    my_notes: '合成旧备注', custom_reminder_enabled: true};
  const data = new Map<string, string>([['seekoffer-d1-applications-v1:' + owner, JSON.stringify({
    version: 1, rows: [row], drafts: {[row.id]: {expectedRevision: 3, patch: {my_notes: '合成待同步备注'}}},
    deletes: {}, adds: [], manuals: {}
  })]]);
  vi.stubGlobal('window', {localStorage: {getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value)}});
});
afterEach(() => {vi.unstubAllGlobals(); vi.unstubAllEnvs();});

it('keeps the owner application and unsynced note without a notice or any network access', async () => {
  const {readLocalApplicationRows, hasPendingApplicationEdits} = await import('../lib/cloudbase-data');
  const rows = readLocalApplicationRows(owner);
  expect(rows).toHaveLength(1);
  expect(rows[0].item.myNotes).toBe('合成待同步备注');
  expect(rows[0].item.userId).toBe(owner);
  expect(rows[0].syncStatus).toBe('pending');
  expect(rows[0].noticeAvailable).toBe(false);
  expect(rows[0].project.schoolName).toBe('通知待同步');
  expect(hasPendingApplicationEdits(owner, 'local-application')).toBe(true);
  expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.legacy).not.toHaveBeenCalled();
});

it('never uses the prior owner journal after an account switch', async () => {
  const {readLocalApplicationRows} = await import('../lib/cloudbase-data');
  expect(readLocalApplicationRows(owner)).toHaveLength(1);
  mocks.userId = '00000000-0000-4000-8000-000000000002';
  expect(readLocalApplicationRows(owner)).toEqual([]);
  expect(readLocalApplicationRows(mocks.userId)).toEqual([]);
  expect(mocks.legacy).not.toHaveBeenCalled();
});

it('does not expose the cached owner journal after logout', async () => {
  const {readLocalApplicationRows} = await import('../lib/cloudbase-data');
  expect(readLocalApplicationRows(owner)).toHaveLength(1);
  mocks.loggedIn = false;
  expect(readLocalApplicationRows(owner)).toEqual([]);
  expect(mocks.legacy).not.toHaveBeenCalled();
});
