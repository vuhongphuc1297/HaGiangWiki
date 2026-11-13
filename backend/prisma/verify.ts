import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { env } from '../src/config/env.js';

const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
const tripId = 'demo_trip_hagiang_20261120';
const tuanId = 'demo_member_tuan';
const linhId = 'demo_member_linh';
let constraintChecks = 0;

async function rejectsWithCode(work: (tx: Prisma.TransactionClient) => Promise<unknown>, code: string) {
  await assert.rejects(prisma.$transaction(work), (error: unknown) => (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  ));
  constraintChecks += 1;
}

async function withForeignMember(tx: Prisma.TransactionClient) {
  const trip = await tx.trip.create({ data: { title: 'Temporary constraint check', startDate: new Date('2026-11-20') } });
  return tx.tripMember.create({ data: { tripId: trip.id, userId: 'demo_user_tuan', nickname: 'Temporary' } });
}

async function rolledBack(work: (tx: Prisma.TransactionClient) => Promise<void>) {
  const rollback = new Error('Verification rollback');
  await assert.rejects(prisma.$transaction(async (tx) => {
    await work(tx);
    throw rollback;
  }), (error: unknown) => error === rollback);
  constraintChecks += 1;
}

async function main() {
  const tableNames = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = current_schema()
      AND tablename <> '_prisma_migrations' ORDER BY tablename
  `;
  const expectedTables = ['User', 'Session', 'Trip', 'TripMember', 'TripInvite', 'Stop', 'Expense', 'SettlementTransfer', 'PackingItem', 'IdempotencyRecord'].sort();
  assert.deepEqual(tableNames.map((row) => row.tablename).sort(), expectedTables);

  const trip = await prisma.trip.findUniqueOrThrow({ where: { id: tripId }, include: {
    members: { include: { user: true } },
    stops: { orderBy: [{ day: 'asc' }, { orderIndex: 'asc' }] },
    expenses: { where: { deletedAt: null } },
    transfers: { where: { deletedAt: null } },
    packingItems: true,
    invites: true,
    idempotencyRecords: true,
  } });
  assert.equal(trip.title, 'Hà Giang · Explore the Loop');
  assert.equal(trip.startDate.toISOString().slice(0, 10), '2026-11-20');
  assert.equal(trip.durationDays, 3);
  assert.equal(trip.vehicle, 'XE_MAY');
  assert.equal(trip.timezone, 'Asia/Ho_Chi_Minh');
  assert.equal(trip.budget, 5_000_000n);
  assert.equal(trip.members.length, 2);
  assert.deepEqual(trip.members.map((member) => [member.nickname, member.role, member.status]).sort(), [
    ['Linh', 'MEMBER', 'ACTIVE'], ['Tuấn', 'OWNER', 'ACTIVE'],
  ]);
  assert.deepEqual(trip.members.map((member) => member.user.displayName).sort(), ['Linh (B)', 'Tuấn (A)']);
  assert.equal(trip.stops.length, 9);
  assert.deepEqual([0, 1, 2, 3].map((day) => trip.stops.filter((stop) => stop.day === day).length), [1, 3, 3, 2]);
  const pool = trip.stops.find((stop) => stop.day === 0);
  assert.equal(pool?.name, 'Quán cơm Mẹ Nấu');
  assert.equal(pool?.latitude, null);
  assert.equal(pool?.longitude, null);
  const quanBa = trip.stops.find((stop) => stop.id === 'demo_stop_quan_ba');
  assert.equal(quanBa?.estimatedCost, 60_000n);
  assert.equal(quanBa?.latitude, 23.0567);
  assert.equal(quanBa?.longitude, 104.9876);
  assert.equal(quanBa?.arriveTime, '09:30');
  assert.equal(quanBa?.leaveTime, '10:30');
  const lungCu = trip.stops.find((stop) => stop.id === 'demo_stop_lung_cu');
  assert.equal(lungCu?.latitude, 23.3615);
  assert.equal(lungCu?.longitude, 105.3195);
  assert.equal(trip.stops.filter((stop) => stop.latitude !== null).length, 2);

  assert.equal(trip.expenses.length, 3);
  assert.equal(trip.expenses.reduce((total, expense) => total + expense.amount, 0n), 900_000n);
  let beforeTransfer = 0n;
  for (const expense of trip.expenses) {
    const sign = expense.payerMemberId === tuanId ? 1n : -1n;
    if (expense.splitType === 'EQUAL') {
      assert.equal(expense.amount % 2n, 0n);
      beforeTransfer += sign * (expense.amount / 2n);
    } else if (expense.splitType === 'FOR_OTHER') {
      beforeTransfer += sign * expense.amount;
    } else {
      assert.equal(expense.splitType, 'PERSONAL');
    }
  }
  assert.equal(beforeTransfer, 300_000n);
  assert.equal(trip.transfers.length, 1);
  let remaining = beforeTransfer;
  for (const transfer of trip.transfers) {
    assert.equal(transfer.fromMemberId, linhId);
    assert.equal(transfer.toMemberId, tuanId);
    assert.equal(transfer.amount, 100_000n);
    remaining -= transfer.amount;
  }
  assert.equal(remaining, 200_000n);
  assert.equal(trip.packingItems.length, 8);
  assert.equal(trip.packingItems.filter((item) => item.isPacked).length, 4);
  for (const memberId of [tuanId, linhId]) {
    const personal = trip.packingItems.filter((item) => !item.isShared && item.assignedToMemberId === memberId);
    assert.equal(personal.length, 2);
    assert.equal(personal.find((item) => item.title === 'Áo khoác')?.isPacked, true);
    assert.equal(personal.find((item) => item.title === 'Giấy tờ tùy thân')?.isPacked, false);
  }
  const sessions = await prisma.session.findMany({ where: { userId: { in: trip.members.map((member) => member.userId) } } });
  assert.equal(sessions.length, 2);
  assert.ok(sessions.every((session) => session.revokedAt !== null));
  assert.equal(trip.invites.length, 1);
  assert.ok(trip.invites[0]?.usedAt);
  assert.equal(trip.idempotencyRecords.length, 1);
  assert.equal(trip.idempotencyRecords[0]?.responseStatus, 201);
  assert.equal((trip.idempotencyRecords[0]?.responseBody as { amount: string }).amount, '600000');

  const baseExpense = { tripId, payerMemberId: tuanId, amount: 1n, title: 'Temporary check', idempotencyKey: randomUUID() };
  await rejectsWithCode((tx) => tx.expense.create({ data: { ...baseExpense, idempotencyKey: 'seed:expense:homestay' } }), 'P2002');
  await rejectsWithCode((tx) => tx.tripMember.create({ data: { tripId, userId: 'demo_user_tuan', nickname: 'Duplicate' } }), 'P2002');
  await rejectsWithCode((tx) => tx.session.create({ data: { userId: 'demo_user_tuan', tokenHash: sessions[0]!.tokenHash, expiresAt: new Date('2026-11-21') } }), 'P2002');
  await rejectsWithCode((tx) => tx.settlementTransfer.create({ data: { tripId, fromMemberId: linhId, toMemberId: tuanId, amount: 1n, idempotencyKey: 'seed:transfer:linh-tuan' } }), 'P2002');
  await rejectsWithCode((tx) => tx.idempotencyRecord.create({ data: { tripId, userId: 'demo_user_tuan', key: 'seed:expense:homestay', requestHash: 'test', responseStatus: 201, responseBody: {}, expiresAt: new Date('2026-11-21') } }), 'P2002');
  await rejectsWithCode(async (tx) => {
    const foreign = await withForeignMember(tx);
    const stop = await tx.stop.create({ data: { tripId: foreign.tripId, name: 'Foreign stop' } });
    return tx.expense.create({ data: { ...baseExpense, stopId: stop.id } });
  }, 'P2003');
  await rejectsWithCode(async (tx) => {
    const foreign = await withForeignMember(tx);
    return tx.expense.create({ data: { ...baseExpense, payerMemberId: foreign.id } });
  }, 'P2003');
  for (const field of ['fromMemberId', 'toMemberId'] as const) {
    await rejectsWithCode(async (tx) => {
      const foreign = await withForeignMember(tx);
      return tx.settlementTransfer.create({ data: { tripId, fromMemberId: linhId, toMemberId: tuanId, amount: 1n, idempotencyKey: randomUUID(), [field]: foreign.id } });
    }, 'P2003');
  }
  await rejectsWithCode(async (tx) => {
    const foreign = await withForeignMember(tx);
    return tx.packingItem.create({ data: { tripId, title: 'Foreign carrier', assignedToMemberId: foreign.id } });
  }, 'P2003');

  await assert.rejects(prisma.$transaction((tx) => tx.$executeRaw`
    INSERT INTO "Expense" ("id", "tripId", "payerMemberId", "amount", "title", "idempotencyKey", "updatedAt")
    VALUES (${randomUUID()}, ${tripId}, ${tuanId}, ${-1n}, 'Invalid negative amount', ${randomUUID()}, CURRENT_TIMESTAMP)
  `), (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2010' && error.meta?.code === '23514');
  constraintChecks += 1;

  await rolledBack(async (tx) => {
    await tx.stop.update({ where: { id: 'demo_stop_quan_ba' }, data: { deletedAt: new Date() } });
    const expense = await tx.expense.findUniqueOrThrow({ where: { id: 'demo_expense_ve' }, include: { stop: true } });
    assert.ok(expense.stop?.deletedAt);
  });
  await rolledBack(async (tx) => {
    const user = await tx.user.create({ data: { displayName: 'Temporary session owner', sessions: { create: { tokenHash: randomUUID(), expiresAt: new Date('2026-11-21') } } } });
    await tx.user.delete({ where: { id: user.id } });
    assert.equal(await tx.session.count({ where: { userId: user.id } }), 0);
  });

  assert.equal(await prisma.trip.count({ where: { title: 'Temporary constraint check' } }), 0);
  console.info(JSON.stringify({
    tables: tableNames.map((row) => row.tablename),
    sample: { users: 2, trips: 1, members: 2, stops: trip.stops.length, expenses: trip.expenses.length, transfers: trip.transfers.length, packingItems: trip.packingItems.length, packed: 4, sessions: sessions.length, invites: trip.invites.length, idempotencyRecords: trip.idempotencyRecords.length },
    expenseTotalVnd: '900000', debtBeforeTransferVnd: beforeTransfer.toString(), remainingDebtVnd: remaining.toString(),
    constraintChecks, result: 'pass',
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
