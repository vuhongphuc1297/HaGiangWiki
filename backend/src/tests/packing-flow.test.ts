import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { app } from '../app.js';
import { prisma } from '../config/database.js';
import { addPackingTemplate, createPacking, createPackingCategory, deletePacking, listPacking, updatePacking } from '../modules/packing/packing.service.js';
import { packingTitleKey, personalPackingTemplate } from '../modules/packing/packing.templates.js';

type Category = { id: string; name: string };
type Item = { id: string; title: string; categoryId: string | null; isPacked: boolean; version: number; createdAt: string; updatedAt: string };
type List = { items: Item[]; categories: Category[]; stats: { total: number; packed: number; percentage: number }; addedCount?: number };
type Options = { method?: string; cookie?: string; key?: string; body?: unknown };

test('packing template titles are distinct after whitespace/case/Unicode normalization', () => {
  assert.equal(personalPackingTemplate.length, 7);
  assert.equal(new Set(personalPackingTemplate.map(packingTitleKey)).size, 7);
  assert.equal(packingTitleKey('  ÁO  ấm  '.normalize('NFD')), packingTitleKey('áo ấm'));
});

test('Personal packing privacy, CRUD, templates and transactions over HTTP/PostgreSQL', { timeout: 120_000 }, async (t) => {
  const prefix = `pk-${randomUUID()}`;
  const userIds: string[] = [];
  const tripIds: string[] = [];
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => {
    const closed = new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    server.closeAllConnections();
    await closed;
    try {
      await prisma.trip.deleteMany({ where: { id: { in: tripIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      assert.equal(await prisma.trip.count({ where: { title: { startsWith: prefix } } }), 0);
      assert.equal(await prisma.user.count({ where: { displayName: { startsWith: prefix } } }), 0);
    } finally { await prisma.$disconnect(); }
  });

  async function api<T = Record<string, unknown>>(path: string, options: Options = {}) {
    const headers = new Headers();
    if (options.cookie) headers.set('Cookie', options.cookie);
    if (options.key) headers.set('Idempotency-Key', options.key);
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    const response = await fetch(base + path, {
      method: options.method ?? 'GET', headers, body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(25_000),
    });
    return { response, body: await response.json() as T };
  }
  async function register(suffix: string) {
    const result = await api<{ id: string }>('/api/auth/register-anonymous', { method: 'POST', body: { displayName: `${prefix}-${suffix}` } });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    userIds.push(result.body.id);
    const cookie = result.response.headers.getSetCookie().find((value) => value.startsWith('session_token='))?.split(';')[0];
    assert.ok(cookie);
    return { id: result.body.id, cookie };
  }
  const a = await register('A');
  const b = await register('B');
  const outsider = await register('outsider');
  async function newTrip(suffix: string) {
    const result = await api<{ id: string; members: { id: string }[] }>('/api/trips', { method: 'POST', cookie: a.cookie, body: { title: `${prefix}-${suffix}`, startDate: '2026-11-20' } });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    tripIds.push(result.body.id);
    const memberB = await prisma.tripMember.create({ data: { tripId: result.body.id, userId: b.id, nickname: 'B' } });
    return { id: result.body.id, memberA: result.body.members[0]!.id, memberB: memberB.id };
  }
  const url = (tripId: string) => `/api/trips/${tripId}/packing`;
  async function list(tripId: string, cookie = a.cookie) {
    const result = await api<List>(url(tripId), { cookie });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.equal(result.response.headers.get('Cache-Control'), 'no-store');
    return result.body;
  }
  async function add(tripId: string, title: string, cookie = a.cookie) {
    const result = await api<Item>(url(tripId), { method: 'POST', cookie, key: randomUUID(), body: { title } });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    return result.body;
  }
  async function snapshot(tripId: string) {
    return {
      items: await prisma.packingItem.findMany({ where: { tripId }, orderBy: { id: 'asc' } }),
      categories: await prisma.packingCategory.findMany({ where: { member: { tripId } }, orderBy: { id: 'asc' } }),
      trip: await prisma.trip.findUniqueOrThrow({ where: { id: tripId } }),
      records: await prisma.idempotencyRecord.findMany({ where: { tripId }, orderBy: { id: 'asc' } }),
    };
  }

  await t.test('A creates three private items; B sees none and cannot PATCH or DELETE their IDs', async () => {
    const trip = await newTrip('isolation');
    const items = await Promise.all(['Bằng lái A', 'Áo len A', 'Kính râm A'].map((title) => add(trip.id, title)));
    assert.deepEqual((await list(trip.id)).items.map((item) => item.title).sort(), ['Bằng lái A', 'Áo len A', 'Kính râm A'].sort());
    assert.deepEqual(await list(trip.id, b.cookie), { items: [], categories: [], stats: { total: 0, packed: 0, percentage: 0 } });
    const before = await snapshot(trip.id);
    for (const item of items) {
      for (const method of ['PATCH', 'DELETE']) {
        const result = await api(`${url(trip.id)}/${item.id}`, { method, cookie: b.cookie, key: randomUUID(), body: method === 'PATCH' ? { title: 'Đồ B lấy', isPacked: true, version: 999 } : { version: 999 } });
        assert.equal(result.response.status, 403);
        assert.deepEqual(Object.keys(result.body), ['error']);
        assert.ok(!JSON.stringify(result.body).includes(item.title));
      }
    }
    assert.deepEqual(await snapshot(trip.id), before);
  });

  await t.test('creates empty personal categories in order and assigns, moves and clears items without losing progress', async () => {
    const trip = await newTrip('category-crud');
    const categoryUrl = `${url(trip.id)}/categories`;
    const key = randomUUID();
    const request = { method: 'POST', cookie: a.cookie, key, body: { name: '  Quần   áo  '.normalize('NFD') } };
    const first = await api<{ category: Category }>(categoryUrl, request);
    assert.equal(first.response.status, 201);
    const clothes = first.body.category;
    assert.deepEqual(clothes, { id: clothes.id, name: 'Quần áo' });
    const replay = await api(categoryUrl, request);
    assert.equal(replay.response.headers.get('X-Cache'), 'HIT');
    assert.deepEqual(replay.body, first.body);
    const second = await api<{ category: Category }>(categoryUrl, { method: 'POST', cookie: a.cookie, body: { name: 'Giấy tờ' } });
    assert.equal(second.response.status, 201);
    const papers = second.body.category;
    assert.deepEqual(await list(trip.id), { categories: [clothes, papers], items: [], stats: { total: 0, packed: 0, percentage: 0 } });

    const plain = await add(trip.id, 'Đồ đang có');
    assert.equal(plain.categoryId, null);
    const created = await api<Item>(url(trip.id), { method: 'POST', cookie: a.cookie, body: { title: 'Áo len', categoryId: clothes.id } });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.categoryId, clothes.id);
    const path = `${url(trip.id)}/${created.body.id}`;
    const checked = await api<Item>(path, { method: 'PATCH', cookie: a.cookie, body: { isPacked: true, version: 1 } });
    assert.equal(checked.body.categoryId, clothes.id);
    const moved = await api<Item>(path, { method: 'PATCH', cookie: a.cookie, body: { categoryId: papers.id, version: 2 } });
    assert.equal(moved.response.status, 200);
    assert.equal(moved.body.categoryId, papers.id);
    const stale = await api(path, { method: 'PATCH', cookie: a.cookie, body: { categoryId: null, version: 2 } });
    assert.equal(stale.response.status, 409);
    const grouped = await list(trip.id);
    assert.equal(grouped.items.find((item) => item.id === moved.body.id)?.categoryId, papers.id);
    assert.deepEqual(grouped.stats, { packed: 1, total: 2, percentage: 50 });
    const cleared = await api<Item>(path, { method: 'PATCH', cookie: a.cookie, body: { categoryId: null, version: 3 } });
    assert.equal(cleared.response.status, 200);
    assert.equal(cleared.body.categoryId, null);
    assert.equal(cleared.body.isPacked, true);
  });

  await t.test('category names and assignments are scoped to the authenticated member of the requested trip', async () => {
    const trip = await newTrip('category-scope');
    const otherTrip = await newTrip('other-category-scope');
    const path = `${url(trip.id)}/categories`;
    const name = 'Đồ điện tử';
    for (const invalid of ['', '   ', 'a'.repeat(61), null]) {
      assert.equal((await api(path, { method: 'POST', cookie: a.cookie, body: { name: invalid } })).response.status, 400);
    }
    const race = await Promise.all([name, name.toLocaleUpperCase('vi-VN').normalize('NFD')].map((candidate) =>
      api<{ category: Category }>(path, { method: 'POST', cookie: a.cookie, key: randomUUID(), body: { name: candidate, memberId: trip.memberB } })));
    assert.deepEqual(race.map((result) => result.response.status).sort(), [201, 409]);
    const category = race.find((result) => result.response.status === 201)!.body.category;
    assert.deepEqual((await list(trip.id, b.cookie)).categories, []);
    assert.deepEqual((await list(otherTrip.id)).categories, []);
    for (const [tripId, cookie] of [[trip.id, b.cookie], [otherTrip.id, a.cookie]] as const) {
      const local = await api<{ category: Category }>(`${url(tripId)}/categories`, { method: 'POST', cookie, body: { name } });
      assert.equal(local.response.status, 201);
      assert.notEqual(local.body.category.id, category.id);
      const item = await add(tripId, 'Cáp sạc', cookie);
      const before = await snapshot(tripId);
      for (const id of [category.id, 'missing']) {
        const create = await api(url(tripId), { method: 'POST', cookie, body: { title: 'Điện thoại', categoryId: id } });
        const move = await api(`${url(tripId)}/${item.id}`, { method: 'PATCH', cookie, body: { categoryId: id } });
        assert.equal(create.response.status, 404);
        assert.equal(move.response.status, 404);
        assert.deepEqual(create.body, { error: 'Không tìm thấy danh mục hành lý.' });
        assert.deepEqual(move.body, create.body);
      }
      assert.deepEqual(await snapshot(tripId), before);
    }
  });

  await t.test('OWNER has no override over B; query/body ownership and sharing fields cannot select another member', async () => {
    const trip = await newTrip('ownership');
    const secretA = await add(trip.id, 'Đồ A bí mật');
    const created = await api<Item>(url(trip.id), { method: 'POST', cookie: b.cookie, body: {
      title: '  Đồ B  ', assignedToMemberId: trip.memberA, isShared: true, isPacked: true, tripId: 'other-trip', version: 99,
    } });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.title, 'Đồ B');
    assert.equal(created.body.isPacked, false);
    assert.equal(created.body.version, 1);
    const saved = await prisma.packingItem.findUniqueOrThrow({ where: { id: created.body.id } });
    assert.equal(saved.assignedToMemberId, trip.memberB);
    assert.equal(saved.isShared, false);
    assert.equal(saved.tripId, trip.id);
    for (const method of ['PATCH', 'DELETE']) assert.equal((await api(`${url(trip.id)}/${saved.id}`, {
      method, cookie: a.cookie, body: method === 'PATCH' ? { isPacked: true } : undefined,
    })).response.status, 403);
    const query = await api<List>(`${url(trip.id)}?assignedToMemberId=${trip.memberA}&isShared=true`, { cookie: b.cookie });
    assert.deepEqual(query.body.items.map((item) => item.id), [saved.id]);
    assert.ok(!JSON.stringify(query.body).includes(secretA.title));
    const patched = await api<Item>(`${url(trip.id)}/${saved.id}`, { method: 'PATCH', cookie: b.cookie, body: { title: 'Tên B mới', assignedToMemberId: trip.memberA, isShared: true } });
    assert.equal(patched.response.status, 200);
    assert.equal((await prisma.packingItem.findUniqueOrThrow({ where: { id: saved.id } })).assignedToMemberId, trip.memberB);
    assert.ok((await list(trip.id)).items.every((item) => item.id !== saved.id));
  });

  await t.test('legacy shared or unassigned items are excluded and cannot be edited even by their carrier', async () => {
    const trip = await newTrip('legacy');
    const shared = await prisma.packingItem.create({ data: { tripId: trip.id, title: 'Đồ chung cũ', assignedToMemberId: trip.memberA, isShared: true } });
    const unassigned = await prisma.packingItem.create({ data: { tripId: trip.id, title: 'Chưa gán', isShared: false } });
    for (const cookie of [a.cookie, b.cookie]) {
      assert.equal((await list(trip.id, cookie)).stats.total, 0);
      for (const item of [shared, unassigned]) {
        assert.equal((await api(`${url(trip.id)}/${item.id}`, { method: 'PATCH', cookie, body: { isPacked: true } })).response.status, 403);
        assert.equal((await api(`${url(trip.id)}/${item.id}`, { method: 'DELETE', cookie })).response.status, 403);
      }
    }
    assert.equal(await prisma.packingItem.count({ where: { tripId: trip.id } }), 2);
  });

  await t.test('CRUD trims names, toggles both directions and calculates only the current user progress', async () => {
    const trip = await newTrip('crud');
    const one = await add(trip.id, '  Áo ấm  ');
    const two = await add(trip.id, 'Thuốc cá nhân');
    const three = await add(trip.id, 'Kính');
    await add(trip.id, 'Của B', b.cookie);
    const version = (await prisma.trip.findUniqueOrThrow({ where: { id: trip.id } })).version;
    const first = await api<Item>(`${url(trip.id)}/${one.id}`, { method: 'PATCH', cookie: a.cookie, body: { isPacked: true } });
    assert.equal(first.response.status, 200);
    assert.equal(first.body.title, 'Áo ấm');
    assert.equal(first.body.version, 2);
    assert.deepEqual((await list(trip.id)).stats, { total: 3, packed: 1, percentage: 33 });
    await api(`${url(trip.id)}/${two.id}`, { method: 'PATCH', cookie: a.cookie, body: { title: '  Thuốc của tôi  ', isPacked: true, version: 1 } });
    assert.deepEqual((await list(trip.id)).stats, { total: 3, packed: 2, percentage: 67 });
    assert.equal((await api(`${url(trip.id)}/${three.id}`, { method: 'DELETE', cookie: a.cookie })).response.status, 200);
    assert.deepEqual((await list(trip.id)).stats, { total: 2, packed: 2, percentage: 100 });
    const unchecked = await api<Item>(`${url(trip.id)}/${one.id}`, { method: 'PATCH', cookie: a.cookie, body: { isPacked: false, version: 2 } });
    assert.equal(unchecked.body.isPacked, false);
    assert.equal(unchecked.body.version, 3);
    assert.deepEqual((await list(trip.id)).stats, { total: 2, packed: 1, percentage: 50 });
    assert.deepEqual((await list(trip.id, b.cookie)).stats, { total: 1, packed: 0, percentage: 0 });
    assert.equal((await prisma.trip.findUniqueOrThrow({ where: { id: trip.id } })).version, version);
  });

  await t.test('input validation rejects malformed titles, boolean states and versions without writing', async () => {
    const trip = await newTrip('validation');
    const item = await add(trip.id, 'Đồ hợp lệ');
    const before = await snapshot(trip.id);
    for (const title of ['', '   ', 'a'.repeat(161), 123, null]) {
      assert.equal((await api(url(trip.id), { method: 'POST', cookie: a.cookie, key: randomUUID(), body: { title } })).response.status, 400);
    }
    for (const body of [{}, { version: 1 }, { assignedToMemberId: trip.memberB }, { title: '' }, { title: 'a'.repeat(161) }, { isPacked: 'true' }, { isPacked: 1 }, { isPacked: null }, { isPacked: true, version: 0 }, { title: 'Ok', version: '1' }]) {
      assert.equal((await api(`${url(trip.id)}/${item.id}`, { method: 'PATCH', cookie: a.cookie, key: randomUUID(), body })).response.status, 400, JSON.stringify(body));
    }
    assert.equal((await api(`${url(trip.id)}/${item.id}`, { method: 'DELETE', cookie: a.cookie, body: { version: -1 } })).response.status, 400);
    assert.deepEqual(await snapshot(trip.id), before);
  });

  await t.test('all packing endpoints require a session and ACTIVE membership, including replay after revocation', async () => {
    const trip = await newTrip('access');
    const item = await add(trip.id, 'Riêng của B', b.cookie);
    const key = randomUUID();
    const body = { title: 'B đã tạo' };
    assert.equal((await api(url(trip.id), { method: 'POST', cookie: b.cookie, key, body })).response.status, 201);
    await prisma.tripMember.update({ where: { id: trip.memberB }, data: { status: 'REVOKED', revokedAt: new Date() } });
    const before = await snapshot(trip.id);
    const actions: [string, string, unknown][] = [
      [url(trip.id), 'GET', undefined], [url(trip.id), 'POST', body],
      [`${url(trip.id)}/${item.id}`, 'PATCH', { isPacked: true }], [`${url(trip.id)}/${item.id}`, 'DELETE', undefined],
      [`${url(trip.id)}/templates`, 'POST', undefined],
      [`${url(trip.id)}/categories`, 'POST', { name: 'Giấy tờ' }],
    ];
    for (const cookie of [undefined, outsider.cookie, b.cookie]) {
      for (const [path, method, requestBody] of actions) assert.equal((await api(path, { method, cookie, key, body: requestBody })).response.status, cookie ? 403 : 401);
    }
    assert.deepEqual(await snapshot(trip.id), before);
    await assert.rejects(createPacking(trip.id, b.id, { title: 'B không quyền' }), { status: 403 });
    await assert.rejects(listPacking(trip.id, outsider.id), { status: 403 });
  });

  await t.test('missing, deleted and other-trip item IDs return404 without altering either trip', async () => {
    const trip = await newTrip('ids');
    const foreign = await newTrip('foreign');
    const item = await add(foreign.id, 'Khác chuyến');
    const local = await add(trip.id, 'Sắp xóa');
    assert.equal((await api(`${url(trip.id)}/${local.id}`, { method: 'DELETE', cookie: a.cookie })).response.status, 200);
    const before = await snapshot(trip.id);
    const foreignBefore = await snapshot(foreign.id);
    for (const id of ['missing', local.id, item.id]) {
      for (const method of ['PATCH', 'DELETE']) assert.equal((await api(`${url(trip.id)}/${id}`, { method, cookie: a.cookie, body: method === 'PATCH' ? { isPacked: true } : undefined })).response.status, 404);
    }
    assert.deepEqual(await snapshot(trip.id), before);
    assert.deepEqual(await snapshot(foreign.id), foreignBefore);
  });

  await t.test('template imports7 personal suggestions and leaves the companion completely unchanged', async () => {
    const trip = await newTrip('template');
    const result = await api<List>(`${url(trip.id)}/templates`, { method: 'POST', cookie: a.cookie });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.addedCount, 7);
    assert.deepEqual(result.body.items.map((item) => item.title).sort(), [...personalPackingTemplate].sort());
    assert.deepEqual(result.body.stats, { total: 7, packed: 0, percentage: 0 });
    assert.equal((await list(trip.id, b.cookie)).items.length, 0);
    const saved = await prisma.packingItem.findMany({ where: { tripId: trip.id } });
    assert.ok(saved.every((item) => !item.isShared && item.assignedToMemberId === trip.memberA));
    const repeated = await api<List>(`${url(trip.id)}/templates`, { method: 'POST', cookie: a.cookie });
    assert.equal(repeated.body.addedCount, 0);
    assert.equal(repeated.body.items.length, 7);
    assert.equal((await api<List>(`${url(trip.id)}/templates`, { method: 'POST', cookie: b.cookie })).body.addedCount, 7);
    assert.equal((await list(trip.id)).items.length, 7);
    assert.equal(await prisma.packingItem.count({ where: { tripId: trip.id } }), 14);
  });

  await t.test('template deduplication normalizes titles and preserves existing packed states and custom items', async () => {
    const trip = await newTrip('dedupe');
    const existing = await add(trip.id, `  ${personalPackingTemplate[0].toLocaleUpperCase('vi-VN').replaceAll(' ', '  ')}  `);
    const category = await createPackingCategory(trip.id, a.id, { name: 'Quần áo' });
    await api(`${url(trip.id)}/${existing.id}`, { method: 'PATCH', cookie: a.cookie, body: { isPacked: true, categoryId: category.id } });
    const custom = await add(trip.id, 'Máy ảnh riêng');
    const old = await prisma.packingItem.findUniqueOrThrow({ where: { id: existing.id } });
    const result = await api<List>(`${url(trip.id)}/templates`, { method: 'POST', cookie: a.cookie });
    assert.equal(result.body.addedCount, 6);
    assert.equal(result.body.items.length, 8);
    assert.equal(result.body.stats.packed, 1);
    assert.deepEqual(result.body.categories, [category]);
    assert.ok(result.body.items.filter((item) => item.id !== existing.id).every((item) => item.categoryId === null));
    assert.deepEqual(await prisma.packingItem.findUniqueOrThrow({ where: { id: existing.id } }), old);
    assert.ok(result.body.items.some((item) => item.id === custom.id));
  });

  await t.test('simultaneous template imports serialize and never add duplicate suggestions', async () => {
    const trip = await newTrip('template-race');
    const results = await Promise.all(Array.from({ length: 4 }, () => api<List>(`${url(trip.id)}/templates`, { method: 'POST', cookie: a.cookie, key: randomUUID() })));
    assert.ok(results.every((result) => result.response.status === 200));
    assert.deepEqual(results.map((result) => result.body.addedCount).sort(), [0, 0, 0, 7]);
    assert.equal(await prisma.packingItem.count({ where: { tripId: trip.id, assignedToMemberId: trip.memberA } }), 7);
    assert.equal((await list(trip.id, b.cookie)).items.length, 0);
  });

  await t.test('idempotent create, update, template and delete replay exactly without disclosing another user cache', async () => {
    const trip = await newTrip('idempotency');
    const key = randomUUID();
    const body = { title: 'Đồ riêng A' };
    const results = await Promise.all(Array.from({ length: 3 }, () => api<Item>(url(trip.id), { method: 'POST', cookie: a.cookie, key, body })));
    assert.ok(results.every((result) => result.response.status === 201));
    assert.equal(results.filter((result) => result.response.headers.get('X-Cache') === 'MISS').length, 1);
    assert.deepEqual(results[0]!.body, results[1]!.body);
    assert.equal(await prisma.packingItem.count({ where: { tripId: trip.id } }), 1);
    const other = await api(url(trip.id), { method: 'POST', cookie: b.cookie, key, body });
    assert.equal(other.response.status, 409);
    assert.ok(!JSON.stringify(other.body).includes(results[0]!.body.id));
    const item = results[0]!.body;
    for (const [path, method, requestBody] of [
      [`${url(trip.id)}/${item.id}`, 'PATCH', { isPacked: true, version: 1 }],
      [`${url(trip.id)}/templates`, 'POST', {}],
      [`${url(trip.id)}/${item.id}`, 'DELETE', { version: 2 }],
    ] as const) {
      const operationKey = randomUUID();
      const first = await api(path, { method, cookie: a.cookie, key: operationKey, body: requestBody });
      const replay = await api(path, { method, cookie: a.cookie, key: operationKey, body: requestBody });
      assert.equal(first.response.status, 200);
      assert.equal(replay.response.headers.get('X-Cache'), 'HIT');
      assert.deepEqual(replay.body, first.body);
    }
    assert.equal((await list(trip.id, b.cookie)).stats.total, 0);
  });

  await t.test('optional version prevents stale writes and simultaneous edits have one winner', async () => {
    const trip = await newTrip('versions');
    const item = await add(trip.id, 'Đồ đang chuẩn bị');
    const path = `${url(trip.id)}/${item.id}`;
    const edits = await Promise.all(['Thiết bị1', 'Thiết bị2'].map((title) => api(path, { method: 'PATCH', cookie: a.cookie, body: { title, version: 1 } })));
    assert.deepEqual(edits.map((result) => result.response.status).sort(), [200, 409]);
    const before = await snapshot(trip.id);
    for (const method of ['PATCH', 'DELETE']) {
      const result = await api(path, { method, cookie: a.cookie, key: randomUUID(), body: { version: 1, isPacked: true } });
      assert.equal(result.response.status, 409);
      assert.equal(result.body.currentVersion, 2);
    }
    assert.deepEqual(await snapshot(trip.id), before);
    assert.equal((await api(path, { method: 'PATCH', cookie: a.cookie, body: { isPacked: true } })).response.status, 200);
    assert.equal((await prisma.packingItem.findUniqueOrThrow({ where: { id: item.id } })).version, 3);
  });

  await t.test('all mutation services roll back together inside a supplied transaction', async () => {
    const trip = await newTrip('rollback');
    const item = await add(trip.id, 'Không được mất');
    const before = await snapshot(trip.id);
    await assert.rejects(prisma.$transaction(async (tx) => {
      const category = await createPackingCategory(trip.id, a.id, { name: 'Danh mục tạm' }, tx);
      const added = await createPacking(trip.id, a.id, { title: 'Tạo tạm', categoryId: category.id }, tx);
      await updatePacking(trip.id, a.id, item.id, { title: 'Sửa tạm', isPacked: true, version: 1 }, tx);
      await addPackingTemplate(trip.id, a.id, tx);
      await deletePacking(trip.id, a.id, added.id, {}, tx);
      throw new Error('Intentional packing rollback');
    }), /Intentional packing rollback/);
    assert.deepEqual(await snapshot(trip.id), before);
  });
});
