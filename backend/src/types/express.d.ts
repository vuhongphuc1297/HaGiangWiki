import type { Prisma, Session, TripMember, User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user: User | null;
      session: Session | null;
      tripMember?: TripMember;
      transaction?: Prisma.TransactionClient;
      rejectIdempotency?: (error: unknown) => void;
    }
  }
}

export {};
