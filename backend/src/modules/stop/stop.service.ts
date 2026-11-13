import type { Prisma, Stop } from '@prisma/client';
import { inTransaction } from '../../utils/transaction.js';
import { HttpError, VersionConflictError } from '../../utils/httpError.js';
import { lockTripForMutation } from '../trip/trip.lock.js';
import { compactStopOrder, nextStopOrder } from './stop.order.js';
import type { CreateStopInput, DeleteStopInput, ReorderStopsInput, UpdateStopInput } from './stop.validation.js';

const STOP_VERSION_CONFLICT = 'Điểm dừng vừa được thay đổi trên thiết bị khác. Vui lòng tải lại trước khi sửa tiếp.';

function checkDay(day: number, durationDays: number) {
  if (day > durationDays) throw new HttpError(400, 'Ngày được chọn nằm ngoài thời gian chuyến đi.');
}

async function lockStop(tx: Prisma.TransactionClient, tripId: string, stopId: string, version: number) {
  const stops = await tx.$queryRaw<Stop[]>`SELECT * FROM "Stop" WHERE "id" = ${stopId} AND "tripId" = ${tripId} AND "deletedAt" IS NULL FOR UPDATE`;
  const stop = stops[0];
  if (!stop) throw new HttpError(404, 'Không tìm thấy điểm dừng trong chuyến đi này.');
  if (stop.version !== version) throw new VersionConflictError(STOP_VERSION_CONFLICT, stop.version);
  return stop;
}

export function createStop(tripId: string, userId: string, input: CreateStopInput, transaction?: Prisma.TransactionClient) {
  return inTransaction(async (tx) => {
    const trip = await lockTripForMutation(tx, tripId, userId);
    checkDay(input.day, trip.durationDays);
    const stop = await tx.stop.create({ data: { ...input, tripId, estimatedCost: BigInt(input.estimatedCost), orderIndex: await nextStopOrder(tx, tripId, input.day) } });
    await tx.trip.update({ where: { id: tripId }, data: { version: { increment: 1 } } });
    return stop;
  }, transaction);
}

export function updateStop(tripId: string, userId: string, stopId: string, input: UpdateStopInput, transaction?: Prisma.TransactionClient) {
  return inTransaction(async (tx) => {
    const trip = await lockTripForMutation(tx, tripId, userId);
    const stop = await lockStop(tx, tripId, stopId, input.version);
    const day = input.day ?? stop.day;
    checkDay(day, trip.durationDays);
    const latitude = input.latitude === undefined ? stop.latitude : input.latitude;
    const longitude = input.longitude === undefined ? stop.longitude : input.longitude;
    if ((latitude === null) !== (longitude === null)) {
      throw new HttpError(400, 'Vĩ độ và kinh độ phải cùng có giá trị hoặc cùng để trống.');
    }
    const { version, estimatedCost, ...fields } = input;
    const updated = await tx.stop.update({ where: { id: stopId }, data: {
      ...fields,
      ...(estimatedCost === undefined ? {} : { estimatedCost: BigInt(estimatedCost) }),
      ...(day === stop.day ? {} : { orderIndex: await nextStopOrder(tx, tripId, day) }),
      version: { increment: 1 },
    } });
    if (day !== stop.day) await compactStopOrder(tx, tripId, stop.day);
    await tx.trip.update({ where: { id: tripId }, data: { version: { increment: 1 } } });
    return updated;
  }, transaction);
}

export function deleteStop(tripId: string, userId: string, stopId: string, input: DeleteStopInput, transaction?: Prisma.TransactionClient) {
  return inTransaction(async (tx) => {
    await lockTripForMutation(tx, tripId, userId);
    const stop = await lockStop(tx, tripId, stopId, input.version);
    const deleted = await tx.stop.update({ where: { id: stopId }, data: { deletedAt: new Date(), version: { increment: 1 } } });
    await compactStopOrder(tx, tripId, stop.day);
    await tx.trip.update({ where: { id: tripId }, data: { version: { increment: 1 } } });
    return deleted;
  }, transaction);
}

export function reorderStops(tripId: string, userId: string, input: ReorderStopsInput, transaction?: Prisma.TransactionClient) {
  return inTransaction(async (tx) => {
    const trip = await lockTripForMutation(tx, tripId, userId);
    checkDay(input.day, trip.durationDays);
    const stops = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Stop" WHERE "tripId" = ${tripId} AND "day" = ${input.day} AND "deletedAt" IS NULL ORDER BY "id" FOR UPDATE`;
    const ids = new Set(stops.map((stop) => stop.id));
    if (new Set(input.stopIds).size !== input.stopIds.length || input.stopIds.some((id) => !ids.has(id))) {
      throw new HttpError(400, 'Danh sách phải gồm các điểm dừng chưa xóa, thuộc đúng chuyến đi và ngày đã chọn, không trùng lặp.');
    }
    // A complete snapshot avoids colliding with omitted or concurrently added stops.
    if (stops.length !== input.stopIds.length) {
      throw new HttpError(409, 'Danh sách điểm dừng trong ngày đã thay đổi hoặc chưa đầy đủ. Vui lòng tải lại trước khi sắp xếp.');
    }
    const reordered: Stop[] = [];
    for (const [index, id] of input.stopIds.entries()) {
      reordered.push(await tx.stop.update({ where: { id }, data: { orderIndex: index + 1, version: { increment: 1 } } }));
    }
    await tx.trip.update({ where: { id: tripId }, data: { version: { increment: 1 } } });
    return reordered;
  }, transaction);
}
