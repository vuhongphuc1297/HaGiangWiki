import type { Prisma, Trip } from '@prisma/client';
import { HttpError, TRIP_ACCESS_DENIED } from '../../utils/httpError.js';

// Every itinerary mutation takes Trip before Stop locks. This also protects empty
// days and the staging area against concurrent inserts, moves and duration edits.
export async function lockTripForMutation(tx: Prisma.TransactionClient, tripId: string, userId: string, ownerOnly = false) {
  const trips = await tx.$queryRaw<Trip[]>`SELECT * FROM "Trip" WHERE "id" = ${tripId} FOR UPDATE`;
  const member = await tx.tripMember.findUnique({ where: { tripId_userId: { tripId, userId } } });
  const trip = trips[0];
  if (!trip || member?.status !== 'ACTIVE' || (ownerOnly && member.role !== 'OWNER')) {
    throw new HttpError(403, TRIP_ACCESS_DENIED);
  }
  return trip;
}
