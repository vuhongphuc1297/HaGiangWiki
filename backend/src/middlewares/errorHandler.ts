import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { HttpError, VersionConflictError } from '../utils/httpError.js';

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  // Reject the captured handler first so its database transaction rolls back.
  if (req.rejectIdempotency) {
    req.rejectIdempotency(error);
    return;
  }
  sendError(error, req, res, next);
};

// Also used after a deferred response transaction rolls back: Express may have
// already traversed its error-handler stack while rejecting that transaction.
export const sendError: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.destroyed || res.writableEnded) return;
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Dữ liệu không hợp lệ.', details: error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })) });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message, ...(error instanceof VersionConflictError ? { currentVersion: error.currentVersion } : {}) });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    res.status(409).json({ error: 'Dữ liệu đã tồn tại hoặc yêu cầu đã được xử lý.' });
    return;
  }
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    res.status(400).json({ error: 'Nội dung JSON không hợp lệ.' });
    return;
  }
  if (typeof error === 'object' && error !== null && 'status' in error && error.status === 413) {
    res.status(413).json({ error: 'Nội dung yêu cầu quá lớn.' });
    return;
  }
  // Do not log request URLs/bodies: invitation URLs and cookies contain bearer secrets.
  console.error('HaGiangWiki API: unexpected request error.', error instanceof Error ? error.name : 'UnknownError');
  res.status(500).json({ error: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' });
};
