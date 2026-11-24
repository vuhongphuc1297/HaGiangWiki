import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api, ApiError, errorMessage } from '../services/api';
import { DEMO_TRIP_ID } from '../types/api';
import type { AuthMe, Trip, TripSummary, User } from '../types/api';
import { attachReturnSync } from './returnSync';

type Workspace = {
  user: User | null; trips: TripSummary[]; trip: Trip | null; loading: boolean; syncing: boolean;
  sessionChecked: boolean; error: string | null; syncError: string | null; lastSyncedAt: number | null;
};
type RefreshOptions = { background?: boolean };
type TripContextValue = Workspace & {
  isDemo: boolean; refresh: (tripId?: string, options?: RefreshOptions) => Promise<void>;
  applyTrip: (trip: Trip) => void;
  deleteTrip?: (tripId: string) => Promise<void>;
};
const TripContext = createContext<TripContextValue | null>(null);
const initialWorkspace: Workspace = {
  user: null, trips: [], trip: null, loading: true, syncing: false,
  sessionChecked: false, error: null, syncError: null, lastSyncedAt: null,
};

function tripStorageKey(userId: string) {
  return `hagiangwiki:trip:${userId}`;
}

function storedTrip(userId: string): string | null {
  try { return localStorage.getItem(tripStorageKey(userId)); } catch { return null; }
}

export function TripProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const latest = useRef(workspace);
  const generation = useRef(0);
  const ongoing = useRef<Promise<void> | null>(null);
  const update = useCallback((change: (current: Workspace) => Workspace) => {
    const next = change(latest.current);
    latest.current = next;
    setWorkspace(next);
  }, []);

  const load = useCallback(async (preferredId?: string, options: RefreshOptions = {}) => {
    const requestId = ++generation.current;
    const background = Boolean(options.background && latest.current.trip);
    let requestedTripId: string | undefined;
    update((current) => ({ ...current, loading: !background, syncing: background, error: null, syncError: null }));
    try {
      let me: AuthMe | null = null;
      try { me = await api<AuthMe>('/auth/me'); }
      catch (error) { if (!(error instanceof ApiError) || error.status !== 401) throw error; }
      if (requestId !== generation.current) return;
      const user = me?.user ?? null;
      const trips = me?.trips.filter((item) => item.id !== DEMO_TRIP_ID && item.membership.status === 'ACTIVE') ?? [];
      const recentId = user ? storedTrip(user.id) : null;
      const selected = trips.find((item) => item.id === preferredId) ?? trips.find((item) => item.id === recentId) ?? trips[0];
      update((current) => {
        const retained = current.user?.id === user?.id && current.trip?.id === selected?.id ? current.trip : null;
        return {
          ...current, user, trips, sessionChecked: true, trip: retained,
          loading: Boolean(selected) && (!retained || !background), syncing: Boolean(retained && background),
          lastSyncedAt: retained ? current.lastSyncedAt : null,
        };
      });
      if (!user || !selected) return;
      requestedTripId = selected.id;
      const trip = await api<Trip>(`/trips/${encodeURIComponent(selected.id)}`);
      if (requestId !== generation.current) return;
      if (trip.id !== selected.id || trip.readOnly || !trip.members.some((member) => member.userId === user.id && member.status === 'ACTIVE')) {
        throw new ApiError('Bạn chưa có quyền truy cập chuyến đi này.', 403);
      }
      try { localStorage.setItem(tripStorageKey(user.id), trip.id); } catch { /* Storage is optional. */ }
      update(() => ({ user, trips, trip, loading: false, syncing: false, sessionChecked: true, error: null, syncError: null, lastSyncedAt: Date.now() }));
    } catch (error) {
      if (requestId === generation.current) update((current) => {
        // Keep a usable snapshot on network/server failures, but respect an
        // explicit access denial even if membership changed between the reads.
        const denied = error instanceof ApiError && [401, 403, 404].includes(error.status);
        const retained = denied ? null : current.trip;
        const signedOut = error instanceof ApiError && error.status === 401;
        return {
          ...current,
          user: signedOut ? null : current.user,
          trips: signedOut ? [] : denied ? current.trips.filter((item) => item.id !== requestedTripId) : current.trips,
          trip: retained, loading: false, syncing: false, lastSyncedAt: retained ? current.lastSyncedAt : null,
          error: retained ? null : errorMessage(error), syncError: retained ? errorMessage(error) : null,
        };
      });
    }
  }, [update]);

  const refresh = useCallback((preferredId?: string, options: RefreshOptions = {}) => {
    if (options.background && ongoing.current) return ongoing.current;
    const request = load(preferredId, options);
    ongoing.current = request;
    void request.finally(() => { if (ongoing.current === request) ongoing.current = null; });
    return request;
  }, [load]);

  const applyTrip = useCallback((trip: Trip) => {
    if (latest.current.trip?.id !== trip.id) return;
    // A PATCH response is newer than any read started before that commit.
    generation.current += 1;
    ongoing.current = null;
    update((current) => ({ ...current, trip, loading: false, syncing: false, error: null, syncError: null, lastSyncedAt: Date.now(),
      trips: current.trips.map((summary) => summary.id === trip.id ? {
        ...summary, title: trip.title, startDate: trip.startDate, durationDays: trip.durationDays,
        vehicle: trip.vehicle, budget: trip.budget, timezone: trip.timezone, version: trip.version,
      } : summary),
    }));
  }, [update]);

  const deleteTrip = useCallback(async (tripId: string) => {
    const user = latest.current.user;
    if (!user) throw new Error('Yêu cầu đăng nhập hoặc phiên làm việc hợp lệ.');
    await api<{ success: true; deletedTripId: string }>(`/trips/${encodeURIComponent(tripId)}`, { method: 'DELETE' });

    if (storedTrip(user.id) === tripId) {
      try { localStorage.removeItem(tripStorageKey(user.id)); } catch { /* Storage is optional. */ }
    }
    if (latest.current.user?.id !== user.id) return;

    // Discard the deleted snapshot before refreshing so a failed read cannot restore it.
    update((current) => {
      const trips = current.trips.filter((trip) => trip.id !== tripId);
      if (current.trip?.id !== tripId) return { ...current, trips };
      return { ...current, trips, trip: null, loading: true, lastSyncedAt: null };
    });
    await refresh(latest.current.trip?.id);
  }, [refresh, update]);

  useEffect(() => {
    void refresh();
    return () => { generation.current += 1; ongoing.current = null; };
  }, [refresh]);

  useEffect(() => attachReturnSync({ document, window, refresh: () => {
    void refresh(latest.current.trip?.id, { background: true });
  } }), [refresh]);

  return <TripContext.Provider value={{ ...workspace, isDemo: false, refresh, applyTrip, deleteTrip }}>{children}</TripContext.Provider>;
}

export function DemoTripProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState({ ...initialWorkspace, sessionChecked: true });
  const pending = useRef<AbortController | null>(null);
  const refresh = useCallback(async (_tripId?: string, options: RefreshOptions = {}) => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setWorkspace((current) => ({
      ...current, loading: !current.trip, syncing: Boolean(current.trip && options.background), error: null, syncError: null,
    }));
    try {
      const trip = await api<Trip>(`/trips/${DEMO_TRIP_ID}`, { signal: controller.signal });
      if (trip.id !== DEMO_TRIP_ID || !trip.readOnly) throw new Error('Lịch trình tham khảo hiện chưa khả dụng.');
      if (!controller.signal.aborted) {
        setWorkspace((current) => ({
          ...current, trip, loading: false, syncing: false, lastSyncedAt: Date.now(),
        }));
      }
    } catch (reason) {
      if (!controller.signal.aborted) {
        setWorkspace((current) => ({
          ...current, loading: false, syncing: false,
          error: current.trip ? null : errorMessage(reason), syncError: current.trip ? errorMessage(reason) : null,
        }));
      }
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => pending.current?.abort();
  }, [refresh]);

  return <TripContext.Provider value={{ ...workspace, isDemo: true, refresh, applyTrip: () => {} }}>{children}</TripContext.Provider>;
}

export function useTrip() {
  const value = useContext(TripContext);
  if (!value) throw new Error('TripProvider is required.');
  return value;
}
