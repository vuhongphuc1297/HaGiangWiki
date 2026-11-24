import { Prisma } from '@prisma/client';
import type { PackingItem, TripMember } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { inTransaction } from '../../utils/transaction.js';
import { HttpError, TRIP_ACCESS_DENIED, VersionConflictError } from '../../utils/httpError.js';
import { lockTripForMutation } from '../trip/trip.lock.js';
import { packingTitleKey, personalPackingTemplate } from './packing.templates.js';
import type { CreateCategoryInput, CreatePackingInput, DeletePackingInput, UpdatePackingInput } from './packing.validation.js';

const itemSelection = { id: true, title: true, categoryId: true, isPacked: true, version: true, createdAt: true, updatedAt: true } satisfies Prisma.PackingItemSelect;
const categorySelection = { id: true, name: true } satisfies Prisma.PackingCategorySelect;

async function currentMember(tx: Prisma.TransactionClient, tripId: string, userId: string, lock = false) {
  if (lock) {
    await lockTripForMutation(tx, tripId, userId);
    const [member] = await tx.$queryRaw<TripMember[]>`SELECT * FROM "TripMember" WHERE "tripId" = ${tripId} AND "userId" = ${userId} FOR SHARE`;
    if (!member || member.status !== 'ACTIVE') throw new HttpError(403, TRIP_ACCESS_DENIED);
    return member;
  }
  const member = await tx.tripMember.findUnique({ where: { tripId_userId: { tripId, userId } } });
  if (!member || member.status !== 'ACTIVE') throw new HttpError(403, TRIP_ACCESS_DENIED);
  return member;
}

async function privateList(tx: Prisma.TransactionClient, tripId: string, memberId: string) {
  const items = await tx.packingItem.findMany({
    where: { tripId, assignedToMemberId: memberId, isShared: false },
    select: itemSelection, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const categories = await tx.packingCategory.findMany({
    where: { memberId }, select: categorySelection, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const packed = items.filter((item) => item.isPacked).length;
  return { items, categories, stats: { total: items.length, packed, percentage: items.length ? Math.round(packed * 100 / items.length) : 0 } };
}

async function ownItem(tx: Prisma.TransactionClient, tripId: string, memberId: string, itemId: string, version?: number) {
  const [item] = await tx.$queryRaw<PackingItem[]>`SELECT * FROM "PackingItem" WHERE "id" = ${itemId} AND "tripId" = ${tripId} FOR UPDATE`;
  if (!item) throw new HttpError(404, 'Không tìm thấy món đồ trong chuyến đi này.');
  // Ownership is checked before version so another member never receives item details.
  if (item.isShared || item.assignedToMemberId !== memberId) throw new HttpError(403, 'Bạn chỉ có thể thay đổi hành trang cá nhân của mình.');
  if (version !== undefined && item.version !== version) {
    throw new VersionConflictError('Món đồ vừa được thay đổi trên thiết bị khác. Vui lòng tải lại trước khi sửa tiếp.', item.version);
  }
  return item;
}

export function listPacking(tripId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const member = await currentMember(tx, tripId, userId);
    return privateList(tx, tripId, member.id);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export function createPackingCategory(tripId: string, userId: string, input: CreateCategoryInput, transaction?: Prisma.TransactionClient) {
  return inTransaction(async (tx) => {
    const member = await currentMember(tx, tripId, userId, true);
    const [category] = await tx.packingCategory.createManyAndReturn({
      data: [{ memberId: member.id, name: input.name, nameKey: packingTitleKey(input.name) }],
      skipDuplicates: true, select: categorySelection,
    });
    if (!category) throw new HttpError(409, 'Bạn đã có danh mục hành lý với tên này.');
    return category;
  }, transaction);
}

async function checkCategory(tx: Prisma.TransactionClient, memberId: string, categoryId: string | null | undefined) {
  if (categoryId == null) return;
  const category = await tx.packingCategory.findUnique({ where: { memberId_id: { memberId, id: categoryId } }, select: { id: true } });
  if (!category) throw new HttpError(404, 'Không tìm thấy danh mục hành lý.');
}

export function createPacking(tripId: string, userId: string, input: CreatePackingInput, transaction?: Prisma.TransactionClient) {
  return inTransaction(async (tx) => {
    const member = await currentMember(tx, tripId, userId, true);
    await checkCategory(tx, member.id, input.categoryId);
    return tx.packingItem.create({ data: {
      tripId, title: input.title, categoryId: input.categoryId, isShared: false, assignedToMemberId: member.id, isPacked: false,
    }, select: itemSelection });
  }, transaction);
}

export function updatePacking(tripId: string, userId: string, itemId: string, input: UpdatePackingInput, transaction?: Prisma.TransactionClient) {
  return inTransaction(async (tx) => {
    const member = await currentMember(tx, tripId, userId, true);
    await ownItem(tx, tripId, member.id, itemId, input.version);
    await checkCategory(tx, member.id, input.categoryId);
    return tx.packingItem.update({ where: { id: itemId }, data: {
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.isPacked === undefined ? {} : { isPacked: input.isPacked }),
      categoryId: input.categoryId,
      version: { increment: 1 },
    }, select: itemSelection });
  }, transaction);
}

export function deletePacking(tripId: string, userId: string, itemId: string, input: DeletePackingInput = {}, transaction?: Prisma.TransactionClient) {
  return inTransaction(async (tx) => {
    const member = await currentMember(tx, tripId, userId, true);
    await ownItem(tx, tripId, member.id, itemId, input.version);
    // PackingItem has no tombstone column; deletion follows the existing model.
    return tx.packingItem.delete({ where: { id: itemId }, select: itemSelection });
  }, transaction);
}

export function addPackingTemplate(tripId: string, userId: string, transaction?: Prisma.TransactionClient) {
  return inTransaction(async (tx) => {
    // The Trip lock serializes template imports despite the schema having no title unique key.
    const member = await currentMember(tx, tripId, userId, true);
    const existing = await tx.packingItem.findMany({ where: { tripId, assignedToMemberId: member.id, isShared: false }, select: { title: true } });
    const titles = new Set(existing.map((item) => packingTitleKey(item.title)));
    const missing = personalPackingTemplate.filter((title) => !titles.has(packingTitleKey(title)));
    if (missing.length) await tx.packingItem.createMany({ data: missing.map((title) => ({
      tripId, title, isShared: false, assignedToMemberId: member.id, isPacked: false,
    })) });
    return { ...await privateList(tx, tripId, member.id), addedCount: missing.length };
  }, transaction);
}
