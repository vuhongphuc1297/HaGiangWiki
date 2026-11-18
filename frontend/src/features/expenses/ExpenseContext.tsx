import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTrip } from '../../context/TripContext';
import { api, ApiError, errorMessage } from '../../services/api';
import type { ExpenseLedger } from '../../types/api';

type ExpenseState = {
  scope: string | null;
  data: ExpenseLedger | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
};
type ExpenseContextValue = Omit<ExpenseState, 'scope'> & { refresh: () => Promise<void> };
type PendingRead = { scope: string; syncedAt: number | null; controller: AbortController; promise: Promise<void> };

const emptyState: ExpenseState = { scope: null, data: null, loading: false, refreshing: false, error: null };
const ExpenseContext = createContext<ExpenseContextValue | null>(null);

export function ExpensesProvider({ children }: { children: ReactNode }) {
  const { trip, user, isDemo, lastSyncedAt } = useTrip();
  const accessible = Boolean(trip && user && !isDemo && trip.members.some((member) => (
    member.userId === user.id && member.status === 'ACTIVE'
  )));
  const tripId = accessible ? trip!.id : null;
  const scope = accessible ? `${user!.id}:${tripId}` : null;
  const [state, setState] = useState<ExpenseState>(emptyState);
  const currentScope = useRef(scope);
  const generation = useRef(0);
  const pending = useRef<PendingRead | null>(null);
  const mounted = useRef(false);
  // Responses for a previous session/trip are discarded even before effects run.
  currentScope.current = scope;

  const load = useCallback((force: boolean): Promise<void> => {
    if (!scope || !tripId || !mounted.current || currentScope.current !== scope) return Promise.resolve();
    const previous = pending.current;
    if (!force && previous?.scope === scope && previous.syncedAt === lastSyncedAt) return previous.promise;
    previous?.controller.abort();
    const controller = new AbortController();
    const requestId = ++generation.current;
    const stillCurrent = () => mounted.current && requestId === generation.current && currentScope.current === scope;
    setState((current) => {
      const retained = current.scope === scope ? current.data : null;
      return { scope, data: retained, loading: retained === null, refreshing: retained !== null, error: null };
    });
    const entry: PendingRead = { scope, syncedAt: lastSyncedAt, controller, promise: Promise.resolve() };
    entry.promise = (async () => {
      try {
        const data = await api<ExpenseLedger>(`/trips/${encodeURIComponent(tripId)}/expenses`, { signal: controller.signal });
        if (stillCurrent()) setState({ scope, data, loading: false, refreshing: false, error: null });
      } catch (reason) {
        if (!stillCurrent() || controller.signal.aborted) return;
        const denied = reason instanceof ApiError && [401, 403, 404].includes(reason.status);
        setState((current) => ({
          scope, data: denied || current.scope !== scope ? null : current.data,
          loading: false, refreshing: false, error: errorMessage(reason),
        }));
      } finally {
        if (pending.current === entry) pending.current = null;
      }
    })();
    pending.current = entry;
    return entry.promise;
  }, [scope, tripId, lastSyncedAt]);

  // A manual/post-save read must start after the mutation, rather than share an
  // in-flight request that may have read the old ledger before the commit.
  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      pending.current?.controller.abort();
      pending.current = null;
    };
  }, []);

  useEffect(() => {
    if (!scope) {
      generation.current += 1;
      pending.current?.controller.abort();
      pending.current = null;
      setState(emptyState);
      return;
    }
    void load(false);
  }, [scope, load]);

  // Never flash financial data from a previous trip while a scope effect waits.
  const visible = state.scope === scope ? state : { ...emptyState, loading: scope !== null };
  return <ExpenseContext.Provider value={{
    data: visible.data, loading: visible.loading, refreshing: visible.refreshing,
    error: visible.error, refresh,
  }}>{children}</ExpenseContext.Provider>;
}

export function useExpenses() {
  const value = useContext(ExpenseContext);
  if (!value) throw new Error('ExpensesProvider is required.');
  return value;
}
