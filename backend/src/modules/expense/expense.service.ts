import { Prisma } from '@prisma/client';
import type { Expense, SettlementTransfer, TripMember } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { HttpError, TRIP_ACCESS_DENIED, VersionConflictError } from '../../utils/httpError.js';
import { inTransaction } from '../../utils/transaction.js';
import { lockTripForMutation } from '../trip/trip.lock.js';
import { calculateExpenseSummary } from './expense.calculator.js';
import type { CreateExpenseInput, CreateSettlementInput, DeleteExpenseInput, UpdateExpenseInput } from './expense.validation.js';

const EXPENSE_VERSION_CONFLICT = 'Khoản chi vừa được thay đổi trên thiết bị khác. Vui lòng tải lại trước khi sửa tiếp.';

function checkMemberPair(members: readonly TripMember[]) {
  // Revoked members remain in the ledger so revocation never erases their debt.
  if (members.length > 2) throw new HttpError(409, 'Sổ quyết toán chỉ hỗ trợ tối đa hai thành viên, kể cả lịch sử thành viên đã thu hồi.');
}

async function lockLedger(tx: Prisma.TransactionClient, tripId: string, userId: string) {
  await lockTripForMutation(tx, tripId, userId);
  const members = await tx.$queryRaw<TripMember[]>`SELECT * FROM "TripMember" WHERE "tripId" = ${tripId} ORDER BY "id" FOR SHARE`;
  if (!members.some((member) => member.userId === userId && member.status === 'ACTIVE')) {
    throw new HttpError(403, TRIP_ACCESS_DENIED);
  }
  checkMemberPair(members);
  return members;
}

function requireActiveMember(members: readonly TripMember[], memberId: string) {
  if (!members.some((member) => member.id === memberId && member.status === 'ACTIVE')) {
    throw new HttpError(400, 'Người trả, người chuyển và người nhận phải là thành viên ACTIVE của chuyến đi.');
  }
}

async function checkExpenseReferences(
  tx: Prisma.TransactionClient, tripId: string, members: readonly TripMember[],
  expense: { payerMemberId: string; stopId?: string | null; splitType: string },
) {
  requireActiveMember(members, expense.payerMemberId);
  if (expense.splitType === 'FOR_OTHER' && members.filter((member) => member.status === 'ACTIVE').length !== 2) {
    throw new HttpError(400, 'Chi hộ cần hai thành viên ACTIVE trong chuyến đi.');
  }
  if (expense.stopId != null && !await tx.stop.findFirst({ where: { id: expense.stopId, tripId, deletedAt: null }, select: { id: true } })) {
    throw new HttpError(404, 'Không tìm thấy điểm dừng chưa xóa trong chuyến đi này.');
  }
}

async function lockExpense(tx: Prisma.TransactionClient, tripId: string, expenseId: string, version: number) {
  const [expense] = await tx.$queryRaw<Expense[]>`SELECT * FROM "Expense" WHERE "id" = ${expenseId} AND "tripId" = ${tripId} FOR UPDATE`;
  if (!expense) throw new HttpError(404, 'Không tìm thấy khoản chi trong chuyến đi này.');
  if (expense.version !== version) throw new VersionConflictError(EXPENSE_VERSION_CONFLICT, expense.version);
  if (expense.deletedAt) throw new HttpError(404, 'Khoản chi đã bị xóa.');
  return expense;
}

export function listExpenses(tripId: string, userId: string) {
  // A repeatable snapshot keeps budget, both ledgers and the summary consistent.
  return prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findFirst({
      where: { id: tripId, members: { some: { userId, status: 'ACTIVE' } } },
      include: {
        members: { orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }] },
        expenses: { where: { deletedAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        transfers: { where: { deletedAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!trip) throw new HttpError(403, TRIP_ACCESS_DENIED);
    checkMemberPair(trip.members);
    return {
      expenses: trip.expenses, settlements: trip.transfers,
      summary: calculateExpenseSummary(trip.members.map((member) => member.id), trip.budget, trip.expenses, trip.transfers),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export function createExpense(tripId: string, userId: string, input: CreateExpenseInput, idempotencyKey: string, transaction?: Prisma.TransactionClient) {
  return inTransaction(async (tx) => {
    const members = await lockLedger(tx, tripId, userId);
    await checkExpenseReferences(tx, tripId, members, input);
    const expense = await tx.expense.create({ data: { ...input, tripId, idempotencyKey, amount: BigInt(input.amount) } });
    await tx.trip.update({ where: { id: tripId }, data: { version: { increment: 1 } } });
    return expense;
  }, transaction);
}

export function updateExpense(tripId: string, userId: string, expenseId: string, input: UpdateExpenseInput, transaction?: Prisma.TransactionClient) {
  return inTransaction(async (tx) => {
    const members = await lockLedger(tx, tripId, userId);
    const expense = await lockExpense(tx, tripId, expenseId, input.version);
    // Only supplied stop references are validated: its tombstone must not prevent a title edit.
    await checkExpenseReferences(tx, tripId, members, {
      payerMemberId: input.payerMemberId ?? expense.payerMemberId,
      splitType: input.splitType ?? expense.splitType,
      stopId: input.stopId,
    });
    const { version, amount, ...fields } = input;
    const updated = await tx.expense.update({ where: { id: expenseId }, data: {
      ...fields, ...(amount === undefined ? {} : { amount: BigInt(amount) }), version: { increment: 1 },
    } });
    await tx.trip.update({ where: { id: tripId }, data: { version: { increment: 1 } } });
    return updated;
  }, transaction);
}

export function deleteExpense(tripId: string, userId: string, expenseId: string, input: DeleteExpenseInput, transaction?: Prisma.TransactionClient) {
  return inTransaction(async (tx) => {
    await lockLedger(tx, tripId, userId);
    await lockExpense(tx, tripId, expenseId, input.version);
    const deleted = await tx.expense.update({ where: { id: expenseId }, data: { deletedAt: new Date(), version: { increment: 1 } } });
    await tx.trip.update({ where: { id: tripId }, data: { version: { increment: 1 } } });
    return deleted;
  }, transaction);
}

export function createSettlement(tripId: string, userId: string, input: CreateSettlementInput, idempotencyKey: string, transaction?: Prisma.TransactionClient) {
  return inTransaction(async (tx) => {
    const members = await lockLedger(tx, tripId, userId);
    requireActiveMember(members, input.fromMemberId);
    requireActiveMember(members, input.toMemberId);
    if (input.fromMemberId === input.toMemberId) throw new HttpError(400, 'Người chuyển và người nhận phải khác nhau.');
    const transfer = await tx.settlementTransfer.create({ data: { ...input, tripId, idempotencyKey, amount: BigInt(input.amount) } });
    await tx.trip.update({ where: { id: tripId }, data: { version: { increment: 1 } } });
    return transfer;
  }, transaction);
}

export function deleteSettlement(tripId: string, userId: string, settlementId: string, transaction?: Prisma.TransactionClient) {
  return inTransaction(async (tx) => {
    await lockLedger(tx, tripId, userId);
    const [transfer] = await tx.$queryRaw<SettlementTransfer[]>`SELECT * FROM "SettlementTransfer" WHERE "id" = ${settlementId} AND "tripId" = ${tripId} AND "deletedAt" IS NULL FOR UPDATE`;
    if (!transfer) throw new HttpError(404, 'Không tìm thấy giao dịch chuyển trả trong chuyến đi này.');
    const deleted = await tx.settlementTransfer.update({ where: { id: settlementId }, data: { deletedAt: new Date() } });
    await tx.trip.update({ where: { id: tripId }, data: { version: { increment: 1 } } });
    return deleted;
  }, transaction);
}
