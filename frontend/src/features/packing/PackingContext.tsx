import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { useTrip } from '../../context/TripContext';
import { api } from '../../services/api';
import { emptyPackingState, PackingStore } from './packing.store';

type PackingContextValue = ReturnType<PackingStore['getSnapshot']> & {
  refresh: PackingStore['refresh']; add: PackingStore['add']; toggle: PackingStore['toggle'];
  rename: PackingStore['rename']; remove: PackingStore['remove']; templates: PackingStore['templates'];
};
const PackingContext = createContext<PackingContextValue | null>(null);

export function PackingProvider({ children }: { children: ReactNode }) {
  const { trip, user, isDemo, lastSyncedAt } = useTrip();
  const member = isDemo ? undefined : trip?.members.find((value) => value.userId === user?.id && value.status === 'ACTIVE');
  const tripId = user && member ? trip!.id : null;
  const scope = tripId ? `${user!.id}:${tripId}:${member!.id}` : null;
  const [store] = useState(() => new PackingStore(api));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => { store.setScope(scope, tripId); return () => store.setScope(null, null); }, [store, scope, tripId]);
  useEffect(() => { void store.refresh(); }, [store, scope, lastSyncedAt]);
  // Mask the previous account's list immediately, before scope effects execute.
  const visible = state.scope === scope ? state : { ...emptyPackingState, loading: scope !== null };
  return <PackingContext.Provider value={{ ...visible, refresh: store.refresh, add: store.add, toggle: store.toggle,
    rename: store.rename, remove: store.remove, templates: store.templates }}>{children}</PackingContext.Provider>;
}

export function usePacking() {
  const value = useContext(PackingContext);
  if (!value) throw new Error('PackingProvider is required.');
  return value;
}
