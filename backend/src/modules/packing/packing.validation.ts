import { z } from 'zod';

const title = z.string().trim().min(1).max(160);
const version = z.number().int().min(1).max(2_147_483_647).optional();

export const createPackingSchema = z.object({ title });
export const updatePackingSchema = z.object({ title: title.optional(), isPacked: z.boolean().optional(), version })
  .refine((input) => input.title !== undefined || input.isPacked !== undefined, 'Hãy gửi tên món đồ hoặc trạng thái đã xếp.');
export const deletePackingSchema = z.object({ version }).default({});
export const packingTemplateSchema = z.object({}).default({});

export type CreatePackingInput = z.infer<typeof createPackingSchema>;
export type UpdatePackingInput = z.infer<typeof updatePackingSchema>;
export type DeletePackingInput = z.infer<typeof deletePackingSchema>;
