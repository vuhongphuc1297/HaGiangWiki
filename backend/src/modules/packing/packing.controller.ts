import type { Request, RequestHandler } from 'express';
import { stringParam } from '../../middlewares/validate.middleware.js';
import { AUTH_REQUIRED, HttpError } from '../../utils/httpError.js';
import { createCategorySchema, createPackingSchema, deletePackingSchema, updatePackingSchema } from './packing.validation.js';
import * as service from './packing.service.js';

function context(req: Request) {
  if (!req.user || !req.tripMember) throw new HttpError(401, AUTH_REQUIRED);
  // The service resolves membership from this authenticated user, never from body/query ownership fields.
  return { tripId: req.tripMember.tripId, userId: req.user.id };
}
export const list: RequestHandler = async (req, res) => {
  const { tripId, userId } = context(req);
  res.json(await service.listPacking(tripId, userId));
};
export const create: RequestHandler = async (req, res) => {
  const { tripId, userId } = context(req);
  res.status(201).json(await service.createPacking(tripId, userId, createPackingSchema.parse(req.body), req.transaction));
};
export const createCategory: RequestHandler = async (req, res) => {
  const { tripId, userId } = context(req);
  const category = await service.createPackingCategory(tripId, userId, createCategorySchema.parse(req.body), req.transaction);
  res.status(201).json({ category });
};
export const update: RequestHandler = async (req, res) => {
  const { tripId, userId } = context(req);
  res.json(await service.updatePacking(tripId, userId, stringParam(req, 'itemId'), updatePackingSchema.parse(req.body), req.transaction));
};
export const remove: RequestHandler = async (req, res) => {
  const { tripId, userId } = context(req);
  res.json(await service.deletePacking(tripId, userId, stringParam(req, 'itemId'), deletePackingSchema.parse(req.body), req.transaction));
};
export const templates: RequestHandler = async (req, res) => {
  const { tripId, userId } = context(req);
  res.json(await service.addPackingTemplate(tripId, userId, req.transaction));
};
