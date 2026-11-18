import type { Request, RequestHandler } from 'express';
import { stringParam } from '../../middlewares/validate.middleware.js';
import { AUTH_REQUIRED, HttpError } from '../../utils/httpError.js';
import * as service from './expense.service.js';
import { createExpenseSchema, createSettlementSchema, deleteExpenseSchema, expenseIdempotencyKeySchema, updateExpenseSchema } from './expense.validation.js';

function context(req: Request) {
  if (!req.user || !req.tripMember) throw new HttpError(401, AUTH_REQUIRED);
  return { tripId: req.tripMember.tripId, userId: req.user.id };
}

export const list: RequestHandler = async (req, res) => {
  const { tripId, userId } = context(req);
  res.json(await service.listExpenses(tripId, userId));
};

export const create: RequestHandler = async (req, res) => {
  const { tripId, userId } = context(req);
  res.status(201).json(await service.createExpense(tripId, userId, createExpenseSchema.parse(req.body), expenseIdempotencyKeySchema.parse(req.get('Idempotency-Key')), req.transaction));
};

export const update: RequestHandler = async (req, res) => {
  const { tripId, userId } = context(req);
  res.json(await service.updateExpense(tripId, userId, stringParam(req, 'expenseId'), updateExpenseSchema.parse(req.body), req.transaction));
};

export const remove: RequestHandler = async (req, res) => {
  const { tripId, userId } = context(req);
  res.json(await service.deleteExpense(tripId, userId, stringParam(req, 'expenseId'), deleteExpenseSchema.parse(req.body), req.transaction));
};

export const transfer: RequestHandler = async (req, res) => {
  const { tripId, userId } = context(req);
  res.status(201).json(await service.createSettlement(tripId, userId, createSettlementSchema.parse(req.body), expenseIdempotencyKeySchema.parse(req.get('Idempotency-Key')), req.transaction));
};

export const removeTransfer: RequestHandler = async (req, res) => {
  const { tripId, userId } = context(req);
  res.json(await service.deleteSettlement(tripId, userId, stringParam(req, 'settlementId'), req.transaction));
};
