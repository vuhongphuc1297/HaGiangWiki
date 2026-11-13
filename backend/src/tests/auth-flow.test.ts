import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import { app } from '../app.js';
import { prisma } from '../config/database.js';
import { attachAuth, requireAuth } from '../middlewares/auth.middleware.js';
import { errorHandler } from '../middlewares/errorHandler.js';
import { idempotency } from '../middlewares/idempotency.middleware.js';
import { tripAccess } from '../middlewares/tripAccess.middleware.js';
import { bigintJsonReplacer } from '../utils/bigint.js';
import { generateRandomToken, hashToken } from '../utils/crypto.js';
import { HttpError } from '../utils/httpError.js';
import { sessionCookieOptions } from '../modules/auth/auth.service.js';

type MemberPayload = { id: string; userId: string; nickname: string; displayName: string; role: string; status: string };
type TripPayload = { id: string; title: string; budget: string; version: number; members: MemberPayload[]; stops: { id: string; day: number; orderIndex: number; estimatedCost: string }[] };
type UserPayload = { id: string; displayName: string };
type InvitePayload = { inviteToken: string; inviteUrl: string; expiresAt: string };
type JoinPayload = { success: boolean; tripId: string; memberId: string };
type MePayload = { user: UserPayload; trips: { id: string; budget: string; membership: { role: string } }[] };
type ApiOptions = { method?: string; cookie?: string; key?: string; body?: unknown; raw?: string };

// Only this in-process test server exposes the rollback probes; production app does not.
function createTestApp() {
  const testApp = express();
  testApp.set('json replacer', bigintJsonReplacer);
  const probes = express.Router();
  probes.use(express.json(), cookieParser(), attachAuth);
  probes.post('/trips/:tripId/:probe', requireAuth, tripAccess, idempotency, async (req, res) => {
    assert.ok(req.transaction);
    assert.ok(req.tripMember);
    const tripId = req.tripMember.tripId;
    if (req.params.probe === 'write') {
      const trip = await req.transaction.trip.update({ where: { id: tripId }, data: { version: { increment: 1 } } });
      res.status(200).json({ id: trip.id, version: trip.version, budget: trip.budget });
      return;
    }
    await req.transaction.trip.update({ where: { id: tripId }, data: { title: 'MUST ROLL BACK' } });
    if (req.params.probe === 'return-error') {
      res.status(422).json({ error: 'Expected non-success rollback' });
    } else if (req.params.probe === 'throw-error') {
      throw new HttpError(400, 'Expected validation rollback');
    } else if (req.params.probe === 'unique-error') {
      await req.transaction.tripMember.create({ data: { tripId, userId: req.user!.id, nickname: 'Duplicate' } });
      res.json({ success: true });
    } else {
      throw new Error('Private failure details must never appear in the HTTP response.');
    }
  });
  probes.use(errorHandler);
  testApp.use('/_checks', probes);
  testApp.use(app);
  return testApp;
}

test('HaGiangWiki auth, authorization, invitations and idempotency end-to-end', { timeout: 120_000 }, async (t) => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  const prefix = `e2e-${randomUUID()}`;
  const userIds = new Set<string>();
  const createdTripIds = new Set<string>();
  const server = createTestApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  t.after(async () => {
    const closed = new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    server.closeAllConnections();
    await closed;
    try {
      const trips = await prisma.trip.findMany({ where: { OR: [{ id: { in: [...createdTripIds] } }, { title: { startsWith: prefix } }] }, select: { id: true, members: { select: { userId: true } } } });
      for (const trip of trips) for (const member of trip.members) userIds.add(member.userId);
      const generatedUsers = await prisma.user.findMany({ where: { displayName: { startsWith: prefix } }, select: { id: true } });
      for (const user of generatedUsers) userIds.add(user.id);
      await prisma.trip.deleteMany({ where: { id: { in: trips.map((trip) => trip.id) } } });
      await prisma.user.deleteMany({ where: { id: { in: [...userIds] }, displayName: { startsWith: prefix } } });
      assert.equal(await prisma.user.count({ where: { displayName: { startsWith: prefix } } }), 0);
    } finally {
      await prisma.$disconnect();
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });

  async function api<T = Record<string, unknown>>(path: string, options: ApiOptions = {}) {
    const headers = new Headers();
    if (options.cookie) headers.set('Cookie', options.cookie);
    if (options.key !== undefined) headers.set('Idempotency-Key', options.key);
    if (options.body !== undefined || options.raw !== undefined) headers.set('Content-Type', 'application/json');
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET', headers,
      body: options.raw ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
      signal: AbortSignal.timeout(25_000),
    });
    const body = await response.json() as T;
    if (path === '/api/trips' && options.method === 'POST' && response.status === 201 && typeof body === 'object' && body !== null && 'id' in body && typeof body.id === 'string') {
      createdTripIds.add(body.id);
    }
    return { response, body };
  }

  function readCookie(response: Response): string {
    const value = response.headers.getSetCookie().find((cookie) => cookie.startsWith('session_token='));
    assert.ok(value, 'Expected a session cookie');
    assert.match(value, /HttpOnly/i);
    assert.match(value, /SameSite=Lax/i);
    assert.match(value, /Path=\//i);
    return value.split(';')[0]!;
  }

  async function register(suffix: string) {
    const result = await api<UserPayload>('/api/auth/register-anonymous', { method: 'POST', body: { displayName: `${prefix}-${suffix}` } });
    assert.equal(result.response.status, 201);
    userIds.add(result.body.id);
    return { ...result, cookie: readCookie(result.response) };
  }

  async function newTrip(cookie: string, suffix: string, key?: string) {
    const input = { title: `${prefix}-${suffix}`, startDate: '2026-11-20', durationDays: 3, vehicle: 'XE_MAY', budget: 5_000_000 };
    const result = await api<TripPayload>('/api/trips', { method: 'POST', cookie, key, body: input });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    return { ...result, input };
  }

  async function invite(cookie: string, tripId: string) {
    const result = await api<InvitePayload>(`/api/trips/${tripId}/invites`, { method: 'POST', cookie });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    return result.body;
  }

  let cookieA = '';
  let cookieB = '';
  let cookieC = '';
  let userA: UserPayload;
  let userB: UserPayload;
  let mainTrip: TripPayload;
  let inputMain: Record<string, unknown>;
  let mainInvite: InvitePayload;
  let joinedB: JoinPayload;
  let sharedWithExistingB: TripPayload;

  await t.test('anonymous requests cannot access protected APIs; health remains public', async () => {
    assert.equal((await api('/api/health')).response.status, 200);
    const result = await api('/api/auth/me');
    assert.equal(result.response.status, 401);
    assert.equal(result.body.error, 'Yêu cầu đăng nhập hoặc phiên làm việc hợp lệ.');
    assert.equal((await api('/api/trips', { method: 'POST', body: {} })).response.status, 401);
  });

  await t.test('only the fictional demo trip has a public read-only preview', async () => {
    const demo = await api<TripPayload & { readOnly: boolean }>('/api/trips/demo_trip_hagiang_20261120');
    assert.equal(demo.response.status, 200);
    assert.equal(demo.body.readOnly, true);
    assert.equal(demo.body.stops.length, 9);
    assert.equal(demo.body.members.length, 2);
    assert.doesNotMatch(JSON.stringify(demo.body), /tokenHash|session_token|userId/);
    assert.equal((await api('/api/trips/demo_trip_hagiang_20261120/stops', { method: 'POST', body: { name: 'Unauthorized' } })).response.status, 401);
    assert.equal((await api('/api/trips/demo_trip_unknown')).response.status, 401);
  });

  await t.test('register A with a 30-day HttpOnly cookie and a hashed DB token', async () => {
    const result = await register('A');
    cookieA = result.cookie;
    userA = result.body;
    assert.deepEqual(Object.keys(result.body).sort(), ['displayName', 'id']);
    const rawToken = cookieA.slice('session_token='.length);
    assert.match(rawToken, /^[a-f0-9]{64}$/);
    const session = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(rawToken) } });
    assert.notEqual(session.tokenHash, rawToken);
    assert.equal(session.userId, userA.id);
    assert.ok(Math.abs(session.expiresAt.getTime() - Date.now() - 30 * 86_400_000) < 60_000);
    assert.match(result.response.headers.get('set-cookie')!, /Max-Age=2592000/);
  });

  await t.test('A creates a trip and OWNER membership atomically; BigInt serializes as string', async () => {
    const result = await newTrip(cookieA, 'main', 'create-main');
    mainTrip = result.body;
    inputMain = result.input;
    assert.equal(mainTrip.budget, '5000000');
    assert.equal(mainTrip.version, 1);
    assert.equal(mainTrip.members.length, 1);
    assert.equal(mainTrip.members[0]?.role, 'OWNER');
    assert.equal(mainTrip.members[0]?.displayName, userA.displayName);
    assert.equal(result.response.headers.get('X-Cache'), 'MISS');
    assert.equal(await prisma.idempotencyRecord.count({ where: { tripId: mainTrip.id } }), 1);
  });

  await t.test('trip detail sorts stops and omits tombstones; /me only returns safe user data', async () => {
    await prisma.stop.createMany({ data: [
      { tripId: mainTrip.id, name: 'second day', day: 2, orderIndex: 1 },
      { tripId: mainTrip.id, name: 'second stop', day: 1, orderIndex: 2 },
      { tripId: mainTrip.id, name: 'first stop', day: 1, orderIndex: 1, estimatedCost: 60_000n },
      { tripId: mainTrip.id, name: 'pool', day: 0 },
      { tripId: mainTrip.id, name: 'deleted stop', day: 1, deletedAt: new Date() },
    ] });
    const detail = await api<TripPayload>(`/api/trips/${mainTrip.id}`, { cookie: cookieA });
    assert.equal(detail.response.status, 200);
    assert.deepEqual(detail.body.stops.map((stop) => [stop.day, stop.orderIndex]), [[0, 0], [1, 1], [1, 2], [2, 1]]);
    assert.equal(detail.body.stops[1]?.estimatedCost, '60000');
    const me = await api<MePayload>('/api/auth/me', { cookie: cookieA });
    assert.equal(me.response.status, 200);
    assert.equal(me.body.user.id, userA.id);
    assert.ok(me.body.trips.some((trip) => trip.id === mainTrip.id));
    assert.doesNotMatch(JSON.stringify(me.body), /tokenHash|session_token|expiresAt/);
  });

  await t.test('same creation key replays exactly; a changed payload is a 409', async () => {
    const replay = await api<TripPayload>('/api/trips', { method: 'POST', cookie: cookieA, key: 'create-main', body: { budget: 5_000_000, ...inputMain } });
    assert.equal(replay.response.status, 201);
    assert.equal(replay.response.headers.get('X-Cache'), 'HIT');
    assert.deepEqual(replay.body, mainTrip);
    const conflict = await api('/api/trips', { method: 'POST', cookie: cookieA, key: 'create-main', body: { ...inputMain, title: `${prefix}-changed` } });
    assert.equal(conflict.response.status, 409);
    assert.equal(await prisma.trip.count({ where: { title: mainTrip.title } }), 1);
  });

  await t.test('five concurrent creation retries commit one Trip, OWNER and cache record', async () => {
    const input = { ...inputMain, title: `${prefix}-concurrent-create` };
    const results = await Promise.all(Array.from({ length: 5 }, () => api<TripPayload>('/api/trips', { method: 'POST', cookie: cookieA, key: 'concurrent-create', body: input })));
    assert.ok(results.every((result) => result.response.status === 201), JSON.stringify(results.map((result) => result.body)));
    assert.equal(new Set(results.map((result) => result.body.id)).size, 1);
    assert.equal(results.filter((result) => result.response.headers.get('X-Cache') === 'MISS').length, 1);
    const tripId = results[0]!.body.id;
    assert.equal(await prisma.trip.count({ where: { title: input.title } }), 1);
    assert.equal(await prisma.tripMember.count({ where: { tripId } }), 1);
    assert.equal(await prisma.idempotencyRecord.count({ where: { tripId } }), 1);
  });

  await t.test('creation keys are isolated per user; an authenticated outsider receives 403', async () => {
    const result = await register('C');
    cookieC = result.cookie;
    const other = await api<TripPayload>('/api/trips', { method: 'POST', cookie: cookieC, key: 'create-main', body: { ...inputMain, title: `${prefix}-C` } });
    assert.equal(other.response.status, 201);
    assert.notEqual(other.body.id, mainTrip.id);
    assert.equal(other.body.members[0]?.userId, result.body.id);
    assert.equal((await api(`/api/trips/${mainTrip.id}`, { cookie: cookieC })).response.status, 403);
    assert.equal((await api(`/api/trips/${mainTrip.id}`)).response.status, 401);
  });

  await t.test('OWNER issues a hashed 48-hour invite; public preview exposes only summary fields', async () => {
    mainInvite = await invite(cookieA, mainTrip.id);
    assert.match(mainInvite.inviteToken, /^[a-f0-9]{64}$/);
    assert.ok(mainInvite.inviteUrl.endsWith(`/join/${mainInvite.inviteToken}`));
    const stored = await prisma.tripInvite.findUniqueOrThrow({ where: { tokenHash: hashToken(mainInvite.inviteToken) } });
    assert.notEqual(stored.tokenHash, mainInvite.inviteToken);
    assert.ok(Math.abs(stored.expiresAt.getTime() - Date.now() - 48 * 3_600_000) < 60_000);
    const preview = await api(`/api/invites/${mainInvite.inviteToken}`);
    assert.equal(preview.response.status, 200);
    assert.deepEqual(preview.body, { valid: true, tripTitle: mainTrip.title, ownerName: userA.displayName, durationDays: 3 });
    assert.equal(preview.response.headers.get('Cache-Control'), 'no-store');
  });

  await t.test('anonymous B joins once and receives a session after the transaction commits', async () => {
    const result = await api<JoinPayload>(`/api/invites/${mainInvite.inviteToken}/join`, { method: 'POST', body: { displayName: `${prefix}-B` } });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.success, true);
    joinedB = result.body;
    cookieB = readCookie(result.response);
    const me = await api<MePayload>('/api/auth/me', { cookie: cookieB });
    userB = me.body.user;
    userIds.add(userB.id);
    assert.equal(result.body.tripId, mainTrip.id);
    const member = await prisma.tripMember.findUniqueOrThrow({ where: { id: result.body.memberId } });
    assert.equal(member.userId, userB.id);
    assert.equal(member.role, 'MEMBER');
    const session = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(cookieB.slice('session_token='.length)) } });
    assert.equal(session.userId, userB.id);
  });

  await t.test('B can view the shared trip and its ACTIVE membership', async () => {
    const detail = await api<TripPayload>(`/api/trips/${mainTrip.id}`, { cookie: cookieB });
    assert.equal(detail.response.status, 200);
    assert.equal(detail.body.members.length, 2);
    const me = await api<MePayload>('/api/auth/me', { cookie: cookieB });
    assert.ok(me.body.trips.some((trip) => trip.id === mainTrip.id && trip.membership.role === 'MEMBER'));
  });

  await t.test('a used invite rejects both authenticated and anonymous reuse without new users', async () => {
    const before = await prisma.user.count({ where: { displayName: { startsWith: prefix } } });
    for (const cookie of [undefined, cookieB]) {
      const result = await api(`/api/invites/${mainInvite.inviteToken}/join`, { method: 'POST', cookie, body: { displayName: `${prefix}-retry` } });
      assert.equal(result.response.status, 400);
      assert.equal(result.response.headers.get('set-cookie'), null);
    }
    const preview = await api(`/api/invites/${mainInvite.inviteToken}`);
    assert.equal(preview.body.valid, false);
    assert.equal(await prisma.user.count({ where: { displayName: { startsWith: prefix } } }), before);
    assert.equal(await prisma.tripMember.count({ where: { tripId: mainTrip.id } }), 2);
  });

  await t.test('MEMBER cannot invite; OWNER cannot overfill a two-person trip', async () => {
    assert.equal((await api(`/api/trips/${mainTrip.id}/invites`, { method: 'POST', cookie: cookieB })).response.status, 403);
    assert.equal((await api(`/api/trips/${mainTrip.id}/invites`, { method: 'POST', cookie: cookieA })).response.status, 409);
    assert.equal((await api(`/api/trips/${mainTrip.id}/invites`, { method: 'POST', cookie: cookieC })).response.status, 403);
  });

  await t.test('validation rejects blank names, bad dates, unsafe amounts, malformed JSON and keys', async () => {
    assert.equal((await api('/api/auth/register-anonymous', { method: 'POST', body: { displayName: '  ' } })).response.status, 400);
    assert.equal((await api('/api/auth/register-anonymous', { method: 'POST', raw: '{bad-json' })).response.status, 400);
    for (const change of [{ startDate: '2026-02-30' }, { durationDays: 31 }, { budget: -1 }, { budget: 1.5 }, { budget: Number.MAX_SAFE_INTEGER + 1 }, { title: '' }]) {
      const result = await api('/api/trips', { method: 'POST', cookie: cookieA, body: { ...inputMain, ...change } });
      assert.equal(result.response.status, 400, JSON.stringify(change));
      assert.ok(Array.isArray(result.body.details));
    }
    assert.equal((await api('/api/trips', { method: 'POST', cookie: cookieA, key: 'invalid key', body: inputMain })).response.status, 400);
    const defaulted = await api<TripPayload>('/api/trips', { method: 'POST', cookie: cookieA, body: { title: `${prefix}-defaults`, startDate: '2026-11-20' } });
    assert.equal(defaulted.response.status, 201);
    assert.equal(defaulted.body.budget, '0');
  });

  await t.test('lastUsedAt updates after five minutes and is throttled on the following request', async () => {
    const tokenHash = hashToken(cookieB.slice('session_token='.length));
    const oldDate = new Date(Date.now() - 6 * 60_000);
    await prisma.session.update({ where: { tokenHash }, data: { lastUsedAt: oldDate } });
    assert.equal((await api('/api/auth/me', { cookie: cookieB })).response.status, 200);
    const first = await prisma.session.findUniqueOrThrow({ where: { tokenHash } });
    assert.ok(first.lastUsedAt > oldDate);
    assert.equal((await api('/api/auth/me', { cookie: cookieB })).response.status, 200);
    const second = await prisma.session.findUniqueOrThrow({ where: { tokenHash } });
    assert.equal(second.lastUsedAt.getTime(), first.lastUsedAt.getTime());
  });

  await t.test('expired, revoked, nonexistent and malformed session tokens are unauthorized', async () => {
    const expired = await register('expired');
    await prisma.session.update({ where: { tokenHash: hashToken(expired.cookie.slice('session_token='.length)) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const revoked = await register('revoked');
    await prisma.session.update({ where: { tokenHash: hashToken(revoked.cookie.slice('session_token='.length)) }, data: { revokedAt: new Date() } });
    for (const cookie of [expired.cookie, revoked.cookie, `session_token=${generateRandomToken()}`, 'session_token=bad']) {
      assert.equal((await api('/api/auth/me', { cookie })).response.status, 401);
    }
  });

  await t.test('expired/revoked/unknown invite tokens cannot create users or grant membership', async () => {
    const trip = await newTrip(cookieA, 'bad-invites');
    const expired = await invite(cookieA, trip.body.id);
    const revoked = await invite(cookieA, trip.body.id);
    await prisma.tripInvite.update({ where: { tokenHash: hashToken(expired.inviteToken) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await prisma.tripInvite.update({ where: { tokenHash: hashToken(revoked.inviteToken) }, data: { revokedAt: new Date() } });
    for (const token of [expired.inviteToken, revoked.inviteToken, generateRandomToken(), 'invalid-token']) {
      assert.equal((await api(`/api/invites/${token}`)).body.valid, false);
      assert.equal((await api(`/api/invites/${token}/join`, { method: 'POST', body: { displayName: `${prefix}-invalid` } })).response.status, 400);
    }
    assert.equal(await prisma.tripMember.count({ where: { tripId: trip.body.id } }), 1);
    assert.equal(await prisma.user.count({ where: { displayName: `${prefix}-invalid` } }), 0);
  });

  await t.test('a simultaneous use of the same invite yields exactly one successful join', async () => {
    const trip = await newTrip(cookieA, 'same-invite-race');
    const token = (await invite(cookieA, trip.body.id)).inviteToken;
    const results = await Promise.all(Array.from({ length: 5 }, (_, index) => api<JoinPayload>(`/api/invites/${token}/join`, { method: 'POST', body: { displayName: `${prefix}-R${index}` } })));
    assert.equal(results.filter((result) => result.response.status === 200).length, 1);
    assert.equal(results.filter((result) => result.response.status === 400).length, 4);
    assert.equal(await prisma.tripMember.count({ where: { tripId: trip.body.id, status: 'ACTIVE' } }), 2);
    assert.equal(await prisma.user.count({ where: { displayName: { startsWith: `${prefix}-R` } } }), 1);
  });

  await t.test('different invitations racing for one remaining seat cannot create a third member', async () => {
    const trip = await newTrip(cookieA, 'different-invite-race');
    const [first, second] = await Promise.all([invite(cookieA, trip.body.id), invite(cookieA, trip.body.id)]);
    const results = await Promise.all([first, second].map((value, index) => api<JoinPayload>(`/api/invites/${value.inviteToken}/join`, { method: 'POST', body: { displayName: `${prefix}-S${index}` } })));
    assert.deepEqual(results.map((result) => result.response.status).sort(), [200, 409]);
    assert.equal(await prisma.tripMember.count({ where: { tripId: trip.body.id, status: 'ACTIVE' } }), 2);
    assert.equal(await prisma.user.count({ where: { displayName: { startsWith: `${prefix}-S` } } }), 1);
  });

  await t.test('an existing session joins without another user/cookie; ACTIVE membership is reused', async () => {
    const trip = await newTrip(cookieA, 'existing-B');
    sharedWithExistingB = trip.body;
    const first = await invite(cookieA, trip.body.id);
    const second = await invite(cookieA, trip.body.id);
    const before = await prisma.user.count({ where: { displayName: { startsWith: prefix } } });
    const result = await api<JoinPayload>(`/api/invites/${first.inviteToken}/join`, { method: 'POST', cookie: cookieB, body: { displayName: `${prefix}-B2` } });
    assert.equal(result.response.status, 200);
    assert.equal(result.response.headers.get('set-cookie'), null);
    const again = await api<JoinPayload>(`/api/invites/${second.inviteToken}/join`, { method: 'POST', cookie: cookieB, body: { displayName: `${prefix}-B2` } });
    assert.equal(again.response.status, 200);
    assert.equal(again.body.memberId, result.body.memberId);
    assert.equal(await prisma.user.count({ where: { displayName: { startsWith: prefix } } }), before);
    assert.equal(await prisma.tripMember.count({ where: { tripId: trip.body.id } }), 2);
  });

  await t.test('trip-scoped idempotency commits one write and never replays another user response', async () => {
    const path = `/_checks/trips/${mainTrip.id}/write`;
    const before = await prisma.trip.findUniqueOrThrow({ where: { id: mainTrip.id } });
    const results = await Promise.all(Array.from({ length: 4 }, () => api(path, { method: 'POST', cookie: cookieA, key: 'shared-write', body: {} })));
    assert.ok(results.every((result) => result.response.status === 200));
    assert.equal(results.filter((result) => result.response.headers.get('X-Cache') === 'MISS').length, 1);
    const after = await prisma.trip.findUniqueOrThrow({ where: { id: mainTrip.id } });
    assert.equal(after.version, before.version + 1);
    assert.equal((await api(path, { method: 'POST', cookie: cookieB, key: 'shared-write', body: {} })).response.status, 409);
  });

  await t.test('non-2xx, validation, unique and unexpected errors roll back both writes and cache', async () => {
    const before = await prisma.trip.findUniqueOrThrow({ where: { id: mainTrip.id } });
    for (const [probe, status] of [['return-error', 422], ['throw-error', 400], ['unique-error', 409], ['unexpected-error', 500]] as const) {
      const result = await api(`/_checks/trips/${mainTrip.id}/${probe}`, { method: 'POST', cookie: cookieA, key: `rollback-${probe}`, body: {} });
      assert.equal(result.response.status, status, JSON.stringify(result.body));
      assert.equal((await prisma.trip.findUniqueOrThrow({ where: { id: mainTrip.id } })).title, before.title);
      assert.equal(await prisma.idempotencyRecord.count({ where: { tripId: mainTrip.id, key: `rollback-${probe}` } }), 0);
      assert.doesNotMatch(JSON.stringify(result.body), /Private failure|Prisma|stack|tokenHash/);
    }
  });

  await t.test('expired idempotency records are replaced and their old payload is not replayed', async () => {
    const path = `/_checks/trips/${mainTrip.id}/write`;
    await prisma.idempotencyRecord.update({ where: { tripId_key: { tripId: mainTrip.id, key: 'shared-write' } }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const result = await api(path, { method: 'POST', cookie: cookieA, key: 'shared-write', body: {} });
    assert.equal(result.response.status, 200);
    assert.equal(result.response.headers.get('X-Cache'), 'MISS');
    assert.equal(await prisma.idempotencyRecord.count({ where: { tripId: mainTrip.id, key: 'shared-write' } }), 1);
  });

  await t.test('revoked members cannot view, list, rejoin or bypass access through an idempotent replay', async () => {
    await prisma.tripMember.update({ where: { id: joinedB.memberId }, data: { status: 'REVOKED', revokedAt: new Date() } });
    assert.equal((await api(`/api/trips/${mainTrip.id}`, { cookie: cookieB })).response.status, 403);
    const me = await api<MePayload>('/api/auth/me', { cookie: cookieB });
    assert.ok(!me.body.trips.some((trip) => trip.id === mainTrip.id));
    assert.ok(me.body.trips.some((trip) => trip.id === sharedWithExistingB.id));
    const fresh = await invite(cookieA, mainTrip.id);
    assert.equal((await api(`/api/invites/${fresh.inviteToken}/join`, { method: 'POST', cookie: cookieB, body: { displayName: `${prefix}-B` } })).response.status, 403);
    assert.equal((await api(`/_checks/trips/${mainTrip.id}/write`, { method: 'POST', cookie: cookieB, key: 'shared-write', body: {} })).response.status, 403);
    assert.equal((await prisma.tripMember.findUniqueOrThrow({ where: { id: joinedB.memberId } })).status, 'REVOKED');
  });

  await t.test('an invite stops granting access when its creator loses OWNER access', async () => {
    const trip = await newTrip(cookieA, 'owner-revoked', 'revoked-owner-key');
    const token = (await invite(cookieA, trip.body.id)).inviteToken;
    await prisma.tripMember.update({ where: { tripId_userId: { tripId: trip.body.id, userId: userA.id } }, data: { status: 'REVOKED', revokedAt: new Date() } });
    assert.equal((await api(`/api/invites/${token}`)).body.valid, false);
    assert.equal((await api(`/api/invites/${token}/join`, { method: 'POST', body: { displayName: `${prefix}-denied` } })).response.status, 400);
    assert.equal(await prisma.user.count({ where: { displayName: `${prefix}-denied` } }), 0);
    assert.equal((await api('/api/trips', { method: 'POST', cookie: cookieA, key: 'revoked-owner-key', body: trip.input })).response.status, 403);
  });

  await t.test('a private copy of the demo keeps all stops and only grants its creator OWNER access', async () => {
    const result = await api<TripPayload>('/api/trips', { method: 'POST', cookie: cookieA, key: 'private-template', body: { title: `${prefix}-template`, startDate: '2026-11-20', durationDays: 3, templateId: 'demo_trip_hagiang_20261120' } });
    assert.equal(result.response.status, 201);
    const detail = await api<TripPayload>(`/api/trips/${result.body.id}`, { cookie: cookieA });
    assert.equal(detail.body.members.length, 1);
    assert.equal(detail.body.members[0]?.userId, userA.id);
    assert.equal(detail.body.stops.length, 9);
    assert.deepEqual([0, 1, 2, 3].map((day) => detail.body.stops.filter((stop) => stop.day === day).length), [1, 3, 3, 2]);
    assert.equal((await api(`/api/trips/${result.body.id}`, { cookie: cookieC })).response.status, 403);
    const short = await api<TripPayload>('/api/trips', { method: 'POST', cookie: cookieA, body: { title: `${prefix}-short-template`, startDate: '2026-11-20', durationDays: 1, templateId: 'demo_trip_hagiang_20261120' } });
    const shortDetail = await api<TripPayload>(`/api/trips/${short.body.id}`, { cookie: cookieA });
    assert.equal(shortDetail.body.stops.length, 9);
    assert.equal(shortDetail.body.stops.filter((stop) => stop.day === 0).length, 6);
  });

  await t.test('adding and scheduling stops persist data, reject stale versions and enforce access', async () => {
    const trip = await newTrip(cookieA, 'stop-actions');
    const body = { name: 'Dốc Thẩm Mã', category: 'Ngắm cảnh', day: 0, estimatedCost: 60_000, notes: 'Dừng chụp ảnh.' };
    const first = await api<{ id: string; version: number; estimatedCost: string; day: number }>(`/api/trips/${trip.body.id}/stops`, { method: 'POST', cookie: cookieA, key: 'add-stop', body });
    assert.equal(first.response.status, 201);
    assert.equal(first.body.estimatedCost, '60000');
    const repeated = await api<{ id: string }>(`/api/trips/${trip.body.id}/stops`, { method: 'POST', cookie: cookieA, key: 'add-stop', body });
    assert.equal(repeated.response.headers.get('X-Cache'), 'HIT');
    assert.equal(repeated.body.id, first.body.id);
    assert.equal(await prisma.stop.count({ where: { tripId: trip.body.id } }), 1);
    const moved = await api<{ day: number; version: number }>(`/api/trips/${trip.body.id}/stops/${first.body.id}`, { method: 'PATCH', cookie: cookieA, key: 'move-stop', body: { day: 2, version: first.body.version } });
    assert.equal(moved.response.status, 200);
    assert.equal(moved.body.day, 2);
    assert.equal(moved.body.version, 2);
    assert.equal((await api(`/api/trips/${trip.body.id}/stops/${first.body.id}`, { method: 'PATCH', cookie: cookieA, body: { day: 1, version: 1 } })).response.status, 409);
    assert.equal((await api(`/api/trips/${trip.body.id}/stops`, { method: 'POST', cookie: cookieC, body })).response.status, 403);
    assert.equal((await api(`/api/trips/${trip.body.id}/stops`, { method: 'POST', cookie: cookieA, body: { ...body, day: 4 } })).response.status, 400);
    assert.equal((await api(`/api/trips/${mainTrip.id}/stops/${first.body.id}`, { method: 'PATCH', cookie: cookieA, body: { day: 1, version: 2 } })).response.status, 404);
  });

  await t.test('logout revokes the DB session and clears the cookie; old tokens stop working', async () => {
    const result = await api('/api/auth/logout', { method: 'POST', cookie: cookieB });
    assert.equal(result.response.status, 200);
    assert.match(result.response.headers.get('set-cookie')!, /session_token=;/);
    assert.match(result.response.headers.get('set-cookie')!, /Expires=Thu, 01 Jan 1970/);
    const session = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(cookieB.slice('session_token='.length)) } });
    assert.ok(session.revokedAt);
    assert.equal((await api('/api/auth/me', { cookie: cookieB })).response.status, 401);
    assert.equal((await api(`/api/trips/${sharedWithExistingB.id}`, { cookie: cookieB })).response.status, 401);
    assert.equal((await api('/api/auth/logout', { method: 'POST' })).response.status, 200);
  });

  await t.test('token utilities and production cookie flags match the security contract', () => {
    const first = generateRandomToken();
    assert.notEqual(first, generateRandomToken());
    assert.equal(generateRandomToken(16).length, 32);
    assert.equal(hashToken('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    process.env.NODE_ENV = 'production';
    assert.equal(sessionCookieOptions().secure, true);
    assert.equal(sessionCookieOptions().httpOnly, true);
    assert.equal(sessionCookieOptions().sameSite, 'lax');
    process.env.NODE_ENV = 'test';
  });
});
