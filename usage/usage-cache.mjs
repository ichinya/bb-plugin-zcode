// Failed refreshes preserve the previous observation time, never stale numbers
// presented as fresh. Each plan and saved account generation has its own cache.
export class PlanUsageCache {
  constructor({ now = Date.now, ttl = 60_000 } = {}) { this.now = now; this.ttl = ttl; this.cache = new Map(); this.pending = new Map(); }
  async get(plan, scope, refresh, collect) {
    const key = JSON.stringify([plan, scope]);
    for (const old of this.cache.keys()) if (JSON.parse(old)[0] === plan && old !== key) this.cache.delete(old);
    const saved = this.cache.get(key);
    if (!refresh && saved && this.now() - saved.observedAt < this.ttl) return saved;
    if (this.pending.has(key)) return this.pending.get(key);
    const pending = Promise.resolve().then(collect).then(usage => {
      const result = { accountKey: null, observedAt: usage.status === "ok" ? this.now() : saved?.observedAt ?? null, usage };
      if (usage.status === "ok") this.cache.set(key, result);
      return result;
    }).finally(() => this.pending.delete(key));
    this.pending.set(key, pending); return pending;
  }
  clear() { this.cache.clear(); this.pending.clear(); }
}
