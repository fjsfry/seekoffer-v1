import { describe, expect, it, vi } from 'vitest';
import { createPinnedD1Client, D1SessionChangedError, type ClerkBrowser } from '../lib/clerk-d1-session';

function account(): ClerkBrowser {
  return { load: async () => {}, session: { id: 'synthetic-session-a', getToken: async () => 'synthetic-token' }, user: { id: 'user_synthetic_a' }, addListener: () => () => {}, signOut: async () => {} };
}

describe('desktop owner-pinned cloud requests', () => {
  it('binds each private call to the validated UUID and bearer credential', async () => {
    const sdk = account();
    const fetcher = vi.fn(async () => Response.json({ completed_todo_ids: [], custom_todos: [], mentor_contacts: [] }));
    const pin = createPinnedD1Client(async () => sdk, () => 'synthetic-owner-a', 'https://migration.seekoffer.com.cn', fetcher);
    const client = await pin('synthetic-owner-a');
    await client.workbench();
    const init = (fetcher.mock.calls[0] as unknown as [RequestInfo, RequestInit])[1];
    const headers = new Headers(init.headers);
    expect(headers.get('X-Workspace-Owner')).toBe('synthetic-owner-a');
    expect(headers.get('Authorization')).toBe('Bearer synthetic-token');
  });

  it('does not send a request for an unbound local owner', async () => {
    const fetcher = vi.fn();
    const pin = createPinnedD1Client(async () => account(), () => 'synthetic-owner-a', 'https://migration.seekoffer.com.cn', fetcher);
    await expect(pin('synthetic-owner-b')).rejects.toBeInstanceOf(D1SessionChangedError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('discards an old owner response if the active account changes in flight', async () => {
    const sdk = account();
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>(done => { resolve = done; }));
    const pin = createPinnedD1Client(async () => sdk, () => 'synthetic-owner-a', 'https://migration.seekoffer.com.cn', fetcher);
    const client = await pin('synthetic-owner-a');
    const response = client.workbench();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    sdk.user = { id: 'user_synthetic_b' };
    resolve(Response.json({ private: 'synthetic-a' }));
    await expect(response).rejects.toBeInstanceOf(D1SessionChangedError);
  });
});
