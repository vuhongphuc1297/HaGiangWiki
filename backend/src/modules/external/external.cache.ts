export class ExternalCache<T extends object> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();
  private readonly pending = new Map<string, Promise<T>>();

  constructor(private readonly ttlMs: number, private readonly maxEntries = 1000) {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.entries) {
        if (entry.expiresAt <= now) this.entries.delete(key);
      }
    }, 60_000).unref();
  }

  async getOrLoad(key: string, load: () => Promise<T>, expiresBy = Infinity) {
    const entry = this.entries.get(key);
    if (entry && entry.expiresAt > Date.now()) return { ...entry.value, cached: true };
    this.entries.delete(key);

    const pending = this.pending.get(key);
    if (pending) return { ...await pending, cached: false };

    const loading = load();
    this.pending.set(key, loading);
    try {
      const value = await loading;
      this.entries.set(key, { value, expiresAt: Math.min(Date.now() + this.ttlMs, expiresBy) });
      while (this.entries.size > this.maxEntries) {
        const oldest = this.entries.keys().next();
        if (oldest.done) break;
        this.entries.delete(oldest.value);
      }
      return { ...value, cached: false };
    } finally {
      this.pending.delete(key);
    }
  }
}
