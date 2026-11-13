import { Router } from 'express';
import { idempotency } from '../../middlewares/idempotency.middleware.js';
import { stringParam, validateBody } from '../../middlewares/validate.middleware.js';
import { AUTH_REQUIRED, HttpError } from '../../utils/httpError.js';
import { createStopSchema, deleteStopQuerySchema, deleteStopSchema, reorderStopsSchema, updateStopSchema } from './stop.validation.js';
import { createStop, deleteStop, reorderStops, updateStop } from './stop.service.js';

export const stopRouter = Router({ mergeParams: true });
stopRouter.post('/', validateBody(createStopSchema), idempotency, async (req, res) => {
  if (!req.user || !req.tripMember) throw new HttpError(401, AUTH_REQUIRED);
  res.status(201).json(await createStop(req.tripMember.tripId, req.user.id, createStopSchema.parse(req.body), req.transaction));
});
// Keep this literal route before /:stopId so "reorder" is never treated as an ID.
stopRouter.patch('/reorder', validateBody(reorderStopsSchema), idempotency, async (req, res) => {
  if (!req.user || !req.tripMember) throw new HttpError(401, AUTH_REQUIRED);
  res.json(await reorderStops(req.tripMember.tripId, req.user.id, reorderStopsSchema.parse(req.body), req.transaction));
});
stopRouter.patch('/:stopId', validateBody(updateStopSchema), idempotency, async (req, res) => {
  if (!req.user || !req.tripMember) throw new HttpError(401, AUTH_REQUIRED);
  res.json(await updateStop(req.tripMember.tripId, req.user.id, stringParam(req, 'stopId'), updateStopSchema.parse(req.body), req.transaction));
});
stopRouter.delete('/:stopId', (req, _res, next) => {
  const body = deleteStopSchema.partial().parse(req.body ?? {});
  const query = deleteStopQuerySchema.partial().parse(req.query);
  if (body.version !== undefined && query.version !== undefined && body.version !== query.version) {
    throw new HttpError(400, 'Version trong body và query phải giống nhau.');
  }
  req.body = deleteStopSchema.parse({ version: body.version ?? query.version });
  next();
}, idempotency, async (req, res) => {
  if (!req.user || !req.tripMember) throw new HttpError(401, AUTH_REQUIRED);
  res.json(await deleteStop(req.tripMember.tripId, req.user.id, stringParam(req, 'stopId'), deleteStopSchema.parse(req.body), req.transaction));
});
