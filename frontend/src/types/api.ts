export const DEMO_TRIP_ID = 'demo_trip_hagiang_20261120';
export const ROAD_IMAGE = '/images/pexels-ben-tran-1629957976-34101592.jpg';

export type User = { id: string; displayName: string };
export type TripMember = {
  id: string; userId?: string; nickname: string; displayName: string;
  role: 'OWNER' | 'MEMBER'; status: 'ACTIVE' | 'REVOKED';
};
export type Stop = {
  id: string; tripId: string; name: string; category: string | null;
  day: number; orderIndex: number; arriveTime: string | null; leaveTime: string | null;
  latitude: number | null; longitude: number | null; estimatedCost: string;
  notes: string | null; version: number;
};
export type Trip = {
  id: string; title: string; startDate: string; durationDays: number;
  vehicle: 'XE_MAY' | 'O_TO' | 'MAY_BAY'; budget: string; timezone: string;
  version: number; members: TripMember[]; stops: Stop[]; readOnly?: boolean;
};
export type TripSummary = Omit<Trip, 'members' | 'stops'> & {
  membership: { id: string; nickname: string; role: string; status: string };
};
export type TripUpdate = Trip & { movedStopsCount: number };
export type AuthMe = { user: User; trips: TripSummary[] };
export type Invite = { inviteToken: string; inviteUrl: string; expiresAt: string };
export type InvitePreview =
  | { valid: true; tripTitle: string; ownerName: string; durationDays: number }
  | { valid: false; message: string };

export type ExpenseSplitType = 'EQUAL' | 'FOR_OTHER' | 'PERSONAL';
export type Expense = {
  id: string; tripId: string; title: string; amount: string; payerMemberId: string;
  splitType: ExpenseSplitType; category: string | null; stopId: string | null;
  version: number; deletedAt: string | null; createdAt: string; updatedAt: string;
};
export type SettlementTransfer = {
  id: string; tripId: string; fromMemberId: string; toMemberId: string; amount: string;
  notes: string | null; deletedAt: string | null; transferDate: string; createdAt: string;
};
export type ExpenseSummary = {
  totalSpent: string; budget: string; remainingBudget: string; spentByMember: Record<string, string>;
  settlement: {
    debtorMemberId: string | null; creditorMemberId: string | null; netAmount: string; isSettled: boolean;
  };
};
export type ExpenseLedger = { expenses: Expense[]; settlements: SettlementTransfer[]; summary: ExpenseSummary };
