import type { Request, RequestHandler, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { hashToken } from '../utils/crypto.js';
import { toJsonValue } from '../utils/bigint.js';
import type { JsonValue } from '../utils/bigint.js';
import { AUTH_REQUIRED, HttpError, TRIP_ACCESS_DENIED } from '../utils/httpError.js';
import { sendError } from './errorHandler.js';

type CapturedResponse = { status: number; body: JsonValue; cacheHit?: boolean };

class ResponseRollback extends Error {
  constructor(public readonly response: CapturedResponse) {
    super('Rollback unsuccessful response.');
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const fields = Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    return `{${fields.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function captureJson(req: Request, res: Response, next: NextFunction): Promise<CapturedResponse> {
  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout;
    const disconnected = () => finish(new HttpError(408, 'Kết nối đã đóng trước khi hoàn tất yêu cầu.'));
    const finish = (error: unknown, response?: CapturedResponse) => {
      clearTimeout(timer);
      res.off('close', disconnected);
      if (error) reject(error);
      else resolve(response!);
    };
    timer = setTimeout(() => finish(new HttpError(503, 'Yêu cầu xử lý quá lâu. Hãy thử lại với cùng Idempotency-Key.')), 10_000);
    req.rejectIdempotency = (error) => finish(error);
    res.once('close', disconnected);
    res.json = function json(body: unknown) {
      try {
        finish(null, { status: this.statusCode, body: toJsonValue(body) });
      } catch (error) {
        finish(error);
      }
      return this;
    };
    try {
      next();
    } catch (error) {
      finish(error);
    }
  });
}

export const idempotency: RequestHandler = async (req, res, next) => {
  const header = req.get('Idempotency-Key');
  if (header === undefined) {
    next();
    return;
  }
  if (!req.user) throw new HttpError(401, AUTH_REQUIRED);
  const key = z.string().regex(/^[A-Za-z0-9._:-]{1,200}$/, 'Idempotency-Key phải có 1–200 ký tự chữ, số, dấu chấm, gạch dưới, hai chấm hoặc gạch nối.').parse(header);
  const userId = req.user.id;
  const tripId = req.tripMember?.tripId;
  const creatingTrip = req.method === 'POST' && req.baseUrl === '/api/trips' && req.path === '/';
  if (!tripId && !creatingTrip) throw new HttpError(400, 'Chưa xác định được chuyến đi cho Idempotency-Key.');

  // U+241F cannot occur in an accepted HTTP key, separating creation from trip-scoped keys.
  const storedKey = creatingTrip ? `create-trip\u241f${key}` : key;
  const lockScope = creatingTrip ? `create-trip:${userId}:${key}` : `trip:${tripId}:${key}`;
  const requestHash = hashToken(`${req.method}\n${req.originalUrl}\n${canonicalJson(req.body)}`);
  const originalJson = res.json;

  try {
    const result = await prisma.$transaction(async (tx): Promise<CapturedResponse> => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockScope}, 0))::text AS locked`;
      const existing = creatingTrip
        ? await tx.idempotencyRecord.findFirst({ where: { userId, key: storedKey }, orderBy: { createdAt: 'desc' } })
        : await tx.idempotencyRecord.findUnique({ where: { tripId_key: { tripId: tripId!, key: storedKey } } });
      const now = new Date();
      if (existing && existing.expiresAt > now) {
        if (existing.userId !== userId || existing.requestHash !== requestHash) {
          throw new HttpError(409, 'Idempotency-Key đã được sử dụng cho một yêu cầu khác.');
        }
        const membership = await tx.tripMember.findUnique({ where: { tripId_userId: { tripId: existing.tripId, userId } } });
        if (membership?.status !== 'ACTIVE') throw new HttpError(403, TRIP_ACCESS_DENIED);
        return { status: existing.responseStatus, body: toJsonValue(existing.responseBody), cacheHit: true };
      }
      if (existing) await tx.idempotencyRecord.delete({ where: { id: existing.id } });

      req.transaction = tx;
      const captured = await captureJson(req, res, next);
      if (captured.status < 200 || captured.status >= 300) throw new ResponseRollback(captured);
      const responseTripId = creatingTrip && captured.body && typeof captured.body === 'object' && !Array.isArray(captured.body)
        ? captured.body.id : tripId;
      if (typeof responseTripId !== 'string') throw new Error('Missing trip ID in idempotent response.');
      await tx.idempotencyRecord.create({ data: {
        tripId: responseTripId, userId, key: storedKey, requestHash,
        responseStatus: captured.status,
        responseBody: captured.body === null ? Prisma.JsonNull : captured.body,
        expiresAt: new Date(now.getTime() + 24 * 60 * 60_000),
      } });
      return captured;
    }, { maxWait: 10_000, timeout: 20_000 });

    res.json = originalJson;
    delete req.transaction;
    delete req.rejectIdempotency;
    res.setHeader('X-Cache', result.cacheHit ? 'HIT' : 'MISS');
    res.status(result.status).json(result.body);
  } catch (error) {
    res.json = originalJson;
    delete req.transaction;
    delete req.rejectIdempotency;
    if (error instanceof ResponseRollback) {
      res.status(error.response.status).json(error.response.body);
    } else {
      sendError(error, req, res, next);
    }
  }
};
