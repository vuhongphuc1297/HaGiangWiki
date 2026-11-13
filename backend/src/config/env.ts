import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { z } from 'zod';

// Resolve from this module so both workspace scripts and compiled code find .env.
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().url(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const details = result.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  throw new Error(`Cấu hình môi trường chưa hợp lệ:\n${details}`);
}

export const env = result.data;
