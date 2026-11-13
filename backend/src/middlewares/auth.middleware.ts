import type { RequestHandler } from 'express';
import { prisma } from '../config/database.js';
import { hashToken } from '../utils/crypto.js';
import { AUTH_REQUIRED } from '../utils/httpError.js';

export const attachAuth: RequestHandler = async (req, _res, next) => {
  req.user = null;
  req.session = null;
  const token: unknown = req.cookies?.session_token;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
    next();
    return;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  const now = new Date();
  if (!session || session.revokedAt !== null || session.expiresAt <= now) {
    next();
    return;
  }

  if (now.getTime() - session.lastUsedAt.getTime() > 5 * 60_000) {
    await prisma.session.updateMany({
      where: { id: session.id, revokedAt: null, expiresAt: { gt: now }, lastUsedAt: { lt: new Date(now.getTime() - 5 * 60_000) } },
      data: { lastUsedAt: now },
    });
  }
  const { user, ...sessionData } = session;
  req.user = user;
  req.session = sessionData;
  next();
};

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ error: AUTH_REQUIRED });
    return;
  }
  next();
};
