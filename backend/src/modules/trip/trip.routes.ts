import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { tripAccess, requireOwner } from '../../middlewares/tripAccess.middleware.js';
import { idempotency } from '../../middlewares/idempotency.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { create, detail, update } from './trip.controller.js';
import { createTripSchema, updateTripSchema } from './trip.validation.js';
import { createInvite } from '../invite/invite.controller.js';
import { stopRouter } from '../stop/stop.routes.js';

export const tripRouter = Router();
tripRouter.use(requireAuth);
tripRouter.post('/', validateBody(createTripSchema), idempotency, create);
tripRouter.get('/:tripId', tripAccess, detail);
tripRouter.patch('/:tripId', tripAccess, requireOwner, validateBody(updateTripSchema), idempotency, update);
tripRouter.post('/:tripId/invites', tripAccess, requireOwner, createInvite);
tripRouter.use('/:tripId/stops', tripAccess, stopRouter);
