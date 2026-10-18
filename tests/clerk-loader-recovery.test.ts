import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let active: FakeScript | null;
let scripts: FakeScript[];
class FakeScript extends EventTarget {
  dataset: Record<string, string> = {};
  src = '';
  setAttribute() {}
  remove() { if (active === this) active = null; }
}
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  active = null;
  scripts = [];
  vi.stubGlobal('window', {});
  vi.stubGlobal('document', {
    querySelector: () => active,
    createElement: () => new FakeScript(),
    head: { appendChild: (script: FakeScript) => { active = script; scripts.push(script); } }
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('replaces a failed script and successfully loads on the next attempt', async () => {
  const { getClerk } = await import('../lib/clerk-browser');
  const failed = expect(getClerk()).rejects.toThrow();
  scripts[0].dispatchEvent(new Event('error'));
  await failed;
  expect(active).toBeNull();
  const retry = getClerk();
  const clerk = { load: vi.fn().mockResolvedValue(undefined) };
  Object.assign(window, { Clerk: clerk });
  scripts[1].dispatchEvent(new Event('load'));
  await expect(retry).resolves.toBe(clerk);
  expect(clerk.load).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it('bounds stalled script loading and permits another request', async () => {
  const { getClerk } = await import('../lib/clerk-browser');
  const failed = expect(getClerk()).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(15000);
  await failed;
  const retry = expect(getClerk()).rejects.toThrow();
  expect(scripts).toHaveLength(2);
  scripts[1].dispatchEvent(new Event('error'));
  await retry;
});

it('bounds SDK initialization and token retrieval', async () => {
  const clerk = { load: vi.fn().mockImplementationOnce(() => new Promise(() => {})).mockResolvedValue(undefined), session: { getToken: vi.fn(() => new Promise(() => {})) } };
  Object.assign(window, { Clerk: clerk });
  const { getClerk, getClerkToken } = await import('../lib/clerk-browser');
  const load = expect(getClerk()).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(20000);
  await load;
  await expect(getClerk()).resolves.toBe(clerk);
  const token = expect(getClerkToken()).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(20000);
  await token;
});
