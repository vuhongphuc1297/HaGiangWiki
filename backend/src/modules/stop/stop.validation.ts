import { z } from 'zod';

const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional();

const stopFields = {
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(60).nullable().optional(),
  day: z.number().int().min(0).max(30),
  arriveTime: localTime,
  leaveTime: localTime,
  estimatedCost: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  notes: z.string().trim().max(2000).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
};

export const createStopSchema = z.object({
  ...stopFields,
  day: stopFields.day.default(0),
  estimatedCost: stopFields.estimatedCost.default(0),
}).refine((input) => (input.latitude == null) === (input.longitude == null), {
  message: 'Vĩ độ và kinh độ phải cùng có giá trị hoặc cùng để trống.', path: ['latitude'],
});

export const updateStopSchema = z.object(stopFields).partial().extend({
  version: z.number().int().min(1),
});

export const deleteStopSchema = z.object({ version: z.number().int().min(1) });
export const deleteStopQuerySchema = z.object({ version: z.string().regex(/^[1-9]\d*$/).pipe(z.coerce.number<string>().int().min(1)) });
export const reorderStopsSchema = z.object({
  day: z.number().int().min(0),
  stopIds: z.array(z.string().min(1)).min(1).refine((ids) => new Set(ids).size === ids.length, 'Danh sách điểm dừng không được trùng lặp.'),
});

export type CreateStopInput = z.infer<typeof createStopSchema>;
export type UpdateStopInput = z.infer<typeof updateStopSchema>;
export type DeleteStopInput = z.infer<typeof deleteStopSchema>;
export type ReorderStopsInput = z.infer<typeof reorderStopsSchema>;
