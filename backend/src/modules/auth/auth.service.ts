import type { CookieOptions } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { generateRandomToken, hashToken } from '../../utils/crypto.js';
import { inTransaction } from '../../utils/transaction.js';

export const SESSION_COOKIE = 'session_token';
export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60_000;

export function sessionCookieOptions(): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' };
}

export async function createSession(tx: Prisma.TransactionClient, userId: string) {
  const token = generateRandomToken();
  const now = new Date();
  await tx.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS), lastUsedAt: now } });
  return token;
}

export async function registerAnonymous(displayName: string) {
  return inTransaction(async (tx) => {
    const user = await tx.user.create({ data: { displayName } });
    const token = await createSession(tx, user.id);
    return { user, token };
  });
}

export async function currentUser(userId: string) {
  const memberships = await prisma.tripMember.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { trip: true },
    orderBy: { joinedAt: 'desc' },
  });
  return memberships.map(({ trip, ...membership }) => ({ ...trip, membership }));
}

export async function logoutSession(sessionId: string | undefined) {
  if (sessionId) await prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}
