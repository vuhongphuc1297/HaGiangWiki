import { prisma } from '../../config/database.js';
import { HttpError } from '../../utils/httpError.js';

export const DEMO_TRIP_ID = 'demo_trip_hagiang_20261120';

// Only this explicitly seeded, fictional trip is public. Never accept an ID here.
export async function getDemoTrip() {
  const trip = await prisma.trip.findUnique({
    where: { id: DEMO_TRIP_ID },
    select: {
      id: true, title: true, startDate: true, durationDays: true, vehicle: true,
      budget: true, timezone: true, version: true,
      members: {
        where: { status: 'ACTIVE' }, orderBy: { joinedAt: 'asc' },
        select: { id: true, nickname: true, role: true, status: true, user: { select: { displayName: true } } },
      },
      stops: { where: { deletedAt: null }, orderBy: [{ day: 'asc' }, { orderIndex: 'asc' }, { id: 'asc' }] },
    },
  });
  if (!trip) throw new HttpError(404, 'Chưa có lịch trình mẫu. Bạn vẫn có thể tạo chuyến đi mới.');
  return { ...trip, readOnly: true, members: trip.members.map(({ user, ...member }) => ({ ...member, displayName: user.displayName })) };
}
