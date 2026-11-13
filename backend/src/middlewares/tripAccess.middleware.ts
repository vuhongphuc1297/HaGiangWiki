import type { RequestHandler } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { AUTH_REQUIRED, TRIP_ACCESS_DENIED } from '../utils/httpError.js';

export const tripAccess: RequestHandler = async (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ error: AUTH_REQUIRED });
    return;
  }
  const body: unknown = req.body;
  const bodyTripId = typeof body === 'object' && body !== null && 'tripId' in body ? body.tripId : undefined;
  const tripId = z.string().min(1).max(200).parse(req.params.tripId ?? bodyTripId);
  const member = await prisma.tripMember.findUnique({ where: { tripId_userId: { tripId, userId: req.user.id } } });
  if (!member || member.status !== 'ACTIVE') {
    res.status(403).json({ error: TRIP_ACCESS_DENIED });
    return;
  }
  req.tripMember = member;
  next();
};

export const requireOwner: RequestHandler = (req, res, next) => {
  if (req.tripMember?.role !== 'OWNER' || req.tripMember.status !== 'ACTIVE') {
    res.status(403).json({ error: 'Chỉ chủ chuyến đi mới có thể thực hiện thao tác này.' });
    return;
  }
  next();
};
