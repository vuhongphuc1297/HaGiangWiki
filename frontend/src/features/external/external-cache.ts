const values = new Map<string, { value: unknown; expiresAt: number }>();
const pending = new Map<string, Promise<unknown>>();
const maxEntries = 240;

export function readExternal<T>(key: string): T | undefined {
  const entry = values.get(key);
  if (!entry) return;
  if (entry.expiresAt > Date.now()) return entry.value as T;
  values.delete(key);
}

export function loadExternal<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const cached = readExternal<T>(key);
  if (cached !== undefined) return Promise.resolve(cached);
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;

  const request = load().then((value) => {
    values.set(key, { value, expiresAt: Date.now() + ttlMs });
    const oldest = values.keys().next();
    if (values.size > maxEntries && !oldest.done) values.delete(oldest.value);
    return value;
  }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
