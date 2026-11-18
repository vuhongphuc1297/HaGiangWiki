import { Router } from 'express';
import type { RequestHandler } from 'express';
import { idempotency } from '../../middlewares/idempotency.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { HttpError } from '../../utils/httpError.js';
import * as controller from './expense.controller.js';
import { createExpenseSchema, createSettlementSchema, deleteExpenseQuerySchema, deleteExpenseSchema, expenseIdempotencyKeySchema, updateExpenseSchema } from './expense.validation.js';

function validateKey(required = false): RequestHandler {
  return (req, _res, next) => {
    const key = req.get('Idempotency-Key');
    if (required || key !== undefined) expenseIdempotencyKeySchema.parse(key);
    next();
  };
}

const validateDeleteVersion: RequestHandler = (req, _res, next) => {
  const body = deleteExpenseSchema.partial().parse(req.body ?? {});
  const query = deleteExpenseQuerySchema.partial().parse(req.query);
  if (body.version !== undefined && query.version !== undefined && body.version !== query.version) {
    throw new HttpError(400, 'Version trong body và query phải giống nhau.');
  }
  req.body = deleteExpenseSchema.parse({ version: body.version ?? query.version });
  next();
};

export const expenseRouter = Router({ mergeParams: true });
expenseRouter.get('/', controller.list);
expenseRouter.post('/', validateBody(createExpenseSchema), validateKey(true), idempotency, controller.create);
expenseRouter.patch('/:expenseId', validateBody(updateExpenseSchema), validateKey(), idempotency, controller.update);
expenseRouter.delete('/:expenseId', validateDeleteVersion, validateKey(), idempotency, controller.remove);

export const settlementRouter = Router({ mergeParams: true });
settlementRouter.post('/', validateBody(createSettlementSchema), validateKey(true), idempotency, controller.transfer);
settlementRouter.delete('/:settlementId', validateKey(), idempotency, controller.removeTransfer);
