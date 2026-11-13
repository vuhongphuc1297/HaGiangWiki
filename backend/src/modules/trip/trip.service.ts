import type { Prisma, User } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { inTransaction } from '../../utils/transaction.js';
import { HttpError, TRIP_ACCESS_DENIED, VersionConflictError } from '../../utils/httpError.js';
import { nextStopOrder } from '../stop/stop.order.js';
import { lockTripForMutation } from './trip.lock.js';
import type { CreateTripInput, UpdateTripInput } from './trip.validation.js';

const memberSelection = {
  id: true, userId: true, nickname: true, role: true, status: true, joinedAt: true, revokedAt: true,
  user: { select: { displayName: true } },
} satisfies Prisma.TripMemberSelect;

function presentTrip<T extends { members: { user: { displayName: string } }[] }>(trip: T) {
  return { ...trip, members: trip.members.map(({ user, ...member }) => ({ ...member, displayName: user.displayName })) };
}

export async function createTrip(input: CreateTripInput, user: User, transaction?: Prisma.TransactionClient) {
  return inTransaction(async (tx) => {
    const template = input.templateId ? await tx.trip.findUnique({
      where: { id: input.templateId },
      include: { stops: { where: { deletedAt: null }, orderBy: [{ day: 'asc' }, { orderIndex: 'asc' }] } },
    }) : null;
    if (input.templateId && !template) throw new HttpError(404, 'Không tìm thấy lịch trình mẫu. Hãy tạo chuyến đi không dùng mẫu.');
    const trip = await tx.trip.create({ data: {
      title: input.title,
      startDate: new Date(`${input.startDate}T00:00:00.000Z`),
      durationDays: input.durationDays,
      vehicle: input.vehicle,
      budget: BigInt(input.budget ?? 0),
      version: 1,
    } });
    await tx.tripMember.create({ data: { tripId: trip.id, userId: user.id, role: 'OWNER', nickname: user.displayName, status: 'ACTIVE' } });
    if (template?.stops.length) {
      await tx.stop.createMany({ data: template.stops.map((stop) => ({
        tripId: trip.id, name: stop.name, category: stop.category,
        day: stop.day <= input.durationDays ? stop.day : 0,
        orderIndex: stop.orderIndex, arriveTime: stop.arriveTime, leaveTime: stop.leaveTime,
        latitude: stop.latitude, longitude: stop.longitude, estimatedCost: stop.estimatedCost, notes: stop.notes,
      })) });
    }
    return presentTrip(await tx.trip.findUniqueOrThrow({ where: { id: trip.id }, include: { members: { select: memberSelection } } }));
  }, transaction);
}

export async function getTrip(tripId: string, userId: string) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, members: { some: { userId, status: 'ACTIVE' } } },
    include: {
      members: { select: memberSelection, orderBy: { joinedAt: 'asc' } },
      stops: { where: { deletedAt: null }, orderBy: [{ day: 'asc' }, { orderIndex: 'asc' }, { id: 'asc' }] },
    },
  });
  if (!trip) throw new HttpError(403, TRIP_ACCESS_DENIED);
  return presentTrip(trip);
}

export function updateTrip(tripId: string, userId: string, input: UpdateTripInput, transaction?: Prisma.TransactionClient) {
  return inTransaction(async (tx) => {
    const trip = await lockTripForMutation(tx, tripId, userId, true);
    if (trip.version !== input.version) {
      throw new VersionConflictError('Chuyến đi vừa được thay đổi trên thiết bị khác. Vui lòng tải lại trước khi sửa tiếp.', trip.version);
    }
    let movedStopsCount = 0;
    if (input.durationDays !== undefined && input.durationDays < trip.durationDays) {
      const stops = await tx.stop.findMany({
        where: { tripId, day: { gt: input.durationDays }, deletedAt: null },
        orderBy: [{ day: 'asc' }, { orderIndex: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });
      const firstOrder = await nextStopOrder(tx, tripId, 0);
      for (const [index, stop] of stops.entries()) {
        await tx.stop.update({ where: { id: stop.id }, data: { day: 0, orderIndex: firstOrder + index, version: { increment: 1 } } });
      }
      movedStopsCount = stops.length;
    }
    const { version, startDate, budget, ...fields } = input;
    const updated = await tx.trip.update({ where: { id: tripId }, data: {
      ...fields,
      ...(startDate === undefined ? {} : { startDate: new Date(`${startDate}T00:00:00.000Z`) }),
      ...(budget === undefined ? {} : { budget: BigInt(budget) }),
      version: { increment: 1 },
    }, include: {
      members: { select: memberSelection, orderBy: { joinedAt: 'asc' } },
      stops: { where: { deletedAt: null }, orderBy: [{ day: 'asc' }, { orderIndex: 'asc' }, { id: 'asc' }] },
    } });
    return { ...presentTrip(updated), movedStopsCount };
  }, transaction);
}
