import { z } from 'zod';

const memberId = z.string().trim().min(1).max(200);
const maxDatabaseAmount = 9_223_372_036_854_775_807n;
// Normalize to decimal strings, keeping parsed request bodies JSON-safe for idempotency hashing.
const amount = z.union([
  z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).transform(String),
  z.string().max(19).regex(/^[1-9]\d*$/),
]).refine((value) => value.length <= 19 && /^[1-9]\d*$/.test(value) && BigInt(value) <= maxDatabaseAmount, 'Số tiền phải là số nguyên dương trong giới hạn lưu trữ.');
const version = z.number().int().min(1).max(2_147_483_647);
const expenseFields = {
  title: z.string().trim().min(1).max(160),
  amount,
  payerMemberId: memberId,
  splitType: z.enum(['EQUAL', 'FOR_OTHER', 'PERSONAL']),
  stopId: memberId.nullable().optional(),
  category: z.string().trim().min(1).max(60).nullable().optional(),
};

export const createExpenseSchema = z.object({ ...expenseFields, splitType: expenseFields.splitType.default('EQUAL') });
export const updateExpenseSchema = z.object(expenseFields).partial().extend({ version });
export const deleteExpenseSchema = z.object({ version });
export const deleteExpenseQuerySchema = z.object({
  version: z.string().regex(/^[1-9]\d*$/).pipe(z.coerce.number<string>().pipe(version)),
});
export const createSettlementSchema = z.object({
  fromMemberId: memberId,
  toMemberId: memberId,
  amount,
  notes: z.string().trim().max(2000).nullable().optional(),
}).refine((input) => input.fromMemberId !== input.toMemberId, {
  message: 'Người chuyển và người nhận phải khác nhau.', path: ['toMemberId'],
});
export const expenseIdempotencyKeySchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  'Idempotency-Key phải là UUIDv4.',
);

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type DeleteExpenseInput = z.infer<typeof deleteExpenseSchema>;
export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;
