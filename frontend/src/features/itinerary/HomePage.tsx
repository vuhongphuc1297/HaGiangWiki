import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, MapPin, Plus, RefreshCw, X } from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { TopBar } from '../../components/layout/TopBar';
import { BottomNav } from '../../components/layout/BottomNav';
import type { MainTab } from '../../components/layout/BottomNav';
import { Button } from '../../components/ui/Button';
import { ErrorNotice, Loading } from '../../components/ui/Feedback';
import { SettingsModal } from '../trip/SettingsModal';
import { EditTripModal } from '../trip/EditTripModal';
import { InviteModal } from '../trip/InviteModal';
import { MembersModal } from '../trip/MembersModal';
import { TripHero } from './TripHero';
import { DayTabs } from './DayTabs';
import { Timeline } from './Timeline';
import { PlacePool } from './PlacePool';
import { AddStopModal, AssignStopModal, DeleteStopDialog, DemoStopNotice, EditStopModal } from './StopModals';
import { ExpensesPage } from '../expenses/ExpensesPage';
import { useExpenses } from '../expenses/ExpenseContext';
import { PackingPage } from '../packing/PackingPage';
import { usePacking } from '../packing/PackingContext';
import { AddExpenseModal, EditExpenseModal, DeleteExpenseDialog } from '../expenses/ExpenseModals';
import { SettlementModal, DeleteSettlementDialog } from '../expenses/SettlementModal';
import type { Expense, ExpenseSummary, SettlementTransfer, Stop, Trip, TripUpdate } from '../../types/api';

type Modal = { kind: 'settings' | 'invite' | 'members' | 'add' | 'demo' }
  | { kind: 'edit-trip'; trip: Trip } | { kind: 'assign' | 'edit' | 'delete'; trip: Trip; stop: Stop }
  | { kind: 'add-expense'; trip: Trip; stop?: Stop }
  | { kind: 'edit-expense' | 'delete-expense'; trip: Trip; expense: Expense }
  | { kind: 'settlement'; trip: Trip; summary: ExpenseSummary }
  | { kind: 'delete-settlement'; trip: Trip; settlement: SettlementTransfer } | null;

export function HomePage() {
  const { user, trip, isDemo, loading, syncing, error, syncError, refresh, applyTrip } = useTrip();
  const expenses = useExpenses();
  const packing = usePacking();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState(1);
  const [modal, setModal] = useState<Modal>(null);
  const [reordering, setReordering] = useState(false);
  const [notice, setNotice] = useState<{ tripId: string; message: string; moved: number } | null>(null);
  const tab = (['map', 'expenses', 'packing'].includes(params.get('tab') ?? '') ? params.get('tab') : 'itinerary') as MainTab;
  const day = trip ? Math.min(selectedDay, trip.durationDays) : 1;
  const owner = !isDemo && trip?.members.some((member) => member.userId === user?.id && member.status === 'ACTIVE' && member.role === 'OWNER');
  const useTemplate = () => navigate('/onboarding?template=1');
  const afterSaved = async (nextDay: number) => { await refresh(trip?.id, { background: true }); setSelectedDay(nextDay); };
  const stopModal = modal && 'stop' in modal ? modal : null;
  const openStop = (kind: 'assign' | 'edit' | 'delete', stop: Stop) => { if (trip) setModal(isDemo ? { kind: 'demo' } : { kind, trip, stop }); };
  const refreshStops = async () => { await refresh(trip?.id, { background: true }); };
  const refreshAll = async () => { await Promise.all([refreshStops(), expenses.refresh(), packing.refresh()]); };
  const addExpense = (stop?: Stop) => {
    if (!trip) return;
    if (isDemo) { useTemplate(); return; }
    setModal({ kind: 'add-expense', trip, stop });
  };
  const editExpense = (kind: 'edit-expense' | 'delete-expense', expense: Expense) => {
    if (trip && !isDemo) setModal({ kind, trip, expense });
  };
  const reloadExpenses = async () => { setModal(null); await refreshAll(); };
  const reloadEditedData = async () => {
    const tripId = modal && 'trip' in modal ? modal.trip.id : trip?.id;
    setModal(null);
    await refresh(tripId, { background: true });
  };
  const onTripSaved = ({ movedStopsCount, ...savedTrip }: TripUpdate) => {
    applyTrip(savedTrip);
    setSelectedDay((current) => Math.min(current, savedTrip.durationDays));
    setModal(null);
    setNotice({ tripId: savedTrip.id, moved: movedStopsCount, message: movedStopsCount > 0 ? `Đã lưu cấu hình và chuyển ${movedStopsCount} địa điểm về Kho lưu tạm.` : 'Đã lưu cấu hình chuyến đi.' });
  };
  // A background sync must not remount a draft when only its version changes.
  // A different trip or session must not keep the previous trip's form open.
  useEffect(() => { setModal(null); setNotice(null); }, [trip?.id, user?.id]);

  return <>
    <TopBar members={trip?.members} loading={loading} syncing={syncing || expenses.refreshing || packing.refreshing} saving={reordering || packing.busy} error={Boolean(error || syncError || expenses.error || packing.error)} onRefresh={() => { void refreshAll(); }} onSettings={() => setModal({ kind: 'settings' })} onMembers={() => setModal({ kind: 'members' })} />
    {!trip && loading ? <Loading /> : error ? <main className="space-y-4 px-5 py-10"><h1 className="font-serif text-[32px] font-bold leading-tight">Hành trình chờ bạn.</h1><ErrorNotice>{error}</ErrorNotice><Button className="w-full" onClick={() => { void refresh(); }}><RefreshCw className="size-4" aria-hidden="true" />Thử lại</Button><Button tone="secondary" className="w-full" onClick={() => navigate('/onboarding?template=0')}>Tạo chuyến đi mới</Button></main> : trip && <main className="pb-[calc(176px+env(safe-area-inset-bottom))]">
      {syncError && <div className="mx-5 mt-4"><ErrorNotice><p>Chưa thể đồng bộ dữ liệu mới: {syncError}</p><p className="mt-1">Dữ liệu đã tải vẫn được giữ trên màn hình. Bấm Làm mới dữ liệu để thử lại.</p></ErrorNotice></div>}
      {notice?.tripId === trip.id && <div className="mx-5 mt-4 rounded-card border border-state-success/20 bg-accent-soft p-3 text-sm leading-6 text-accent"><div className="flex items-start gap-2"><Check className="mt-1 size-4 shrink-0" aria-hidden="true" /><p role="status" className="min-w-0 flex-1">{notice.message}</p><button type="button" className="icon-button -mr-2 -mt-2 shrink-0" aria-label="Ẩn thông báo" onClick={() => setNotice(null)}><X className="size-4" aria-hidden="true" /></button></div>{notice.moved > 0 && <Button tone="quiet" className="mt-2 w-full text-accent" onClick={() => { navigate('/'); setSelectedDay(0); }}>Xem Kho lưu tạm</Button>}</div>}
      {tab === 'itinerary' ? <>
        {day > 0 && <TripHero trip={trip} isDemo={isDemo} isOwner={Boolean(owner)} onInvite={() => setModal({ kind: 'invite' })} onUseTemplate={useTemplate} />}
        <DayTabs trip={trip} day={day} onChange={setSelectedDay} disabled={reordering || loading} />
        {day === 0 ? <PlacePool key={trip.id} trip={trip} disabled={loading} onAssign={(stop) => openStop('assign', stop)} onEdit={(stop) => openStop('edit', stop)} onDelete={(stop) => openStop('delete', stop)} /> : <Timeline key={`${trip.id}:${day}`} trip={trip} day={day} isDemo={isDemo} disabled={reordering || loading} onEdit={(stop) => openStop('edit', stop)} onDelete={(stop) => openStop('delete', stop)} onDemo={() => setModal({ kind: 'demo' })} onAddExpense={addExpense} onRefresh={refreshStops} onBusyChange={setReordering} />}
        <div className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[420px] border-t border-border-main bg-bg-page px-5 py-3"><Button className="w-full text-base" disabled={reordering || loading} onClick={() => { if (isDemo) useTemplate(); else setModal({ kind: 'add' }); }}><Plus className="size-5" aria-hidden="true" />Thêm địa điểm</Button></div>
      </> : tab === 'expenses' ? <ExpensesPage trip={trip} isDemo={isDemo} onCreate={useTemplate} onAdd={() => addExpense()} onEdit={(expense) => editExpense('edit-expense', expense)} onDelete={(expense) => editExpense('delete-expense', expense)} onSettlement={() => { if (expenses.data) setModal({ kind: 'settlement', trip, summary: expenses.data.summary }); }} onDeleteSettlement={(settlement) => setModal({ kind: 'delete-settlement', trip, settlement })} /> : tab === 'packing' ? <PackingPage isDemo={isDemo} onCreate={useTemplate} /> : <Placeholder onItinerary={() => navigate('/')} />}
    </main>}
    <BottomNav active={tab} />
    {modal?.kind === 'members' && trip && <MembersModal trip={trip} currentUserId={user?.id} isOwner={Boolean(owner)} onClose={() => setModal(null)} onInvite={() => { if (owner && trip.members.filter((member) => member.status === 'ACTIVE').length < 2) setModal({ kind: 'invite' }); }} />}
    {modal?.kind === 'settings' && <SettingsModal onClose={() => setModal(null)} onEditTrip={owner && trip ? () => setModal({ kind: 'edit-trip', trip }) : undefined} onInvite={owner && trip && trip.members.filter((member) => member.status === 'ACTIVE').length < 2 ? () => setModal({ kind: 'invite' }) : undefined} />}
    {modal?.kind === 'edit-trip' && owner && trip && modal.trip.id === trip.id && <EditTripModal trip={modal.trip} onSaved={onTripSaved} onReload={reloadEditedData} onClose={() => setModal(null)} />}
    {modal?.kind === 'invite' && trip && owner && <InviteModal trip={trip} onClose={() => setModal(null)} />}
    {modal?.kind === 'add' && trip && !isDemo && <AddStopModal trip={trip} initialDay={day} onSaved={afterSaved} onClose={() => setModal(null)} />}
    {stopModal?.kind === 'assign' && trip && stopModal.trip.id === trip.id && !isDemo && <AssignStopModal trip={stopModal.trip} stop={stopModal.stop} onSaved={afterSaved} onReload={reloadEditedData} onClose={() => setModal(null)} />}
    {stopModal?.kind === 'edit' && trip && stopModal.trip.id === trip.id && !isDemo && <EditStopModal trip={stopModal.trip} stop={stopModal.stop} onSaved={afterSaved} onReload={reloadEditedData} onClose={() => setModal(null)} />}
    {stopModal?.kind === 'delete' && trip && stopModal.trip.id === trip.id && !isDemo && <DeleteStopDialog trip={stopModal.trip} stop={stopModal.stop} onSaved={afterSaved} onReload={reloadEditedData} onClose={() => setModal(null)} />}
    {modal?.kind === 'add-expense' && trip?.id === modal.trip.id && !isDemo && <AddExpenseModal trip={modal.trip} currentUserId={user?.id} initialStop={modal.stop} onSaved={refreshAll} onClose={() => setModal(null)} />}
    {modal?.kind === 'edit-expense' && trip?.id === modal.trip.id && !isDemo && <EditExpenseModal trip={modal.trip} expense={modal.expense} currentUserId={user?.id} onSaved={refreshAll} onReload={reloadExpenses} onClose={() => setModal(null)} />}
    {modal?.kind === 'delete-expense' && trip?.id === modal.trip.id && !isDemo && <DeleteExpenseDialog trip={modal.trip} expense={modal.expense} onSaved={refreshAll} onReload={reloadExpenses} onClose={() => setModal(null)} />}
    {modal?.kind === 'settlement' && trip?.id === modal.trip.id && !isDemo && <SettlementModal trip={modal.trip} summary={modal.summary} onSaved={refreshAll} onClose={() => setModal(null)} />}
    {modal?.kind === 'delete-settlement' && trip?.id === modal.trip.id && !isDemo && <DeleteSettlementDialog trip={modal.trip} settlement={modal.settlement} onSaved={refreshAll} onReload={reloadExpenses} onClose={() => setModal(null)} />}
    {modal?.kind === 'demo' && <DemoStopNotice onClose={() => setModal(null)} onCreate={() => { setModal(null); useTemplate(); }} />}
  </>;
}

function Placeholder({ onItinerary }: { onItinerary: () => void }) {
  return <section className="px-5 py-12"><MapPin className="mb-7 size-10 text-accent" strokeWidth={1.3} aria-hidden="true" /><p className="mb-3 text-xs font-medium text-route">Đang chuẩn bị</p><h1 className="font-serif text-[32px] font-bold leading-tight">Bản đồ hành trình.</h1><p className="mb-7 mt-4 text-sm leading-7 text-text-muted">Những cung đường và điểm dừng sẽ được nối lại trên bản đồ. Bạn vẫn có thể xem các điểm dừng trong Lịch trình.</p><Button tone="secondary" onClick={onItinerary}>Xem lịch trình</Button></section>;
}
