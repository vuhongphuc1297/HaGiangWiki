import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { app } from '../app.js';
import { prisma } from '../config/database.js';
import { allocateExpense, calculateExpenseSummary } from '../modules/expense/expense.calculator.js';
import type { SplitType } from '../modules/expense/expense.calculator.js';
import { createExpense, createSettlement, deleteExpense, deleteSettlement, updateExpense } from '../modules/expense/expense.service.js';

type ExpensePayload = {
  id: string; tripId: string; title: string; amount: string; payerMemberId: string; splitType: SplitType;
  stopId: string | null; category: string | null; version: number; deletedAt: string | null; idempotencyKey: string;
};
type TransferPayload = {
  id: string; tripId: string; fromMemberId: string; toMemberId: string; amount: string;
  notes: string | null; deletedAt: string | null; idempotencyKey: string;
};
type LedgerPayload = {
  expenses: ExpensePayload[]; settlements: TransferPayload[];
  summary: {
    totalSpent: string; budget: string; remainingBudget: string; spentByMember: Record<string, string>;
    settlement: { debtorMemberId: string | null; creditorMemberId: string | null; netAmount: string; isSettled: boolean };
  };
};
type ApiOptions = { method?: string; cookie?: string; key?: string; body?: unknown };
const conflictMessage = 'Khoản chi vừa được thay đổi trên thiết bị khác. Vui lòng tải lại trước khi sửa tiếp.';

test('pure BigInt allocation conserves every dong for all split types and payer directions', () => {
  for (const amount of [0n, 1n, 2n, 101_000n, 101_001n, 9_223_372_036_854_775_807n]) {
    for (const split of ['EQUAL', 'FOR_OTHER', 'PERSONAL'] as const) {
      const allocation = allocateExpense(amount, split);
      assert.equal(allocation.payerShare + allocation.otherShare, amount);
      assert.equal(allocation.otherShare, split === 'EQUAL' ? amount / 2n : split === 'FOR_OTHER' ? amount : 0n);
      for (const payer of ['a', 'b']) {
        const expenses = Object.freeze([Object.freeze({ amount, payerMemberId: payer, splitType: split, deletedAt: null })]);
        const summary = calculateExpenseSummary(['a', 'b'], 0n, expenses, []);
        assert.equal(summary.totalSpent, amount);
        assert.equal(summary.spentByMember[payer], amount);
        assert.equal(summary.settlement.netAmount, allocation.otherShare);
        assert.equal(summary.settlement.creditorMemberId, allocation.otherShare === 0n ? null : payer);
        assert.deepEqual(calculateExpenseSummary(['b', 'a'], 0n, expenses, []), summary);
      }
    }
  }
  assert.deepEqual(allocateExpense(101_001n, 'EQUAL'), { payerShare: 50_501n, otherShare: 50_500n });
  assert.deepEqual(allocateExpense(101_000n, 'EQUAL'), { payerShare: 50_500n, otherShare: 50_500n });
  assert.deepEqual(allocateExpense(101n, 'EQUAL', false), { payerShare: 101n, otherShare: 0n });
  assert.throws(() => allocateExpense(1n, 'FOR_OTHER', false), RangeError);
  assert.throws(() => allocateExpense(-1n, 'PERSONAL'), RangeError);
});

test('calculator ignores tombstones and rejects ambiguous or invalid ledger members', () => {
  const expense = { amount: 600n, payerMemberId: 'a', splitType: 'EQUAL', deletedAt: null };
  const transfer = { amount: 100n, fromMemberId: 'b', toMemberId: 'a', deletedAt: null };
  const summary = calculateExpenseSummary(['a', 'b'], 500n,
    [expense, { ...expense, amount: 999n, deletedAt: new Date() }],
    [transfer, { ...transfer, amount: 999n, deletedAt: new Date() }]);
  assert.equal(summary.totalSpent, 600n);
  assert.equal(summary.remainingBudget, -100n);
  assert.equal(summary.settlement.netAmount, 200n);
  assert.throws(() => calculateExpenseSummary(['a', 'b', 'c'], 0n, [], []), RangeError);
  assert.throws(() => calculateExpenseSummary(['a', 'a'], 0n, [], []), RangeError);
  assert.throws(() => calculateExpenseSummary(['b'], 0n, [expense], []), RangeError);
  assert.throws(() => calculateExpenseSummary(['a', 'b'], 0n, [{ ...expense, splitType: 'INVALID' }], []), RangeError);
  assert.throws(() => calculateExpenseSummary(['a', 'b'], 0n, [], [{ ...transfer, fromMemberId: 'c' }]), RangeError);
  assert.throws(() => calculateExpenseSummary(['a', 'b'], 0n, [], [{ ...transfer, toMemberId: 'b' }]), RangeError);
});

test('Expense and settlement HTTP/PostgreSQL integration', { timeout: 120_000 }, async (t) => {
  const prefix = `exp-${randomUUID()}`;
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
    } finally { await prisma.$disconnect(); }
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
  const owner = await register('A');
  const companion = await register('B');
  const outsider = await register('outsider');
  async function newTrip(suffix: string, pair = true) {
    const result = await api<{ id: string; version: number; members: { id: string }[] }>('/api/trips', {
      method: 'POST', cookie: owner.cookie,
      body: { title: `${prefix}-${suffix}`, startDate: '2026-11-20', budget: 5_000_000 },
    });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    tripIds.push(result.body.id);
    const a = result.body.members[0]!.id;
    const b = pair ? (await prisma.tripMember.create({ data: {
      tripId: result.body.id, userId: companion.id, nickname: 'B', status: 'ACTIVE',
    } })).id : '';
    return { id: result.body.id, a, b };
  }
  const expensesUrl = (id: string) => `/api/trips/${id}/expenses`;
  const settlementsUrl = (id: string) => `/api/trips/${id}/settlements`;
  async function ledger(tripId: string) {
    const result = await api<LedgerPayload>(expensesUrl(tripId), { cookie: owner.cookie });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.equal(result.response.headers.get('Cache-Control'), 'no-store');
    return result.body;
  }
  async function add(tripId: string, payerMemberId: string, amount: number | string, splitType: SplitType = 'EQUAL', fields: Record<string, unknown> = {}) {
    const result = await api<ExpensePayload>(expensesUrl(tripId), {
      method: 'POST', cookie: owner.cookie, key: randomUUID(), body: { title: 'Khoản chi', payerMemberId, amount, splitType, ...fields },
    });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    return result.body;
  }
  async function transfer(tripId: string, fromMemberId: string, toMemberId: string, amount: number | string) {
    const result = await api<TransferPayload>(settlementsUrl(tripId), {
      method: 'POST', cookie: companion.cookie, key: randomUUID(), body: { fromMemberId, toMemberId, amount, notes: 'CK Vietcombank' },
    });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    return result.body;
  }
  async function expectDebt(tripId: string, debtorMemberId: string | null, creditorMemberId: string | null, netAmount: string) {
    assert.deepEqual((await ledger(tripId)).summary.settlement, { debtorMemberId, creditorMemberId, netAmount, isSettled: netAmount === '0' });
  }
  const currentExpense = (id: string) => prisma.expense.findUniqueOrThrow({ where: { id } });
  const currentTransfer = (id: string) => prisma.settlementTransfer.findUniqueOrThrow({ where: { id } });
  async function snapshot(tripId: string) {
    return {
      trip: await prisma.trip.findUniqueOrThrow({ where: { id: tripId } }),
      expenses: await prisma.expense.findMany({ where: { tripId }, orderBy: { id: 'asc' } }),
      transfers: await prisma.settlementTransfer.findMany({ where: { tripId }, orderBy: { id: 'asc' } }),
      records: await prisma.idempotencyRecord.findMany({ where: { tripId }, orderBy: { id: 'asc' } }),
    };
  }

  await t.test('baseline settles 300k -> 200k -> 300k -> 200k and recalculates after soft deletes', async () => {
    const trip = await newTrip('baseline');
    const homestay = await add(trip.id, trip.a, 600_000);
    await expectDebt(trip.id, trip.b, trip.a, '300000');
    await add(trip.id, trip.b, 200_000);
    await expectDebt(trip.id, trip.b, trip.a, '200000');
    await add(trip.id, trip.a, 100_000, 'FOR_OTHER');
    await expectDebt(trip.id, trip.b, trip.a, '300000');
    const payment = await transfer(trip.id, trip.b, trip.a, 100_000);
    await expectDebt(trip.id, trip.b, trip.a, '200000');
    assert.deepEqual((await ledger(trip.id)).summary, {
      totalSpent: '900000', budget: '5000000', remainingBudget: '4100000',
      spentByMember: { [trip.a]: '700000', [trip.b]: '200000' },
      settlement: { debtorMemberId: trip.b, creditorMemberId: trip.a, netAmount: '200000', isSettled: false },
    });
    const personal = await add(trip.id, trip.b, 55_001, 'PERSONAL');
    await expectDebt(trip.id, trip.b, trip.a, '200000');
    assert.equal((await ledger(trip.id)).summary.totalSpent, '955001');
    assert.equal((await ledger(trip.id)).summary.spentByMember[trip.b], '255001');
    const removed = await api<ExpensePayload>(`${expensesUrl(trip.id)}/${homestay.id}`, { method: 'DELETE', cookie: companion.cookie, body: { version: 1 } });
    assert.equal(removed.response.status, 200);
    assert.equal(removed.body.version, 2);
    assert.ok(removed.body.deletedAt);
    assert.ok((await currentExpense(homestay.id)).deletedAt);
    await expectDebt(trip.id, trip.a, trip.b, '100000');
    const beforeTransferDelete = (await ledger(trip.id)).summary.totalSpent;
    const deletedTransfer = await api<TransferPayload>(`${settlementsUrl(trip.id)}/${payment.id}`, { method: 'DELETE', cookie: owner.cookie });
    assert.equal(deletedTransfer.response.status, 200);
    assert.ok(deletedTransfer.body.deletedAt);
    assert.ok((await currentTransfer(payment.id)).deletedAt);
    await expectDebt(trip.id, null, null, '0');
    const final = await ledger(trip.id);
    assert.equal(final.summary.totalSpent, beforeTransferDelete);
    assert.equal(final.settlements.length, 0);
    assert.ok(final.expenses.some((expense) => expense.id === personal.id));
    assert.ok(final.expenses.every((expense) => expense.id !== homestay.id));
    assert.equal(await prisma.expense.count({ where: { tripId: trip.id } }), 4);
  });

  await t.test('creates every split type, defaults EQUAL and PATCH preserves/clears fields', async () => {
    const trip = await newTrip('crud');
    const stop = await prisma.stop.create({ data: { tripId: trip.id, name: 'Quán ăn' } });
    const created = await add(trip.id, trip.a, 101_000, 'EQUAL', { title: '  Bữa trưa  ', stopId: stop.id, category: 'Ăn uống' });
    assert.equal(created.title, 'Bữa trưa');
    assert.equal(created.amount, '101000');
    assert.equal(created.version, 1);
    assert.equal(created.deletedAt, null);
    assert.match(created.idempotencyKey, /^[0-9a-f-]{36}$/);
    assert.equal((await currentExpense(created.id)).amount, 101_000n);
    const path = `${expensesUrl(trip.id)}/${created.id}`;
    const changed = await api<ExpensePayload>(path, { method: 'PATCH', cookie: companion.cookie, body: {
      title: 'Vé', amount: '200001', payerMemberId: trip.b, splitType: 'FOR_OTHER', stopId: null, category: null, version: 1,
    } });
    assert.equal(changed.response.status, 200);
    assert.deepEqual([changed.body.title, changed.body.amount, changed.body.payerMemberId, changed.body.splitType, changed.body.stopId, changed.body.category, changed.body.version],
      ['Vé', '200001', trip.b, 'FOR_OTHER', null, null, 2]);
    await expectDebt(trip.id, trip.a, trip.b, '200001');
    const partial = await api<ExpensePayload>(path, { method: 'PATCH', cookie: owner.cookie, body: { splitType: 'PERSONAL', version: 2 } });
    assert.equal(partial.response.status, 200);
    assert.equal(partial.body.amount, '200001');
    assert.equal(partial.body.title, 'Vé');
    assert.equal(partial.body.version, 3);
    await expectDebt(trip.id, null, null, '0');
    const defaulted = await api<ExpensePayload>(expensesUrl(trip.id), { method: 'POST', cookie: owner.cookie, key: randomUUID(), body: { title: 'Mặc định', amount: 10, payerMemberId: trip.a } });
    assert.equal(defaulted.response.status, 201);
    assert.equal(defaulted.body.splitType, 'EQUAL');
    // A stop's tombstone does not delete its existing expenses or prevent a title edit.
    const attached = await add(trip.id, trip.a, 10, 'PERSONAL', { stopId: stop.id });
    await prisma.stop.update({ where: { id: stop.id }, data: { deletedAt: new Date() } });
    assert.equal((await api(`${expensesUrl(trip.id)}/${attached.id}`, { method: 'PATCH', cookie: owner.cookie, body: { title: 'Giữ khoản chi', version: 1 } })).response.status, 200);
    assert.ok((await ledger(trip.id)).expenses.some((expense) => expense.id === attached.id));
  });

  await t.test('odd dong, PostgreSQL bigint maximum and aggregate totals retain exact precision', async () => {
    const trip = await newTrip('precision');
    await add(trip.id, trip.a, 101_001);
    await expectDebt(trip.id, trip.b, trip.a, '50500');
    await add(trip.id, trip.b, '101001');
    await expectDebt(trip.id, null, null, '0');
    const max = '9223372036854775807';
    await add(trip.id, trip.a, max, 'FOR_OTHER');
    await expectDebt(trip.id, trip.b, trip.a, max);
    const payment = await transfer(trip.id, trip.b, trip.a, max);
    assert.equal(payment.amount, max);
    await expectDebt(trip.id, null, null, '0');
    await add(trip.id, trip.b, max, 'PERSONAL');
    const summary = (await ledger(trip.id)).summary;
    assert.equal(summary.totalSpent, (2n * BigInt(max) + 202_002n).toString());
    assert.equal(summary.remainingBudget, (5_000_000n - BigInt(summary.totalSpent)).toString());
    assert.equal(summary.spentByMember[trip.a], (BigInt(max) + 101_001n).toString());
    assert.equal(summary.spentByMember[trip.b], summary.spentByMember[trip.a]);
  });

  await t.test('full repayment, overpayment and transfer in either direction change debt, never spending', async () => {
    const trip = await newTrip('repayment');
    await add(trip.id, trip.b, 200, 'FOR_OTHER');
    await expectDebt(trip.id, trip.a, trip.b, '200');
    await transfer(trip.id, trip.a, trip.b, 200);
    await expectDebt(trip.id, null, null, '0');
    await transfer(trip.id, trip.a, trip.b, 50);
    await expectDebt(trip.id, trip.b, trip.a, '50');
    await transfer(trip.id, trip.b, trip.a, 50);
    await expectDebt(trip.id, null, null, '0');
    assert.equal((await ledger(trip.id)).summary.totalSpent, '200');
  });

  await t.test('empty and solo trips have zero debt; personal spending works before a companion joins', async () => {
    const trip = await newTrip('solo', false);
    assert.deepEqual((await ledger(trip.id)).summary, {
      totalSpent: '0', budget: '5000000', remainingBudget: '5000000', spentByMember: { [trip.a]: '0' },
      settlement: { debtorMemberId: null, creditorMemberId: null, netAmount: '0', isSettled: true },
    });
    await add(trip.id, trip.a, 101, 'PERSONAL');
    await add(trip.id, trip.a, 101, 'EQUAL');
    await expectDebt(trip.id, null, null, '0');
    assert.equal((await api(expensesUrl(trip.id), { method: 'POST', cookie: owner.cookie, key: randomUUID(), body: { title: 'Chi hộ', amount: 1, payerMemberId: trip.a, splitType: 'FOR_OTHER' } })).response.status, 400);
  });

  await t.test('validation rejects invalid money, fields, versions and UUID keys without any writes', async () => {
    const trip = await newTrip('validation');
    const expense = await add(trip.id, trip.a, 1);
    const before = await snapshot(trip.id);
    const base = { title: 'Hợp lệ', amount: 1, payerMemberId: trip.a };
    const amounts = [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '', '0', '-1', '1.0', '01', '1e3', 'abc', '9223372036854775808', '9'.repeat(100), null, true];
    const badFields = [
      ...amounts.map((amount) => ({ amount })), { title: '' }, { title: '  ' }, { title: 'x'.repeat(161) },
      { payerMemberId: '' }, { payerMemberId: null }, { splitType: 'INVALID' }, { stopId: '' }, { category: 'x'.repeat(61) },
    ];
    for (const fields of badFields) {
      const result = await api(expensesUrl(trip.id), { method: 'POST', cookie: owner.cookie, key: randomUUID(), body: { ...base, ...fields } });
      assert.equal(result.response.status, 400, JSON.stringify(fields));
    }
    for (const key of [undefined, 'plain-key', '00000000-0000-1000-8000-000000000000', '00000000-0000-4000-0000-000000000000']) {
      assert.equal((await api(expensesUrl(trip.id), { method: 'POST', cookie: owner.cookie, key, body: base })).response.status, 400);
      assert.equal((await api(settlementsUrl(trip.id), { method: 'POST', cookie: owner.cookie, key, body: { fromMemberId: trip.a, toMemberId: trip.b, amount: 1 } })).response.status, 400);
    }
    for (const fields of [{}, { version: 0 }, { version: -1 }, { version: 1.5 }, { version: '1' }, { version: 2_147_483_648 }, { version: 1, amount: 0 }, { version: 1, splitType: 'INVALID' }]) {
      assert.equal((await api(`${expensesUrl(trip.id)}/${expense.id}`, { method: 'PATCH', cookie: owner.cookie, body: fields })).response.status, 400);
    }
    for (const query of ['', '?version=0', '?version=1.5', '?version=abc', '?version=2147483648', '?version=1&version=2']) {
      assert.equal((await api(`${expensesUrl(trip.id)}/${expense.id}${query}`, { method: 'DELETE', cookie: owner.cookie })).response.status, 400);
    }
    assert.equal((await api(`${expensesUrl(trip.id)}/${expense.id}?version=2`, { method: 'DELETE', cookie: owner.cookie, body: { version: 1 } })).response.status, 400);
    for (const fields of [...amounts.map((amount) => ({ amount })), { fromMemberId: trip.b }, { notes: 'x'.repeat(2001) }]) {
      assert.equal((await api(settlementsUrl(trip.id), { method: 'POST', cookie: owner.cookie, key: randomUUID(), body: { fromMemberId: trip.a, toMemberId: trip.b, amount: 1, ...fields } })).response.status, 400);
    }
    assert.deepEqual(await snapshot(trip.id), before);
  });

  await t.test('rejects cross-trip/missing/deleted references on create, edit and deletion', async () => {
    const trip = await newTrip('references');
    const foreign = await newTrip('foreign');
    const stop = await prisma.stop.create({ data: { tripId: foreign.id, name: 'Khác chuyến' } });
    const deletedStop = await prisma.stop.create({ data: { tripId: trip.id, name: 'Đã xóa', deletedAt: new Date() } });
    const expense = await add(trip.id, trip.a, 10);
    const foreignExpense = await add(foreign.id, foreign.a, 10);
    const foreignTransfer = await transfer(foreign.id, foreign.b, foreign.a, 1);
    const before = await snapshot(trip.id);
    for (const fields of [{ payerMemberId: foreign.a }, { payerMemberId: 'missing' }, { stopId: stop.id }, { stopId: deletedStop.id }, { stopId: 'missing' }]) {
      for (const method of ['POST', 'PATCH']) {
        const result = await api(method === 'POST' ? expensesUrl(trip.id) : `${expensesUrl(trip.id)}/${expense.id}`, {
          method, cookie: owner.cookie, key: randomUUID(), body: { title: 'Sai liên kết', amount: 1, payerMemberId: trip.a, version: 1, ...fields },
        });
        assert.ok([400, 404].includes(result.response.status), JSON.stringify(result.body));
      }
    }
    for (const field of ['fromMemberId', 'toMemberId']) {
      assert.equal((await api(settlementsUrl(trip.id), { method: 'POST', cookie: owner.cookie, key: randomUUID(), body: { fromMemberId: trip.a, toMemberId: trip.b, amount: 1, [field]: foreign.a } })).response.status, 400);
    }
    for (const id of [foreignExpense.id, 'missing']) {
      for (const method of ['PATCH', 'DELETE']) assert.equal((await api(`${expensesUrl(trip.id)}/${id}`, { method, cookie: owner.cookie, body: { version: 1, title: 'Sai chuyến' } })).response.status, 404);
    }
    assert.equal((await api(`${settlementsUrl(trip.id)}/${foreignTransfer.id}`, { method: 'DELETE', cookie: owner.cookie })).response.status, 404);
    assert.deepEqual(await snapshot(trip.id), before);
    assert.equal((await currentExpense(foreignExpense.id)).version, 1);
    assert.equal((await currentTransfer(foreignTransfer.id)).deletedAt, null);
  });

  await t.test('requires a session and ACTIVE membership for all six endpoints, including cached responses', async () => {
    const trip = await newTrip('access');
    const expense = await add(trip.id, trip.a, 10);
    const payment = await transfer(trip.id, trip.b, trip.a, 1);
    const key = randomUUID();
    const body = { title: 'B tạo', payerMemberId: trip.b, amount: 10 };
    assert.equal((await api(expensesUrl(trip.id), { method: 'POST', cookie: companion.cookie, key, body })).response.status, 201);
    const actions: [string, string, unknown][] = [
      [expensesUrl(trip.id), 'GET', undefined], [expensesUrl(trip.id), 'POST', body],
      [`${expensesUrl(trip.id)}/${expense.id}`, 'PATCH', { version: 1, title: 'Sửa' }],
      [`${expensesUrl(trip.id)}/${expense.id}`, 'DELETE', { version: 1 }],
      [settlementsUrl(trip.id), 'POST', { fromMemberId: trip.a, toMemberId: trip.b, amount: 1 }],
      [`${settlementsUrl(trip.id)}/${payment.id}`, 'DELETE', undefined],
    ];
    await prisma.tripMember.update({ where: { id: trip.b }, data: { status: 'REVOKED', revokedAt: new Date() } });
    const before = await snapshot(trip.id);
    for (const cookie of [undefined, outsider.cookie, companion.cookie]) {
      for (const [path, method, requestBody] of actions) {
        assert.equal((await api(path, { method, cookie, key, body: requestBody })).response.status, cookie ? 403 : 401);
      }
    }
    // Historical spending/debt remains visible to A after B loses access.
    const summary = (await ledger(trip.id)).summary;
    assert.equal(summary.totalSpent, '20');
    assert.equal(summary.spentByMember[trip.b], '10');
    await expectDebt(trip.id, trip.a, trip.b, '1');
    for (const fields of [{ payerMemberId: trip.b }, { payerMemberId: trip.a, splitType: 'FOR_OTHER' }]) {
      assert.equal((await api(expensesUrl(trip.id), { method: 'POST', cookie: owner.cookie, key: randomUUID(), body: { title: 'Thu hồi', amount: 1, ...fields } })).response.status, 400);
    }
    for (const [fromMemberId, toMemberId] of [[trip.a, trip.b], [trip.b, trip.a]]) {
      assert.equal((await api(settlementsUrl(trip.id), { method: 'POST', cookie: owner.cookie, key: randomUUID(), body: { fromMemberId, toMemberId, amount: 1 } })).response.status, 400);
    }
    assert.deepEqual(await snapshot(trip.id), before);
    await assert.rejects(createExpense(trip.id, companion.id, { title: 'Không quyền', amount: '1', payerMemberId: trip.a, splitType: 'PERSONAL' }, randomUUID()), { status: 403 });
  });

  await t.test('simultaneous expense retries commit once, replay exactly and reject key reuse', async () => {
    const trip = await newTrip('idempotency');
    const key = randomUUID();
    const body = { title: 'Một lần', payerMemberId: trip.a, amount: 101_001 };
    const results = await Promise.all(Array.from({ length: 4 }, () => api<ExpensePayload>(expensesUrl(trip.id), { method: 'POST', cookie: owner.cookie, key, body })));
    assert.ok(results.every((result) => result.response.status === 201), JSON.stringify(results.map((result) => result.body)));
    assert.equal(results.filter((result) => result.response.headers.get('X-Cache') === 'MISS').length, 1);
    assert.equal(results.filter((result) => result.response.headers.get('X-Cache') === 'HIT').length, 3);
    for (const result of results) assert.deepEqual(result.body, results[0]!.body);
    assert.equal(await prisma.expense.count({ where: { tripId: trip.id, idempotencyKey: key } }), 1);
    assert.equal(await prisma.idempotencyRecord.count({ where: { tripId: trip.id, key } }), 1);
    const before = await snapshot(trip.id);
    const normalized = await api(expensesUrl(trip.id), { method: 'POST', cookie: owner.cookie, key, body: { ...body, amount: '101001', splitType: 'EQUAL' } });
    assert.equal(normalized.response.headers.get('X-Cache'), 'HIT');
    assert.deepEqual(normalized.body, results[0]!.body);
    assert.equal((await api(expensesUrl(trip.id), { method: 'POST', cookie: owner.cookie, key, body: { ...body, amount: 20 } })).response.status, 409);
    assert.equal((await api(expensesUrl(trip.id), { method: 'POST', cookie: companion.cookie, key, body })).response.status, 409);
    assert.equal((await api(settlementsUrl(trip.id), { method: 'POST', cookie: owner.cookie, key, body: { fromMemberId: trip.a, toMemberId: trip.b, amount: 1 } })).response.status, 409);
    assert.deepEqual(await snapshot(trip.id), before);
    // Trip-scoped keys can be used independently in another trip.
    const other = await newTrip('key-scope');
    assert.equal((await api(expensesUrl(other.id), { method: 'POST', cookie: owner.cookie, key, body: { ...body, payerMemberId: other.a } })).response.status, 201);
  });

  await t.test('settlement retries commit once and soft deletion supports exact cached replay', async () => {
    const trip = await newTrip('transfer-idempotency');
    await add(trip.id, trip.a, 600);
    const key = randomUUID();
    const body = { fromMemberId: trip.b, toMemberId: trip.a, amount: 100, notes: '  Tiền mặt  ' };
    const results = await Promise.all(Array.from({ length: 3 }, () => api<TransferPayload>(settlementsUrl(trip.id), { method: 'POST', cookie: companion.cookie, key, body })));
    assert.ok(results.every((result) => result.response.status === 201));
    assert.equal(results.filter((result) => result.response.headers.get('X-Cache') === 'MISS').length, 1);
    for (const result of results) assert.deepEqual(result.body, results[0]!.body);
    const saved = results[0]!.body;
    assert.equal(saved.amount, '100');
    assert.equal(saved.notes, 'Tiền mặt');
    assert.equal(await prisma.settlementTransfer.count({ where: { tripId: trip.id, idempotencyKey: key } }), 1);
    await expectDebt(trip.id, trip.b, trip.a, '200');
    const deleteKey = randomUUID();
    const path = `${settlementsUrl(trip.id)}/${saved.id}`;
    const first = await api(path, { method: 'DELETE', cookie: owner.cookie, key: deleteKey });
    const replay = await api(path, { method: 'DELETE', cookie: owner.cookie, key: deleteKey });
    assert.equal(first.response.status, 200);
    assert.deepEqual(replay.body, first.body);
    assert.equal(replay.response.headers.get('X-Cache'), 'HIT');
    const tombstone = await currentTransfer(saved.id);
    assert.equal((await api(path, { method: 'DELETE', cookie: owner.cookie })).response.status, 404);
    assert.deepEqual(await currentTransfer(saved.id), tombstone);
    await expectDebt(trip.id, trip.b, trip.a, '300');
    assert.equal((await ledger(trip.id)).summary.totalSpent, '600');
  });

  await t.test('stale PATCH/DELETE conflict atomically; cached edits/deletes preserve versions and tombstones', async () => {
    const trip = await newTrip('versions');
    const expense = await add(trip.id, trip.a, 100);
    const path = `${expensesUrl(trip.id)}/${expense.id}`;
    const editKey = randomUUID();
    const body = { title: 'Sửa đúng một lần', amount: '200', version: 1 };
    const first = await api<ExpensePayload>(path, { method: 'PATCH', cookie: owner.cookie, key: editKey, body });
    const replay = await api<ExpensePayload>(path, { method: 'PATCH', cookie: owner.cookie, key: editKey, body });
    assert.equal(first.response.status, 200);
    assert.equal(first.body.version, 2);
    assert.deepEqual(replay.body, first.body);
    assert.equal(replay.response.headers.get('X-Cache'), 'HIT');
    const before = await snapshot(trip.id);
    for (const method of ['PATCH', 'DELETE']) {
      const result = await api(path, { method, cookie: owner.cookie, key: randomUUID(), body: { version: 1 } });
      assert.equal(result.response.status, 409);
      assert.deepEqual(result.body, { error: conflictMessage, currentVersion: 2 });
    }
    assert.equal((await api(`${path}?version=1`, { method: 'DELETE', cookie: owner.cookie })).response.status, 409);
    assert.deepEqual(await snapshot(trip.id), before);
    const deleteKey = randomUUID();
    const deleted = await api<ExpensePayload>(`${path}?version=2`, { method: 'DELETE', cookie: owner.cookie, key: deleteKey });
    const deletionReplay = await api(`${path}?version=2`, { method: 'DELETE', cookie: owner.cookie, key: deleteKey });
    assert.equal(deleted.response.status, 200);
    assert.equal(deleted.body.version, 3);
    assert.deepEqual(deletionReplay.body, deleted.body);
    assert.equal(deletionReplay.response.headers.get('X-Cache'), 'HIT');
    const tombstone = await snapshot(trip.id);
    assert.equal((await api(path, { method: 'DELETE', cookie: owner.cookie, body: { version: 2 } })).response.status, 409);
    assert.equal((await api(path, { method: 'PATCH', cookie: owner.cookie, body: { version: 3, amount: 999 } })).response.status, 404);
    assert.equal((await api(path, { method: 'DELETE', cookie: owner.cookie, body: { version: 3 } })).response.status, 404);
    assert.deepEqual(await snapshot(trip.id), tombstone);
    await expectDebt(trip.id, null, null, '0');
  });

  await t.test('concurrent edits and edit/delete races have exactly one winner', async () => {
    const trip = await newTrip('races');
    const expense = await add(trip.id, trip.a, 100);
    const path = `${expensesUrl(trip.id)}/${expense.id}`;
    const edits = await Promise.all(Array.from({ length: 4 }, (_, index) => api(path, { method: 'PATCH', cookie: owner.cookie, key: randomUUID(), body: { title: `Sửa ${index}`, amount: 200 + index, version: 1 } })));
    assert.deepEqual(edits.map((result) => result.response.status).sort(), [200, 409, 409, 409]);
    for (const result of edits.filter((item) => item.response.status === 409)) assert.equal(result.body.currentVersion, 2);
    assert.equal((await currentExpense(expense.id)).version, 2);
    const race = await Promise.all(['PATCH', 'DELETE'].map((method) => api(path, { method, cookie: owner.cookie, body: { version: 2, amount: 500 } })));
    assert.deepEqual(race.map((result) => result.response.status).sort(), [200, 409]);
    assert.equal((await currentExpense(expense.id)).version, 3);
    const payment = await transfer(trip.id, trip.b, trip.a, 1);
    const deletes = await Promise.all(Array.from({ length: 2 }, () => api(`${settlementsUrl(trip.id)}/${payment.id}`, { method: 'DELETE', cookie: owner.cookie })));
    assert.deepEqual(deletes.map((result) => result.response.status).sort(), [200, 404]);
  });

  await t.test('failed requests can retry the same key after correction without leaving cache or money writes', async () => {
    const trip = await newTrip('failed-retry');
    const key = randomUUID();
    const body = { title: 'Thử lại', amount: 100, payerMemberId: 'missing' };
    const before = await snapshot(trip.id);
    assert.equal((await api(expensesUrl(trip.id), { method: 'POST', cookie: owner.cookie, key, body })).response.status, 400);
    assert.deepEqual(await snapshot(trip.id), before);
    assert.equal((await api(expensesUrl(trip.id), { method: 'POST', cookie: owner.cookie, key, body: { ...body, payerMemberId: trip.a } })).response.status, 201);
    assert.equal(await prisma.expense.count({ where: { tripId: trip.id } }), 1);
    assert.equal(await prisma.idempotencyRecord.count({ where: { tripId: trip.id, key } }), 1);
  });

  await t.test('all five mutation services share the caller transaction and roll back every intermediate write', async () => {
    const trip = await newTrip('rollback');
    const original = await add(trip.id, trip.a, 100);
    const before = await snapshot(trip.id);
    await assert.rejects(prisma.$transaction(async (tx) => {
      const created = await createExpense(trip.id, owner.id, { title: 'Rollback', amount: '201', payerMemberId: trip.b, splitType: 'FOR_OTHER' }, randomUUID(), tx);
      await updateExpense(trip.id, owner.id, original.id, { amount: '300', version: 1 }, tx);
      await deleteExpense(trip.id, owner.id, created.id, { version: 1 }, tx);
      const payment = await createSettlement(trip.id, companion.id, { fromMemberId: trip.b, toMemberId: trip.a, amount: '50' }, randomUUID(), tx);
      await deleteSettlement(trip.id, owner.id, payment.id, tx);
      assert.equal((await tx.expense.findUniqueOrThrow({ where: { id: original.id } })).amount, 300n);
      throw new Error('Intentional expense rollback');
    }), /Intentional expense rollback/);
    assert.deepEqual(await snapshot(trip.id), before);
  });
});
