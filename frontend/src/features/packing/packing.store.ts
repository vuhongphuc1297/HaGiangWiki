import type { PackingCategory, PackingItem, PackingList, PackingTemplateResult } from '../../types/api.ts';

type Request = <T>(path: string, options?: { method?: string; body?: unknown; signal?: AbortSignal; headers?: Record<string, string> }) => Promise<T>;
export type PackingState = {
  scope: string | null; data: PackingList | null; loading: boolean; refreshing: boolean;
  busy: boolean; pendingId: string | null; error: string | null; notice: string | null;
};
export const emptyPackingState: PackingState = {
  scope: null, data: null, loading: false, refreshing: false, busy: false, pendingId: null, error: null, notice: null,
};

function withItems(previous: PackingList, items: PackingItem[]): PackingList {
  const packed = items.filter((item) => item.isPacked).length;
  return { ...previous, items, stats: { total: items.length, packed, percentage: items.length ? Math.round(packed * 100 / items.length) : 0 } };
}
const statusOf = (reason: unknown) => reason && typeof reason === 'object' && 'status' in reason ? reason.status : undefined;

// Kept outside React so request ordering and optimistic recovery can be tested
// with deferred requests, without replacing the real backend in browser checks.
export class PackingStore {
  private state: PackingState = emptyPackingState;
  private listeners = new Set<() => void>();
  private request: Request;
  private path: string | null = null;
  private epoch = 0;
  private readId = 0;
  private read: AbortController | null = null;
  private queuedRefresh = false;
  private retries = new Map<string, string>();

  constructor(request: Request) { this.request = request; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(next: PackingState) { this.state = next; this.listeners.forEach((listener) => listener()); }

  setScope(scope: string | null, tripId: string | null) {
    if (this.state.scope === scope) return;
    this.epoch++;
    this.readId++;
    this.read?.abort();
    this.read = null;
    this.path = tripId ? `/trips/${encodeURIComponent(tripId)}/packing` : null;
    this.queuedRefresh = false;
    this.retries.clear();
    this.publish({ ...emptyPackingState, scope, loading: scope !== null });
  }

  refresh = async () => {
    if (!this.path || !this.state.scope) return;
    // A GET started during a write could restore the pre-write checkbox state.
    if (this.state.busy) { this.queuedRefresh = true; return; }
    this.read?.abort();
    const controller = new AbortController();
    this.read = controller;
    const epoch = this.epoch;
    const readId = ++this.readId;
    this.publish({ ...this.state, loading: !this.state.data, refreshing: !!this.state.data, error: null });
    try {
      const data = await this.request<PackingList>(this.path, { signal: controller.signal });
      if (epoch === this.epoch && readId === this.readId) this.publish({ ...this.state, data, loading: false, refreshing: false });
    } catch (reason) {
      if (epoch !== this.epoch || readId !== this.readId || controller.signal.aborted) return;
      const denied = [401, 403, 404].includes(Number(statusOf(reason)));
      this.publish({ ...this.state, data: denied ? null : this.state.data, loading: false, refreshing: false,
        error: reason instanceof Error ? reason.message : 'Chưa tải được hành trang. Hãy thử lại.' });
    } finally { if (this.read === controller) this.read = null; }
  };

  private async write<T>(suffix: string, method: string, body: unknown, apply: (result: T, previous: PackingList) => PackingList,
    options: { itemId?: string; optimistic?: PackingList; notice?: (result: T) => string } = {}): Promise<T | null> {
    if (!this.path || !this.state.data || this.state.busy) return null;
    const epoch = this.epoch;
    const previous = this.state.data;
    const path = this.path + suffix;
    const fingerprint = JSON.stringify([path, method, body]);
    const key = this.retries.get(fingerprint) ?? crypto.randomUUID();
    this.retries.set(fingerprint, key);
    if (this.retries.size > 60) this.retries.delete(this.retries.keys().next().value!);
    this.readId++;
    this.read?.abort();
    this.publish({ ...this.state, data: options.optimistic ?? previous, loading: false, refreshing: false,
      busy: true, pendingId: options.itemId ?? null, error: null, notice: null });
    let result: T;
    try {
      result = await this.request<T>(path, { method, body, headers: { 'Idempotency-Key': key } });
      if (epoch !== this.epoch) return null;
      this.retries.delete(fingerprint);
      this.publish({ ...this.state, data: apply(result, previous), notice: options.notice?.(result) ?? null });
    } catch (reason) {
      if (epoch !== this.epoch) return null;
      const status = Number(statusOf(reason));
      const conflict = status === 409 && options.itemId !== undefined;
      const denied = [401, 403, 404].includes(status);
      if (status >= 400 && status < 500) this.retries.delete(fingerprint);
      this.publish({ ...this.state, data: denied ? null : previous,
        error: conflict ? null : `${reason instanceof Error ? reason.message : 'Chưa lưu được hành trang.'}${options.optimistic && !denied ? ' Đã hoàn tác dấu tích. Hãy thử lại.' : ''}`,
        notice: conflict ? 'Món đồ vừa thay đổi trên thiết bị khác. Đã tải lại hành trang; hãy kiểm tra trước khi thử lại.' : null });
      if (conflict || status === 404) this.queuedRefresh = true;
      return null;
    } finally {
      if (epoch === this.epoch) {
        this.publish({ ...this.state, busy: false, pendingId: null });
        if (this.queuedRefresh) { this.queuedRefresh = false; await this.refresh(); }
      }
    }
    return epoch === this.epoch ? result : null;
  }

  createCategory = async (name: string) => {
    const result = await this.write<{ category: PackingCategory }>('/categories', 'POST', { name: name.trim() },
      ({ category }, previous) => ({
        ...previous, categories: previous.categories.some((value) => value.id === category.id)
          ? previous.categories : [...previous.categories, category],
      }), { notice: ({ category }) => `Đã tạo danh mục “${category.name}”.` });
    return result?.category ?? null;
  };

  add = (title: string, categoryId?: string | null) => this.write<PackingItem>('', 'POST', { title: title.trim(), categoryId },
    (item, previous) => withItems(previous, previous.items.some((value) => value.id === item.id)
      ? previous.items.map((value) => value.id === item.id ? item : value) : [...previous.items, item]),
    { notice: () => 'Đã thêm món đồ vào balo.' }).then(Boolean);

  toggle = (id: string) => {
    const previous = this.state.data;
    const item = previous?.items.find((value) => value.id === id);
    if (!item || !previous) return Promise.resolve(false);
    return this.write<PackingItem>(`/${encodeURIComponent(id)}`, 'PATCH', { isPacked: !item.isPacked, version: item.version },
      (saved, before) => withItems(before, before.items.map((value) => value.id === id ? saved : value)), {
        itemId: id, optimistic: withItems(previous, previous.items.map((value) => value.id === id ? { ...value, isPacked: !item.isPacked } : value)),
      }).then(Boolean);
  };

  rename = (item: PackingItem, title: string, categoryId?: string | null) => this.write<PackingItem>(`/${encodeURIComponent(item.id)}`, 'PATCH',
    { title: title.trim(), categoryId, version: item.version }, (saved, previous) => withItems(previous, previous.items.map((value) => value.id === item.id ? saved : value)),
    { itemId: item.id, notice: () => 'Đã cập nhật món đồ.' }).then(Boolean);

  remove = (item: PackingItem) => this.write<PackingItem>(`/${encodeURIComponent(item.id)}`, 'DELETE', { version: item.version },
    (_, previous) => withItems(previous, previous.items.filter((value) => value.id !== item.id)), { itemId: item.id, notice: () => 'Đã xóa món đồ khỏi balo.' }).then(Boolean);

  templates = () => this.write<PackingTemplateResult>('/templates', 'POST', {}, ({ categories, items, stats }) => ({ categories, items, stats }), {
    notice: (result) => result.addedCount ? `Đã thêm ${result.addedCount} gợi ý vào balo của bạn.` : 'Bạn đã có đủ 7 món gợi ý. Không thêm món trùng.',
  }).then(Boolean);
}
