import type { Prisma, TripInvite, User } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { generateInviteCode, hashToken, normalizeInviteToken } from '../../utils/crypto.js';
import { inTransaction } from '../../utils/transaction.js';
import { HttpError, INVALID_INVITE, TRIP_ACCESS_DENIED } from '../../utils/httpError.js';
import { createSession } from '../auth/auth.service.js';

function isValid(invite: TripInvite | null, now: Date): invite is TripInvite {
  return invite !== null && invite.expiresAt > now && invite.usedAt === null && invite.revokedAt === null;
}

async function lockTrip(tx: Prisma.TransactionClient, tripId: string) {
  const trips = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Trip" WHERE "id" = ${tripId} FOR UPDATE`;
  if (trips.length === 0) throw new HttpError(400, INVALID_INVITE);
}

async function activeOwner(tx: Prisma.TransactionClient, tripId: string, userId: string) {
  const member = await tx.tripMember.findUnique({ where: { tripId_userId: { tripId, userId } } });
  return member?.status === 'ACTIVE' && member.role === 'OWNER';
}

export async function issueInvite(tripId: string, userId: string) {
  return inTransaction(async (tx) => {
    await lockTrip(tx, tripId);
    if (!await activeOwner(tx, tripId, userId)) throw new HttpError(403, TRIP_ACCESS_DENIED);
    if (await tx.tripMember.count({ where: { tripId, status: 'ACTIVE' } }) >= 2) {
      throw new HttpError(409, 'Chuyến đi đã có đủ hai người đồng hành.');
    }
    const clientUrl = env.CLIENT_URL.replace(/\/$/, '');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60_000);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const inviteCode = generateInviteCode(6);
      // A conflicting hash must not abort the transaction or reuse another invitation.
      const { count } = await tx.tripInvite.createMany({
        data: { tripId, createdByUserId: userId, tokenHash: hashToken(inviteCode), expiresAt },
        skipDuplicates: true,
      });
      if (count === 1) return { inviteCode, inviteToken: inviteCode, inviteUrl: `${clientUrl}/join/${inviteCode}`, expiresAt };
    }
    throw new HttpError(503, 'Chưa tạo được mã mời. Vui lòng thử lại.');
  });
}

export async function previewInvite(token: string) {
  const normalized = normalizeInviteToken(token);
  if (!normalized) return { valid: false as const, message: INVALID_INVITE };
  const invite = await prisma.tripInvite.findUnique({ where: { tokenHash: hashToken(normalized) }, include: { trip: true, createdByUser: true } });
  if (!isValid(invite, new Date())) return { valid: false as const, message: INVALID_INVITE };
  const owner = await prisma.tripMember.findUnique({ where: { tripId_userId: { tripId: invite.tripId, userId: invite.createdByUserId } } });
  if (owner?.status !== 'ACTIVE' || owner.role !== 'OWNER') return { valid: false as const, message: INVALID_INVITE };
  return { valid: true as const, tripTitle: invite.trip.title, ownerName: invite.createdByUser.displayName, durationDays: invite.trip.durationDays };
}

export async function joinInvite(token: string, displayName: string, currentUser: User | null) {
  const normalized = normalizeInviteToken(token);
  if (!normalized) throw new HttpError(400, INVALID_INVITE);
  const tokenHash = hashToken(normalized);
  return inTransaction(async (tx) => {
    const candidate = await tx.tripInvite.findUnique({ where: { tokenHash } });
    if (!candidate) throw new HttpError(400, INVALID_INVITE);
    // Always take Trip before TripInvite locks; different invites cannot overfill a trip.
    await lockTrip(tx, candidate.tripId);
    const locked = await tx.$queryRaw<TripInvite[]>`SELECT * FROM "TripInvite" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
    const invite = locked[0] ?? null;
    const now = new Date();
    if (!isValid(invite, now) || !await activeOwner(tx, invite.tripId, invite.createdByUserId)) throw new HttpError(400, INVALID_INVITE);

    const existing = currentUser ? await tx.tripMember.findUnique({ where: { tripId_userId: { tripId: invite.tripId, userId: currentUser.id } } }) : null;
    if (existing && existing.status !== 'ACTIVE') throw new HttpError(403, 'Quyền truy cập chuyến đi của bạn đã bị thu hồi.');
    if (!existing && await tx.tripMember.count({ where: { tripId: invite.tripId, status: 'ACTIVE' } }) >= 2) {
      throw new HttpError(409, 'Chuyến đi đã có đủ hai người đồng hành.');
    }

    let userId = currentUser?.id;
    let sessionToken: string | undefined;
    if (!userId) {
      const user = await tx.user.create({ data: { displayName } });
      userId = user.id;
      sessionToken = await createSession(tx, userId);
    }
    const member = existing ?? await tx.tripMember.create({ data: { tripId: invite.tripId, userId, role: 'MEMBER', nickname: displayName, status: 'ACTIVE' } });
    await tx.tripInvite.update({ where: { id: invite.id }, data: { usedAt: now } });
    return { tripId: invite.tripId, memberId: member.id, sessionToken };
  });
}
