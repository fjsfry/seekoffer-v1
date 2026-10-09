/** One authenticated owner at a time, with cancellation and stale-response rejection. */
export class OwnedRequestCache<T> {
  private key: string | null = null;
  private generation = 0;
  private value: { data: T; at: number } | null = null;
  private pending: { promise: Promise<T>; controller: AbortController } | null = null;
  constructor(private ttlMs = 60_000) {}
  select(key: string | null) {
    if (this.key === key) return;
    this.pending?.controller.abort();
    this.key = key; this.generation++; this.value = null; this.pending = null;
  }
  clear() { this.select(null); }
  async read(key: string, fetcher: (signal: AbortSignal) => Promise<T>, force = false): Promise<T> {
    this.select(key);
    if (!force && this.value && Date.now() - this.value.at < this.ttlMs) return this.value.data;
    if (this.pending) return this.pending.promise;
    const generation = this.generation, controller = new AbortController();
    const promise = fetcher(controller.signal).then(data => {
      if (generation !== this.generation || key !== this.key || controller.signal.aborted) throw new DOMException('Account changed', 'AbortError');
      this.value = { data, at: Date.now() };
      return data;
    }).finally(() => { if (generation === this.generation) this.pending = null; });
    this.pending = { promise, controller };
    return promise;
  }
}
