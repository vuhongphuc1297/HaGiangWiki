import { Router } from 'express';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { idempotency } from '../../middlewares/idempotency.middleware.js';
import { createPackingSchema, deletePackingSchema, packingTemplateSchema, updatePackingSchema } from './packing.validation.js';
import * as controller from './packing.controller.js';

export const packingRouter = Router({ mergeParams: true });
packingRouter.get('/', controller.list);
packingRouter.post('/', validateBody(createPackingSchema), idempotency, controller.create);
packingRouter.post('/templates', validateBody(packingTemplateSchema), idempotency, controller.templates);
packingRouter.patch('/:itemId', validateBody(updatePackingSchema), idempotency, controller.update);
packingRouter.delete('/:itemId', validateBody(deletePackingSchema), idempotency, controller.remove);
