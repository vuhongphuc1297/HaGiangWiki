import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

const globalForPrisma = globalThis as unknown as {
  hagiangWikiPrisma?: PrismaClient;
};

export const prisma = globalForPrisma.hagiangWikiPrisma ?? new PrismaClient({
  datasourceUrl: env.DATABASE_URL,
  log: ['warn', 'error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.hagiangWikiPrisma = prisma;
}
