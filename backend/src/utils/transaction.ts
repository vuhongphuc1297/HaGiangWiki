import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';

export function inTransaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
  transaction?: Prisma.TransactionClient,
): Promise<T> {
  return transaction ? work(transaction) : prisma.$transaction(work, { maxWait: 5_000, timeout: 15_000 });
}
