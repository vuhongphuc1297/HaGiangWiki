import { z } from 'zod';

const title = z.string().trim().min(1).max(160);
const categoryId = z.string().trim().min(1).max(200).nullish();
const version = z.number().int().min(1).max(2_147_483_647).optional();

export const createCategorySchema = z.object({
  name: z.string().transform((name) => name.normalize('NFC').trim().replace(/\s+/g, ' ')).pipe(z.string().min(1).max(60)),
});
export const createPackingSchema = z.object({ title, categoryId });
export const updatePackingSchema = z.object({ title: title.optional(), isPacked: z.boolean().optional(), version, categoryId })
  .refine((input) => input.title !== undefined || input.isPacked !== undefined || input.categoryId !== undefined, 'Hãy gửi tên món đồ, danh mục hoặc trạng thái đã xếp.');
export const deletePackingSchema = z.object({ version }).default({});
export const packingTemplateSchema = z.object({}).default({});

export type CreatePackingInput = z.infer<typeof createPackingSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdatePackingInput = z.infer<typeof updatePackingSchema>;
export type DeletePackingInput = z.infer<typeof deletePackingSchema>;
