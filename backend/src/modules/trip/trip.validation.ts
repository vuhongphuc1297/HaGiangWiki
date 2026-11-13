import { z } from 'zod';

export const createTripSchema = z.object({
  title: z.string().trim().min(1).max(200),
  startDate: z.string().date(),
  durationDays: z.number().int().min(1).max(30).default(3),
  vehicle: z.enum(['XE_MAY', 'O_TO', 'MAY_BAY']).default('XE_MAY'),
  budget: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  templateId: z.literal('demo_trip_hagiang_20261120').optional(),
});
export const updateTripSchema = createTripSchema.omit({ templateId: true }).partial().extend({
  // Overrides remove creation defaults from partial PATCH payloads.
  durationDays: z.number().int().min(1).max(30).optional(),
  vehicle: z.enum(['XE_MAY', 'O_TO', 'MAY_BAY']).optional(),
  version: z.number().int().min(1),
});
export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
