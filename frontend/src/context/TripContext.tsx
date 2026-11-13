import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api, ApiError, errorMessage } from '../services/api';
import { DEMO_TRIP_ID } from '../types/api';
import type { AuthMe, Trip, TripSummary, User } from '../types/api';

type Workspace = { user: User | null; trips: TripSummary[]; trip: Trip | null; loading: boolean; sessionChecked: boolean; error: string | null };
type TripContextValue = Workspace & { isDemo: boolean; refresh: (tripId?: string) => Promise<void> };
const TripContext = createContext<TripContextValue | null>(null);

function storedTrip(userId: string): string | null {
  try { return localStorage.getItem(`hagiangwiki:trip:${userId}`); } catch { return null; }
}

export function TripProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace>({ user: null, trips: [], trip: null, loading: true, sessionChecked: false, error: null });
  const generation = useRef(0);
  const refresh = useCallback(async (preferredId?: string) => {
    const requestId = ++generation.current;
    setWorkspace((current) => ({ ...current, loading: true, error: null }));
    try {
      let me: AuthMe | null = null;
      try { me = await api<AuthMe>('/auth/me'); }
      catch (error) { if (!(error instanceof ApiError) || error.status !== 401) throw error; }
      if (requestId !== generation.current) return;
      const session = me;
      setWorkspace((current) => ({ ...current, user: session?.user ?? null, trips: session?.trips ?? [], sessionChecked: true,
        trip: current.trip && (current.trip.readOnly || session?.trips.some((item) => item.id === current.trip?.id)) ? current.trip : null,
      }));
      const selected = me?.trips.find((trip) => trip.id === (preferredId ?? storedTrip(me.user.id))) ?? me?.trips[0];
      const trip = await api<Trip>(`/trips/${encodeURIComponent(selected?.id ?? DEMO_TRIP_ID)}`);
      if (requestId !== generation.current) return;
      if (me && selected) {
        try { localStorage.setItem(`hagiangwiki:trip:${me.user.id}`, trip.id); } catch { /* Storage is optional. */ }
      }
      setWorkspace({ user: me?.user ?? null, trips: me?.trips ?? [], trip, loading: false, sessionChecked: true, error: null });
    } catch (error) {
      if (requestId === generation.current) setWorkspace((current) => ({ ...current, loading: false, error: errorMessage(error) }));
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => { generation.current += 1; };
  }, [refresh]);

  return <TripContext.Provider value={{ ...workspace, isDemo: workspace.trip?.readOnly === true, refresh }}>{children}</TripContext.Provider>;
}

export function useTrip() {
  const value = useContext(TripContext);
  if (!value) throw new Error('TripProvider is required.');
  return value;
}
