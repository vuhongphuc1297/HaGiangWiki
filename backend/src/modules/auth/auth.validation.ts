import { z } from 'zod';

export const displayNameSchema = z.object({ displayName: z.string().trim().min(1).max(50) });
export type DisplayNameInput = z.infer<typeof displayNameSchema>;
