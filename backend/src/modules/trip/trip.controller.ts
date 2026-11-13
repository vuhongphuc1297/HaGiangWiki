import type { RequestHandler } from 'express';
import { AUTH_REQUIRED, HttpError } from '../../utils/httpError.js';
import { stringParam } from '../../middlewares/validate.middleware.js';
import { createTripSchema, updateTripSchema } from './trip.validation.js';
import { createTrip, getTrip, updateTrip } from './trip.service.js';

export const create: RequestHandler = async (req, res) => {
  if (!req.user) throw new HttpError(401, AUTH_REQUIRED);
  const trip = await createTrip(createTripSchema.parse(req.body), req.user, req.transaction);
  res.status(201).json(trip);
};

export const detail: RequestHandler = async (req, res) => {
  if (!req.user) throw new HttpError(401, AUTH_REQUIRED);
  res.json(await getTrip(stringParam(req, 'tripId'), req.user.id));
};

export const update: RequestHandler = async (req, res) => {
  if (!req.user || !req.tripMember) throw new HttpError(401, AUTH_REQUIRED);
  res.json(await updateTrip(req.tripMember.tripId, req.user.id, updateTripSchema.parse(req.body), req.transaction));
};
