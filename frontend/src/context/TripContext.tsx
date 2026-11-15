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
};
const TripContext = createContext<TripContextValue | null>(null);

function storedTrip(userId: string): string | null {
  try { return localStorage.getItem(`hagiangwiki:trip:${userId}`); } catch { return null; }
}

export function TripProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace>({ user: null, trips: [], trip: null, loading: true, syncing: false, sessionChecked: false, error: null, syncError: null, lastSyncedAt: null });
  const latest = useRef(workspace);
  const generation = useRef(0);
  const ongoing = useRef<{ tripId?: string; promise: Promise<void> } | null>(null);
  const update = useCallback((change: (current: Workspace) => Workspace) => {
    const next = change(latest.current);
    latest.current = next;
    setWorkspace(next);
  }, []);

  const load = useCallback(async (preferredId?: string, options: RefreshOptions = {}) => {
    const requestId = ++generation.current;
    const background = Boolean(options.background && latest.current.trip);
    update((current) => ({ ...current, loading: !background, syncing: background, error: null, syncError: null }));
    try {
      let me: AuthMe | null = null;
      try { me = await api<AuthMe>('/auth/me'); }
      catch (error) { if (!(error instanceof ApiError) || error.status !== 401) throw error; }
      if (requestId !== generation.current) return;
      const session = me;
      update((current) => {
        const retained = current.trip && (current.trip.readOnly || session?.trips.some((item) => item.id === current.trip?.id)) ? current.trip : null;
        return { ...current, user: session?.user ?? null, trips: session?.trips ?? [], sessionChecked: true, trip: retained, loading: !retained || !background, syncing: Boolean(retained && background) };
      });
      const selected = me?.trips.find((trip) => trip.id === (preferredId ?? storedTrip(me.user.id))) ?? me?.trips[0];
      const trip = await api<Trip>(`/trips/${encodeURIComponent(selected?.id ?? DEMO_TRIP_ID)}`);
      if (requestId !== generation.current) return;
      if (me && selected) {
        try { localStorage.setItem(`hagiangwiki:trip:${me.user.id}`, trip.id); } catch { /* Storage is optional. */ }
      }
      update(() => ({ user: me?.user ?? null, trips: me?.trips ?? [], trip, loading: false, syncing: false, sessionChecked: true, error: null, syncError: null, lastSyncedAt: Date.now() }));
    } catch (error) {
      if (requestId === generation.current) update((current) => {
        // Keep a usable snapshot on network/server failures, but respect an
        // explicit access denial even if membership changed between the reads.
        const denied = error instanceof ApiError && [401, 403, 404].includes(error.status);
        const retained = denied ? null : current.trip;
        return { ...current, trip: retained, loading: false, syncing: false, error: retained ? null : errorMessage(error), syncError: retained ? errorMessage(error) : null };
      });
    }
  }, [update]);

  const refresh = useCallback((preferredId?: string, options: RefreshOptions = {}) => {
    if (options.background && ongoing.current && ongoing.current.tripId === preferredId) return ongoing.current.promise;
    const entry = { tripId: preferredId, promise: load(preferredId, options) };
    ongoing.current = entry;
    void entry.promise.finally(() => { if (ongoing.current === entry) ongoing.current = null; });
    return entry.promise;
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

  useEffect(() => {
    void refresh();
    return () => { generation.current += 1; ongoing.current = null; };
  }, [refresh]);

  useEffect(() => attachReturnSync({ document, window, refresh: () => {
    const tripId = latest.current.trip?.id;
    if (tripId) void refresh(tripId, { background: true });
  } }), [refresh]);

  return <TripContext.Provider value={{ ...workspace, isDemo: workspace.trip?.readOnly === true, refresh, applyTrip }}>{children}</TripContext.Provider>;
}

export function useTrip() {
  const value = useContext(TripContext);
  if (!value) throw new Error('TripProvider is required.');
  return value;
}
