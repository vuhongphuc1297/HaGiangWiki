import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { app } from '../app.js';
import { prisma } from '../config/database.js';
import { deleteStop, reorderStops, updateStop } from '../modules/stop/stop.service.js';
import { updateTrip } from '../modules/trip/trip.service.js';

type StopPayload = {
  id: string; tripId: string; name: string; category: string | null; day: number; orderIndex: number;
  arriveTime: string | null; leaveTime: string | null; estimatedCost: string; notes: string | null;
  latitude: number | null; longitude: number | null; version: number; deletedAt: string | null;
};
type TripPayload = {
  id: string; title: string; startDate: string; durationDays: number; vehicle: string; budget: string;
  timezone: string; version: number; stops: StopPayload[]; movedStopsCount: number;
};
type ApiOptions = { method?: string; cookie?: string; key?: string; body?: unknown };
const conflictMessage = 'Điểm dừng vừa được thay đổi trên thiết bị khác. Vui lòng tải lại trước khi sửa tiếp.';

test('Stop CRUD, safe reordering and lossless trip duration updates over HTTP/PostgreSQL', { timeout: 120_000 }, async (t) => {
  const prefix = `stop-${randomUUID()}`;
  const userIds: string[] = [];
  const tripIds: string[] = [];
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  t.after(async () => {
    const closed = new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    server.closeAllConnections();
    await closed;
    try {
      await prisma.trip.deleteMany({ where: { id: { in: tripIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      assert.equal(await prisma.trip.count({ where: { title: { startsWith: prefix } } }), 0);
      assert.equal(await prisma.user.count({ where: { displayName: { startsWith: prefix } } }), 0);
    } finally {
      await prisma.$disconnect();
    }
  });

  async function api<T = Record<string, unknown>>(path: string, options: ApiOptions = {}) {
    const headers = new Headers();
    if (options.cookie) headers.set('Cookie', options.cookie);
    if (options.key) headers.set('Idempotency-Key', options.key);
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET', headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(25_000),
    });
    const body = await response.json() as T;
    return { response, body };
  }

  async function register(suffix: string) {
    const result = await api<{ id: string }>('/api/auth/register-anonymous', { method: 'POST', body: { displayName: `${prefix}-${suffix}` } });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    userIds.push(result.body.id);
    const cookie = result.response.headers.getSetCookie().find((value) => value.startsWith('session_token='))?.split(';')[0];
    assert.ok(cookie);
    return { id: result.body.id, cookie };
  }

  const owner = await register('owner');
  const member = await register('member');
  const outsider = await register('outsider');

  async function newTrip(suffix: string, durationDays = 3) {
    const result = await api<TripPayload>('/api/trips', { method: 'POST', cookie: owner.cookie, body: {
      title: `${prefix}-${suffix}`, startDate: '2026-11-20', durationDays, vehicle: 'XE_MAY', budget: 5_000_000,
    } });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    tripIds.push(result.body.id);
    return result.body;
  }

  async function add(tripId: string, day: number, name = 'Điểm dừng', fields: Record<string, unknown> = {}) {
    const result = await api<StopPayload>(`/api/trips/${tripId}/stops`, { method: 'POST', cookie: owner.cookie, body: { name, day, ...fields } });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    return result.body;
  }

  const currentTrip = (id: string) => prisma.trip.findUniqueOrThrow({ where: { id } });
  const currentStop = (id: string) => prisma.stop.findUniqueOrThrow({ where: { id } });
  const dayStops = (tripId: string, day: number) => prisma.stop.findMany({ where: { tripId, day, deletedAt: null }, orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }] });
  const allStops = (tripId: string) => prisma.stop.findMany({ where: { tripId }, orderBy: { id: 'asc' } });
  const stopsUrl = (tripId: string) => `/api/trips/${tripId}/stops`;

  await t.test('PATCH edits every supported field, increments versions and serializes BigInt', async () => {
    const trip = await newTrip('edit');
    const stop = await add(trip.id, 1, 'Tên cũ');
    const before = await currentTrip(trip.id);
    const fields = { name: '  Cổng trời Quản Bạ  ', category: 'Ngắm cảnh', day: 1, arriveTime: '09:30', leaveTime: '10:30', estimatedCost: 60_000, notes: 'Chụp ảnh', latitude: 23.0567, longitude: 104.9876 };
    const result = await api<StopPayload>(`${stopsUrl(trip.id)}/${stop.id}`, { method: 'PATCH', cookie: owner.cookie, body: { ...fields, version: stop.version } });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.name, fields.name.trim());
    assert.equal(result.body.category, fields.category);
    assert.equal(result.body.arriveTime, fields.arriveTime);
    assert.equal(result.body.leaveTime, fields.leaveTime);
    assert.equal(result.body.notes, fields.notes);
    assert.equal(result.body.estimatedCost, '60000');
    assert.equal(result.body.latitude, fields.latitude);
    assert.equal(result.body.longitude, fields.longitude);
    assert.equal(result.body.version, stop.version + 1);
    assert.equal(result.body.orderIndex, stop.orderIndex);
    assert.equal((await currentStop(stop.id)).estimatedCost, 60_000n);
    assert.equal((await currentTrip(trip.id)).version, before.version + 1);
  });

  await t.test('partial PATCH preserves omitted fields and permits clearing nullable fields and zero cost', async () => {
    const trip = await newTrip('partial');
    const stop = await add(trip.id, 2, 'Giữ tên', { estimatedCost: 99_000, category: 'Ăn uống', arriveTime: '12:00', leaveTime: '13:00', notes: 'Ghi chú', latitude: 23, longitude: 105 });
    const path = `${stopsUrl(trip.id)}/${stop.id}`;
    const first = await api<StopPayload>(path, { method: 'PATCH', cookie: owner.cookie, body: { notes: 'Sửa ghi chú', version: 1 } });
    assert.equal(first.response.status, 200);
    assert.equal(first.body.day, 2);
    assert.equal(first.body.name, 'Giữ tên');
    assert.equal(first.body.estimatedCost, '99000');
    const cleared = await api<StopPayload>(path, { method: 'PATCH', cookie: owner.cookie, body: { category: null, arriveTime: null, leaveTime: null, estimatedCost: 0, notes: null, latitude: null, longitude: null, version: 2 } });
    assert.equal(cleared.response.status, 200);
    for (const key of ['category', 'arriveTime', 'leaveTime', 'notes', 'latitude', 'longitude'] as const) assert.equal(cleared.body[key], null);
    assert.equal(cleared.body.estimatedCost, '0');
  });

  await t.test('stale PATCH and DELETE return the exact conflict payload and do not change DB/cache', async () => {
    const trip = await newTrip('stale');
    const stop = await add(trip.id, 1);
    const path = `${stopsUrl(trip.id)}/${stop.id}`;
    assert.equal((await api(path, { method: 'PATCH', cookie: owner.cookie, body: { name: 'Mới', version: 1 } })).response.status, 200);
    const snapshot = { trip: await currentTrip(trip.id), stops: await allStops(trip.id) };
    for (const method of ['PATCH', 'DELETE']) {
      const result = await api(path, { method, cookie: owner.cookie, key: `stale-${method}`, body: { name: 'Sai', version: 1 } });
      assert.equal(result.response.status, 409);
      assert.deepEqual(result.body, { error: conflictMessage, currentVersion: 2 });
    }
    const query = await api(`${path}?version=1`, { method: 'DELETE', cookie: owner.cookie });
    assert.equal(query.response.status, 409);
    assert.deepEqual(query.body, { error: conflictMessage, currentVersion: 2 });
    assert.deepEqual({ trip: await currentTrip(trip.id), stops: await allStops(trip.id) }, snapshot);
    assert.equal(await prisma.idempotencyRecord.count({ where: { tripId: trip.id } }), 0);
  });

  await t.test('moving a stop appends to its destination and compacts its source day', async () => {
    const trip = await newTrip('move');
    const a = await add(trip.id, 1, 'A');
    const b = await add(trip.id, 1, 'B');
    const c = await add(trip.id, 1, 'C');
    const staged = await add(trip.id, 0, 'Kho');
    const result = await api<StopPayload>(`${stopsUrl(trip.id)}/${b.id}`, { method: 'PATCH', cookie: owner.cookie, body: { day: 0, name: 'B mới', version: 1 } });
    assert.equal(result.response.status, 200);
    assert.deepEqual([result.body.day, result.body.orderIndex, result.body.version], [0, 2, 2]);
    assert.deepEqual((await dayStops(trip.id, 1)).map((stop) => [stop.id, stop.orderIndex, stop.version]), [[a.id, 1, 1], [c.id, 2, 2]]);
    assert.deepEqual((await dayStops(trip.id, 0)).map((stop) => stop.id), [staged.id, b.id]);
  });

  await t.test('soft DELETE preserves its expense and compacts only active stops in the same day', async () => {
    const trip = await newTrip('delete');
    const a = await add(trip.id, 1, 'A');
    const b = await add(trip.id, 1, 'B');
    const c = await add(trip.id, 1, 'C');
    const other = await add(trip.id, 2, 'Ngày khác');
    const payer = await prisma.tripMember.findUniqueOrThrow({ where: { tripId_userId: { tripId: trip.id, userId: owner.id } } });
    const expense = await prisma.expense.create({ data: { tripId: trip.id, stopId: b.id, payerMemberId: payer.id, amount: 10_000n, title: 'Vé', idempotencyKey: 'expense' } });
    const before = await currentTrip(trip.id);
    const result = await api<StopPayload>(`${stopsUrl(trip.id)}/${b.id}`, { method: 'DELETE', cookie: owner.cookie, body: { version: 1 } });
    assert.equal(result.response.status, 200);
    assert.ok(result.body.deletedAt);
    assert.equal(result.body.version, 2);
    assert.ok((await currentStop(b.id)).deletedAt instanceof Date);
    assert.equal(await prisma.stop.count({ where: { tripId: trip.id } }), 4);
    assert.equal((await prisma.expense.findUniqueOrThrow({ where: { id: expense.id } })).stopId, b.id);
    assert.deepEqual((await dayStops(trip.id, 1)).map((stop) => [stop.id, stop.orderIndex, stop.version]), [[a.id, 1, 1], [c.id, 2, 2]]);
    assert.equal((await currentStop(other.id)).version, 1);
    assert.equal((await currentTrip(trip.id)).version, before.version + 1);
    const detail = await api<TripPayload>(`/api/trips/${trip.id}`, { cookie: owner.cookie });
    assert.ok(!detail.body.stops.some((stop) => stop.id === b.id));
    assert.equal((await api(`${stopsUrl(trip.id)}/${c.id}`, { method: 'PATCH', cookie: owner.cookie, body: { name: 'C cũ', version: 1 } })).response.status, 409);
  });

  await t.test('DELETE accepts query version, compacts the staging area and can empty a day', async () => {
    const trip = await newTrip('delete-query');
    const a = await add(trip.id, 0, 'A');
    const b = await add(trip.id, 0, 'B');
    assert.equal((await api(`${stopsUrl(trip.id)}/${a.id}?version=1`, { method: 'DELETE', cookie: owner.cookie })).response.status, 200);
    assert.deepEqual((await dayStops(trip.id, 0)).map((stop) => [stop.id, stop.orderIndex, stop.version]), [[b.id, 1, 2]]);
    assert.equal((await api(`${stopsUrl(trip.id)}/${b.id}?version=2`, { method: 'DELETE', cookie: owner.cookie })).response.status, 200);
    assert.equal((await dayStops(trip.id, 0)).length, 0);
    const next = await add(trip.id, 0);
    assert.equal(next.orderIndex, 1);
  });

  await t.test('foreign, missing and soft-deleted stop IDs cannot be edited or deleted', async () => {
    const trip = await newTrip('scope');
    const foreignTrip = await newTrip('foreign');
    const foreign = await add(foreignTrip.id, 1);
    const deleted = await add(trip.id, 1);
    assert.equal((await api(`${stopsUrl(trip.id)}/${deleted.id}`, { method: 'DELETE', cookie: owner.cookie, body: { version: 1 } })).response.status, 200);
    const before = await currentStop(foreign.id);
    for (const id of [foreign.id, deleted.id, 'missing-stop']) {
      for (const method of ['PATCH', 'DELETE']) {
        assert.equal((await api(`${stopsUrl(trip.id)}/${id}`, { method, cookie: owner.cookie, body: { name: 'Không được sửa', version: 2 } })).response.status, 404);
      }
    }
    assert.deepEqual(await currentStop(foreign.id), before);
  });

  await t.test('Zod rejects invalid stop fields, missing versions and ambiguous DELETE versions', async () => {
    const trip = await newTrip('validation');
    const stop = await add(trip.id, 1);
    const path = `${stopsUrl(trip.id)}/${stop.id}`;
    const invalid = [
      { name: '' }, { category: '' }, { day: -1 }, { day: 1.5 }, { day: 4 }, { arriveTime: '25:00' }, { leaveTime: '12:60' },
      { estimatedCost: -1 }, { estimatedCost: 1.1 }, { estimatedCost: Number.MAX_SAFE_INTEGER + 1 },
      { latitude: 91, longitude: 0 }, { latitude: 0, longitude: 181 }, { latitude: 23 }, { latitude: '23' }, { notes: 'x'.repeat(2001) },
    ];
    for (const fields of invalid) {
      assert.equal((await api(path, { method: 'PATCH', cookie: owner.cookie, body: { ...fields, version: 1 } })).response.status, 400, JSON.stringify(fields));
    }
    for (const version of [undefined, 0, -1, 1.5, '1', null]) {
      for (const method of ['PATCH', 'DELETE']) assert.equal((await api(path, { method, cookie: owner.cookie, body: { version } })).response.status, 400);
    }
    for (const query of ['', '?version=0', '?version=abc', '?version=1.5', '?version=1&version=2']) {
      assert.equal((await api(`${path}${query}`, { method: 'DELETE', cookie: owner.cookie })).response.status, 400);
    }
    assert.equal((await api(`${path}?version=2`, { method: 'DELETE', cookie: owner.cookie, body: { version: 1 } })).response.status, 400);
    assert.equal((await currentStop(stop.id)).version, 1);
  });

  await t.test('reorder persists the requested order of three stops and increments each version once', async () => {
    const trip = await newTrip('reorder');
    const a = await add(trip.id, 1, 'A');
    const b = await add(trip.id, 1, 'B');
    const c = await add(trip.id, 1, 'C');
    const before = await currentTrip(trip.id);
    const stopIds = [c.id, a.id, b.id];
    const result = await api<StopPayload[]>(`${stopsUrl(trip.id)}/reorder`, { method: 'PATCH', cookie: owner.cookie, body: { day: 1, stopIds } });
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body.map((stop) => [stop.id, stop.orderIndex, stop.version]), stopIds.map((id, index) => [id, index + 1, 2]));
    assert.deepEqual((await dayStops(trip.id, 1)).map((stop) => stop.id), stopIds);
    assert.equal((await currentTrip(trip.id)).version, before.version + 1);
    assert.equal((await api(`${stopsUrl(trip.id)}/${a.id}`, { method: 'PATCH', cookie: owner.cookie, body: { name: 'Cũ', version: 1 } })).response.status, 409);
  });

  await t.test('reorder also supports day zero and leaves other days and tombstones untouched', async () => {
    const trip = await newTrip('reorder-staging');
    const a = await add(trip.id, 0, 'A');
    const b = await add(trip.id, 0, 'B');
    const c = await add(trip.id, 0, 'C');
    const other = await add(trip.id, 1);
    await api(`${stopsUrl(trip.id)}/${b.id}`, { method: 'DELETE', cookie: owner.cookie, body: { version: 1 } });
    const tombstone = await currentStop(b.id);
    const result = await api<StopPayload[]>(`${stopsUrl(trip.id)}/reorder`, { method: 'PATCH', cookie: owner.cookie, body: { day: 0, stopIds: [c.id, a.id] } });
    assert.equal(result.response.status, 200);
    assert.deepEqual((await dayStops(trip.id, 0)).map((stop) => [stop.id, stop.orderIndex]), [[c.id, 1], [a.id, 2]]);
    assert.deepEqual(await currentStop(b.id), tombstone);
    assert.equal((await currentStop(other.id)).version, 1);
  });

  await t.test('invalid or incomplete reorder lists reject atomically, including cross-trip/day/deleted IDs', async () => {
    const trip = await newTrip('bad-reorder');
    const a = await add(trip.id, 1, 'A');
    const b = await add(trip.id, 1, 'B');
    const otherDay = await add(trip.id, 2);
    const deleted = await add(trip.id, 1);
    await api(`${stopsUrl(trip.id)}/${deleted.id}`, { method: 'DELETE', cookie: owner.cookie, body: { version: 1 } });
    const foreignTrip = await newTrip('bad-reorder-foreign');
    const foreign = await add(foreignTrip.id, 1);
    const before = { trip: await currentTrip(trip.id), stops: await allStops(trip.id) };
    const cases: [unknown, number][] = [
      [{ day: 1, stopIds: [] }, 400], [{ day: 1, stopIds: [a.id, a.id] }, 400], [{ day: 1, stopIds: [a.id] }, 409],
      ...[otherDay.id, deleted.id, foreign.id, 'missing', ''].map((id): [unknown, number] => [{ day: 1, stopIds: [b.id, id] }, 400]),
      [{ day: -1, stopIds: [a.id, b.id] }, 400], [{ day: 1.5, stopIds: [a.id, b.id] }, 400], [{ day: 4, stopIds: [a.id, b.id] }, 400],
    ];
    for (const [body, status] of cases) {
      const result = await api(`${stopsUrl(trip.id)}/reorder`, { method: 'PATCH', cookie: owner.cookie, key: `bad-${randomUUID()}`, body });
      assert.equal(result.response.status, status, JSON.stringify(body));
    }
    assert.deepEqual({ trip: await currentTrip(trip.id), stops: await allStops(trip.id) }, before);
    assert.equal(await prisma.idempotencyRecord.count({ where: { tripId: trip.id } }), 0);
  });

  await t.test('shrinking 3 days to 2 appends all active day-3 stops to staging without data loss', async () => {
    const trip = await newTrip('shrink');
    const staging = await add(trip.id, 0, 'Có sẵn');
    const keep = await add(trip.id, 2, 'Giữ ngày 2');
    const a = await add(trip.id, 3, 'Ngày 3 A', { estimatedCost: 120_000, notes: 'Không được mất', arriveTime: '08:00', latitude: 23, longitude: 105 });
    const b = await add(trip.id, 3, 'Ngày 3 B');
    const deleted = await add(trip.id, 3, 'Đã xóa');
    await api(`${stopsUrl(trip.id)}/${deleted.id}`, { method: 'DELETE', cookie: owner.cookie, body: { version: 1 } });
    const before = await currentTrip(trip.id);
    const stopsBefore = await allStops(trip.id);
    const result = await api<TripPayload>(`/api/trips/${trip.id}`, { method: 'PATCH', cookie: owner.cookie, body: { durationDays: 2, version: before.version } });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.durationDays, 2);
    assert.equal(result.body.version, before.version + 1);
    assert.equal(result.body.movedStopsCount, 2);
    assert.deepEqual((await dayStops(trip.id, 0)).map((stop) => [stop.id, stop.orderIndex]), [[staging.id, 1], [a.id, 2], [b.id, 3]]);
    assert.equal((await allStops(trip.id)).length, stopsBefore.length);
    for (const original of stopsBefore) {
      const saved = await currentStop(original.id);
      if ([a.id, b.id].includes(original.id)) {
        assert.equal(saved.day, 0);
        assert.equal(saved.version, original.version + 1);
        assert.equal(saved.deletedAt, null);
        assert.deepEqual({ ...saved, day: original.day, orderIndex: original.orderIndex, version: original.version, updatedAt: original.updatedAt }, original);
      } else assert.deepEqual(saved, original);
    }
    assert.equal((await currentStop(keep.id)).day, 2);
    assert.ok(result.body.stops.every((stop) => stop.day <= 2 && stop.deletedAt === null));
    assert.equal((await api(`${stopsUrl(trip.id)}/${a.id}`, { method: 'PATCH', cookie: owner.cookie, body: { name: 'Version cũ', version: 1 } })).response.status, 409);
  });

  await t.test('shrinking several days preserves day/order sequence even with an empty staging area', async () => {
    const trip = await newTrip('multi-shrink', 4);
    const d4 = await add(trip.id, 4, 'Ngày 4');
    const d2a = await add(trip.id, 2, 'Ngày 2 A');
    const d3 = await add(trip.id, 3, 'Ngày 3');
    const d2b = await add(trip.id, 2, 'Ngày 2 B');
    const before = await currentTrip(trip.id);
    const result = await api<TripPayload>(`/api/trips/${trip.id}`, { method: 'PATCH', cookie: owner.cookie, body: { durationDays: 1, version: before.version } });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.movedStopsCount, 4);
    assert.deepEqual((await dayStops(trip.id, 0)).map((stop) => [stop.id, stop.orderIndex, stop.version]), [d2a, d2b, d3, d4].map((stop, index) => [stop.id, index + 1, 2]));
  });

  await t.test('trip configuration PATCH validates date/vehicle/budget and preserves omitted settings', async () => {
    const trip = await newTrip('settings');
    const result = await api<TripPayload>(`/api/trips/${trip.id}`, { method: 'PATCH', cookie: owner.cookie, body: { title: '  Tiêu đề mới  ', startDate: '2026-12-01', durationDays: 5, vehicle: 'O_TO', budget: 0, version: 1 } });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.title, 'Tiêu đề mới');
    assert.equal(result.body.startDate, '2026-12-01T00:00:00.000Z');
    assert.equal(result.body.durationDays, 5);
    assert.equal(result.body.vehicle, 'O_TO');
    assert.equal(result.body.budget, '0');
    assert.equal(result.body.timezone, trip.timezone);
    assert.equal(result.body.movedStopsCount, 0);
    const partial = await api<TripPayload>(`/api/trips/${trip.id}`, { method: 'PATCH', cookie: owner.cookie, body: { title: 'Chỉ sửa tên', version: 2 } });
    assert.equal(partial.response.status, 200);
    assert.deepEqual([partial.body.durationDays, partial.body.vehicle, partial.body.startDate, partial.body.budget], [5, 'O_TO', '2026-12-01T00:00:00.000Z', '0']);
    assert.equal(partial.body.version, 3);
  });

  await t.test('unchanged or increased duration never moves, deletes or increments stop versions', async () => {
    const trip = await newTrip('extend');
    await add(trip.id, 3);
    const before = await allStops(trip.id);
    for (const durationDays of [3, 5, 2]) {
      // For the last reduction, no stops remain beyond day 2 after an explicit move.
      if (durationDays === 2) {
        const stop = (await allStops(trip.id))[0]!;
        await api(`${stopsUrl(trip.id)}/${stop.id}`, { method: 'PATCH', cookie: owner.cookie, body: { day: 1, version: stop.version } });
      }
      const snapshot = await allStops(trip.id);
      const current = await currentTrip(trip.id);
      const result = await api<TripPayload>(`/api/trips/${trip.id}`, { method: 'PATCH', cookie: owner.cookie, body: { durationDays, version: current.version } });
      assert.equal(result.response.status, 200);
      assert.equal(result.body.movedStopsCount, 0);
      assert.deepEqual(await allStops(trip.id), snapshot);
      if (durationDays >= 3) assert.deepEqual(snapshot, before);
    }
  });

  await t.test('stale trip versions reject before moving stops and invalid settings do not write', async () => {
    const trip = await newTrip('trip-validation');
    await add(trip.id, 3);
    const before = { trip: await currentTrip(trip.id), stops: await allStops(trip.id) };
    const stale = await api(`/api/trips/${trip.id}`, { method: 'PATCH', cookie: owner.cookie, key: 'stale-trip', body: { durationDays: 2, version: 1 } });
    assert.equal(stale.response.status, 409);
    assert.equal(stale.body.currentVersion, before.trip.version);
    for (const fields of [{ title: '' }, { startDate: '2026-02-30' }, { durationDays: 0 }, { durationDays: 31 }, { durationDays: 1.5 }, { vehicle: 'INVALID' }, { budget: -1 }, { budget: Number.MAX_SAFE_INTEGER + 1 }, { version: 0 }, { version: '2' }]) {
      assert.equal((await api(`/api/trips/${trip.id}`, { method: 'PATCH', cookie: owner.cookie, body: { version: before.trip.version, ...fields } })).response.status, 400);
    }
    assert.equal((await api(`/api/trips/${trip.id}`, { method: 'PATCH', cookie: owner.cookie, body: { durationDays: 2 } })).response.status, 400);
    assert.deepEqual({ trip: await currentTrip(trip.id), stops: await allStops(trip.id) }, before);
    assert.equal(await prisma.idempotencyRecord.count({ where: { tripId: trip.id } }), 0);
  });

  await t.test('only ACTIVE members mutate stops; only OWNER can update trip configuration', async () => {
    const trip = await newTrip('access');
    const stop = await add(trip.id, 1);
    await prisma.tripMember.create({ data: { tripId: trip.id, userId: member.id, nickname: 'Bạn', role: 'MEMBER' } });
    const path = `${stopsUrl(trip.id)}/${stop.id}`;
    const actions: [string, string, unknown][] = [
      [path, 'PATCH', { name: 'Mới', version: 1 }], [path, 'DELETE', { version: 1 }],
      [`${stopsUrl(trip.id)}/reorder`, 'PATCH', { day: 1, stopIds: [stop.id] }],
      [`/api/trips/${trip.id}`, 'PATCH', { title: 'Không được', version: (await currentTrip(trip.id)).version }],
    ];
    for (const cookie of [undefined, outsider.cookie]) {
      for (const [url, method, body] of actions) assert.equal((await api(url, { method, cookie, body })).response.status, cookie ? 403 : 401);
    }
    assert.equal((await api(`/api/trips/${trip.id}`, { method: 'PATCH', cookie: member.cookie, body: { durationDays: 2, version: (await currentTrip(trip.id)).version } })).response.status, 403);
    const edited = await api<StopPayload>(path, { method: 'PATCH', cookie: member.cookie, key: 'member-edit', body: { name: 'Thành viên sửa', version: 1 } });
    assert.equal(edited.response.status, 200);
    assert.equal((await api(`${stopsUrl(trip.id)}/reorder`, { method: 'PATCH', cookie: member.cookie, body: { day: 1, stopIds: [stop.id] } })).response.status, 200);
    const version = (await currentStop(stop.id)).version;
    assert.equal((await api(path, { method: 'DELETE', cookie: member.cookie, body: { version } })).response.status, 200);
    await prisma.tripMember.update({ where: { tripId_userId: { tripId: trip.id, userId: member.id } }, data: { status: 'REVOKED', revokedAt: new Date() } });
    assert.equal((await api(path, { method: 'PATCH', cookie: member.cookie, key: 'member-edit', body: { name: 'Thành viên sửa', version: 1 } })).response.status, 403);
  });

  await t.test('idempotent edit, reorder, DELETE and trip shrink each commit once and replay identical results', async () => {
    const trip = await newTrip('idempotency');
    const a = await add(trip.id, 3, 'A');
    const b = await add(trip.id, 3, 'B');
    const actions: [string, string, string, unknown][] = [
      [`${stopsUrl(trip.id)}/${a.id}`, 'PATCH', 'edit', { notes: 'Một lần', version: 1 }],
      [`${stopsUrl(trip.id)}/reorder`, 'PATCH', 'reorder', { day: 3, stopIds: [b.id, a.id] }],
    ];
    for (const [path, method, key, body] of actions) {
      const results = await Promise.all(Array.from({ length: 3 }, () => api(path, { method, cookie: owner.cookie, key, body })));
      assert.ok(results.every((result) => result.response.status === 200), JSON.stringify(results.map((result) => result.body)));
      assert.equal(results.filter((result) => result.response.headers.get('X-Cache') === 'MISS').length, 1);
      assert.deepEqual(results[0]!.body, results[1]!.body);
    }
    const before = await currentTrip(trip.id);
    const shrinkBody = { durationDays: 2, version: before.version };
    const first = await api<TripPayload>(`/api/trips/${trip.id}`, { method: 'PATCH', cookie: owner.cookie, key: 'shrink', body: shrinkBody });
    const replay = await api<TripPayload>(`/api/trips/${trip.id}`, { method: 'PATCH', cookie: owner.cookie, key: 'shrink', body: shrinkBody });
    assert.equal(first.response.status, 200);
    assert.equal(first.body.movedStopsCount, 2);
    assert.equal(replay.response.headers.get('X-Cache'), 'HIT');
    assert.deepEqual(replay.body, first.body);
    assert.equal((await currentTrip(trip.id)).version, before.version + 1);
    const stop = await currentStop(a.id);
    const path = `${stopsUrl(trip.id)}/${a.id}?version=${stop.version}`;
    const deleted = await api(path, { method: 'DELETE', cookie: owner.cookie, key: 'delete' });
    const deletedReplay = await api(path, { method: 'DELETE', cookie: owner.cookie, key: 'delete' });
    assert.equal(deleted.response.status, 200);
    assert.equal(deletedReplay.response.headers.get('X-Cache'), 'HIT');
    assert.deepEqual(deletedReplay.body, deleted.body);
    assert.equal((await currentStop(a.id)).version, stop.version + 1);
    assert.equal(await prisma.idempotencyRecord.count({ where: { tripId: trip.id } }), 4);
  });

  await t.test('simultaneous edits with the same version have exactly one winner', async () => {
    const trip = await newTrip('edit-race');
    const stop = await add(trip.id, 1);
    const results = await Promise.all(Array.from({ length: 4 }, (_, index) => api(`${stopsUrl(trip.id)}/${stop.id}`, { method: 'PATCH', cookie: owner.cookie, body: { name: `Sửa ${index}`, version: 1 } })));
    assert.deepEqual(results.map((result) => result.response.status).sort(), [200, 409, 409, 409]);
    for (const result of results.filter((item) => item.response.status === 409)) assert.deepEqual(result.body, { error: conflictMessage, currentVersion: 2 });
    assert.equal((await currentStop(stop.id)).version, 2);
  });

  await t.test('simultaneous reorders serialize into one complete order without mixed indices', async () => {
    const trip = await newTrip('reorder-race');
    const a = await add(trip.id, 1, 'A');
    const b = await add(trip.id, 1, 'B');
    const c = await add(trip.id, 1, 'C');
    const orders = [[b.id, c.id, a.id], [c.id, a.id, b.id]];
    const results = await Promise.all(orders.map((stopIds) => api(`${stopsUrl(trip.id)}/reorder`, { method: 'PATCH', cookie: owner.cookie, body: { day: 1, stopIds } })));
    assert.ok(results.every((result) => result.response.status === 200));
    const stops = await dayStops(trip.id, 1);
    assert.ok(orders.some((ids) => ids.join() === stops.map((stop) => stop.id).join()));
    assert.deepEqual(stops.map((stop) => stop.orderIndex), [1, 2, 3]);
    assert.ok(stops.every((stop) => stop.version === 3));
  });

  await t.test('concurrent deletes of different stops compact safely without lost records', async () => {
    const trip = await newTrip('delete-race');
    const a = await add(trip.id, 1, 'A');
    const b = await add(trip.id, 1, 'B');
    const c = await add(trip.id, 1, 'C');
    const results = await Promise.all([a, b].map((stop) => api(`${stopsUrl(trip.id)}/${stop.id}`, { method: 'DELETE', cookie: owner.cookie, body: { version: 1 } })));
    assert.ok(results.every((result) => [200, 409].includes(result.response.status)));
    assert.ok(results.some((result) => result.response.status === 200));
    const remaining = await dayStops(trip.id, 1);
    assert.deepEqual(remaining.map((stop) => stop.orderIndex), remaining.map((_, index) => index + 1));
    assert.ok(remaining.some((stop) => stop.id === c.id));
    assert.equal((await allStops(trip.id)).length, 3);
  });

  await t.test('concurrent duration edits have one winner and move stops exactly once', async () => {
    const trip = await newTrip('shrink-race');
    const stop = await add(trip.id, 3);
    const version = (await currentTrip(trip.id)).version;
    const results = await Promise.all([1, 2].map((durationDays) => api<TripPayload>(`/api/trips/${trip.id}`, { method: 'PATCH', cookie: owner.cookie, body: { durationDays, version } })));
    assert.deepEqual(results.map((result) => result.response.status).sort(), [200, 409]);
    assert.equal((await currentStop(stop.id)).day, 0);
    assert.equal((await currentStop(stop.id)).version, 2);
    assert.equal((await currentTrip(trip.id)).version, version + 1);
  });

  await t.test('shrink racing with a day-3 create or move leaves no active stop beyond the new duration', async () => {
    for (const operation of ['create', 'move']) {
      const trip = await newTrip(`shrink-${operation}-race`);
      const original = await add(trip.id, 3, 'Có sẵn');
      const candidate = operation === 'move' ? await add(trip.id, 0, 'Đang chờ') : null;
      const version = (await currentTrip(trip.id)).version;
      const mutate = () => candidate
        ? api(`${stopsUrl(trip.id)}/${candidate.id}`, { method: 'PATCH', cookie: owner.cookie, body: { day: 3, version: 1 } })
        : api(stopsUrl(trip.id), { method: 'POST', cookie: owner.cookie, body: { name: 'Thêm đồng thời', day: 3 } });
      const [shrink, mutation] = await Promise.all([
        api(`/api/trips/${trip.id}`, { method: 'PATCH', cookie: owner.cookie, body: { durationDays: 2, version } }), mutate(),
      ]);
      assert.ok([200, 409].includes(shrink.response.status));
      assert.ok([200, 201, 400].includes(mutation.response.status));
      if (shrink.response.status === 409) {
        const retry = await api(`/api/trips/${trip.id}`, { method: 'PATCH', cookie: owner.cookie, body: { durationDays: 2, version: (await currentTrip(trip.id)).version } });
        assert.equal(retry.response.status, 200);
      }
      assert.equal(await prisma.stop.count({ where: { tripId: trip.id, day: { gt: 2 }, deletedAt: null } }), 0);
      assert.equal((await currentStop(original.id)).day, 0);
      const staged = await dayStops(trip.id, 0);
      assert.deepEqual(staged.map((stop) => stop.orderIndex), staged.map((_, index) => index + 1));
    }
  });

  await t.test('all services participate in the caller transaction and roll back every intermediate write', async () => {
    const trip = await newTrip('rollback');
    const a = await add(trip.id, 3, 'A');
    const b = await add(trip.id, 3, 'B');
    const c = await add(trip.id, 3, 'C');
    const before = { trip: await currentTrip(trip.id), stops: await allStops(trip.id) };
    await assert.rejects(prisma.$transaction(async (tx) => {
      await updateStop(trip.id, owner.id, a.id, { notes: 'Must roll back', version: 1 }, tx);
      await reorderStops(trip.id, owner.id, { day: 3, stopIds: [c.id, a.id, b.id] }, tx);
      await deleteStop(trip.id, owner.id, b.id, { version: 2 }, tx);
      const current = await tx.trip.findUniqueOrThrow({ where: { id: trip.id } });
      const shrunk = await updateTrip(trip.id, owner.id, { durationDays: 2, version: current.version }, tx);
      assert.equal(shrunk.movedStopsCount, 2);
      throw new Error('Intentional rollback after writes');
    }), /Intentional rollback after writes/);
    assert.deepEqual({ trip: await currentTrip(trip.id), stops: await allStops(trip.id) }, before);
  });
});
