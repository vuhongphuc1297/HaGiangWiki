export const DEMO_TRIP_ID = 'demo_trip_hagiang_20261120';
export const ROAD_IMAGE = '/images/ha-giang-road.png';

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
export type AuthMe = { user: User; trips: TripSummary[] };
export type Invite = { inviteToken: string; inviteUrl: string; expiresAt: string };
export type InvitePreview =
  | { valid: true; tripTitle: string; ownerName: string; durationDays: number }
  | { valid: false; message: string };
