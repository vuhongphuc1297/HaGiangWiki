import type { Prisma } from '@prisma/client';

// Call only after locking the parent Trip for the whole transaction.
export async function nextStopOrder(tx: Prisma.TransactionClient, tripId: string, day: number) {
  const result = await tx.stop.aggregate({ where: { tripId, day, deletedAt: null }, _max: { orderIndex: true } });
  return (result._max.orderIndex ?? 0) + 1;
}

export async function compactStopOrder(tx: Prisma.TransactionClient, tripId: string, day: number) {
  const stops = await tx.stop.findMany({
    where: { tripId, day, deletedAt: null },
    orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
    select: { id: true, orderIndex: true },
  });
  for (const [index, stop] of stops.entries()) {
    if (stop.orderIndex !== index + 1) {
      await tx.stop.update({ where: { id: stop.id }, data: { orderIndex: index + 1, version: { increment: 1 } } });
    }
  }
}
