import assert from 'node:assert/strict';
import test from 'node:test';
import { PackingStore } from '../src/features/packing/packing.store.ts';
import type { PackingItem, PackingList } from '../src/types/api.ts';

const item: PackingItem = { id: 'a1', title: 'Bằng lái A', isPacked: false, version: 1, createdAt: '2026-11-20T00:00:00Z', updatedAt: '2026-11-20T00:00:00Z' };
const initial: PackingList = { items: [item], stats: { total: 1, packed: 0, percentage: 0 } };
const empty: PackingList = { items: [], stats: { total: 0, packed: 0, percentage: 0 } };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture() {
  type Options = { method?: string; body?: unknown; signal?: AbortSignal; headers?: Record<string, string> };
  const requests: Array<{ path: string; options?: Options; reply: ReturnType<typeof deferred<unknown>> }> = [];
  const store = new PackingStore(<T>(path: string, options?: Options) => {
    const reply = deferred<unknown>();
    requests.push({ path, options, reply });
    return reply.promise as Promise<T>;
  });
  store.setScope('A:trip:memberA', 'trip');
  const last = () => requests.at(-1)!;
  return { store, requests, last, async load(data = initial) { const read = store.refresh(); last().reply.resolve(data); await read; } };
}
const failure = (status: number) => Object.assign(new Error('Lỗi kiểm thử'), { status });

test('checkbox and progress change before HTTP completes; a second tap cannot enqueue a stale write', async () => {
  const f = fixture(); await f.load();
  const save = f.store.toggle(item.id);
  assert.equal(f.store.getSnapshot().data?.items[0]?.isPacked, true);
  assert.deepEqual(f.store.getSnapshot().data?.stats, { total: 1, packed: 1, percentage: 100 });
  assert.equal(f.store.getSnapshot().busy, true);
  assert.equal(await f.store.toggle(item.id), false);
  assert.equal(f.requests.length, 2);
  assert.deepEqual(f.last().options?.body, { isPacked: true, version: 1 });
  f.last().reply.resolve({ ...item, isPacked: true, version: 2 });
  assert.equal(await save, true);
  assert.equal(f.store.getSnapshot().data?.items[0]?.version, 2);
  assert.equal(f.store.getSnapshot().busy, false);
});

test('failed optimistic save rolls back; retry reuses the same idempotency key and explicit state', async () => {
  const f = fixture(); await f.load();
  const first = f.store.toggle(item.id);
  const key = f.last().options?.headers?.['Idempotency-Key'];
  f.last().reply.reject(failure(0)); await first;
  assert.deepEqual(f.store.getSnapshot().data, initial);
  assert.match(f.store.getSnapshot().error!, /hoàn tác/);
  const retry = f.store.toggle(item.id);
  assert.equal(f.last().options?.headers?.['Idempotency-Key'], key);
  assert.deepEqual(f.last().options?.body, { isPacked: true, version: 1 });
  f.last().reply.resolve({ ...item, isPacked: true, version: 2 }); await retry;
  assert.equal(f.store.getSnapshot().data?.stats.packed, 1);
});

test('an older GET cannot undo the optimistic checkbox even if abort is ignored by transport', async () => {
  const f = fixture(); await f.load();
  const oldRead = f.store.refresh(); const pending = f.last();
  const save = f.store.toggle(item.id);
  assert.equal(pending.options?.signal?.aborted, true);
  pending.reply.resolve(initial); await oldRead;
  assert.equal(f.store.getSnapshot().data?.stats.percentage, 100);
  f.last().reply.resolve({ ...item, isPacked: true, version: 2 }); await save;
});

test('refresh during save waits for commit and cannot fetch the old snapshot', async () => {
  const f = fixture(); await f.load();
  const save = f.store.toggle(item.id);
  await f.store.refresh(); await f.store.refresh();
  assert.equal(f.requests.length, 2);
  const packed = { ...item, isPacked: true, version: 2 };
  f.last().reply.resolve(packed);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(f.requests.length, 3);
  f.last().reply.resolve({ items: [packed], stats: { total: 1, packed: 1, percentage: 100 } });
  await save;
  assert.equal(f.store.getSnapshot().data?.stats.packed, 1);
});

test('switching user/trip clears private data and ignores late successful or failed writes', async () => {
  for (const succeeds of [true, false]) {
    const f = fixture(); await f.load();
    const save = f.store.toggle(item.id); const pending = f.last();
    f.store.setScope('B:trip:memberB', 'trip');
    assert.equal(f.store.getSnapshot().data, null);
    await f.load(empty);
    if (succeeds) pending.reply.resolve({ ...item, isPacked: true }); else pending.reply.reject(failure(0));
    assert.equal(await save, false);
    assert.deepEqual(f.store.getSnapshot().data, empty);
    assert.equal(f.store.getSnapshot().error, null);
    assert.equal(f.store.getSnapshot().busy, false);
  }
});

test('late reads after logout or account change never repopulate private data', async () => {
  const f = fixture();
  const read = f.store.refresh();
  f.store.setScope(null, null);
  f.last().reply.resolve(initial); await read;
  assert.equal(f.store.getSnapshot().scope, null);
  assert.equal(f.store.getSnapshot().data, null);
  const count = f.requests.length;
  await f.store.refresh(); await f.store.add('Đồ từ phiên cũ');
  assert.equal(f.requests.length, count);
});

test('a version conflict restores the checkbox, reloads current state and explains recovery', async () => {
  const f = fixture(); await f.load();
  const save = f.store.toggle(item.id);
  f.last().reply.reject(failure(409));
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(f.store.getSnapshot().data, initial);
  assert.match(f.store.getSnapshot().notice!, /thiết bị khác/);
  assert.equal(f.last().options?.method, undefined);
  f.last().reply.resolve({ ...initial, items: [{ ...item, title: 'Tên mới từ máy khác', version: 2 }] });
  assert.equal(await save, false);
  assert.equal(f.store.getSnapshot().data?.items[0]?.title, 'Tên mới từ máy khác');
  assert.equal(f.store.getSnapshot().error, null);
});

test('authorization failures clear the snapshot; transient read failures retain it', async () => {
  const f = fixture(); await f.load();
  const read = f.store.refresh(); f.last().reply.reject(failure(0)); await read;
  assert.deepEqual(f.store.getSnapshot().data, initial);
  const save = f.store.toggle(item.id); f.last().reply.reject(failure(403)); await save;
  assert.equal(f.store.getSnapshot().data, null);
  await f.load();
  const denied = f.store.refresh(); f.last().reply.reject(failure(401)); await denied;
  assert.equal(f.store.getSnapshot().data, null);
});

test('ambiguous create retry after reload upserts the replayed ID instead of duplicating the row', async () => {
  const f = fixture(); await f.load(empty);
  const first = f.store.add(item.title); const key = f.last().options?.headers?.['Idempotency-Key'];
  f.last().reply.reject(failure(0)); await first;
  await f.load(initial);
  const retry = f.store.add(item.title);
  assert.equal(f.last().options?.headers?.['Idempotency-Key'], key);
  f.last().reply.resolve(item); await retry;
  assert.equal(f.store.getSnapshot().data?.items.length, 1);
});
