import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Backpack, CalendarDays, MapPin, Plus, RefreshCw, Wallet } from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { TopBar } from '../../components/layout/TopBar';
import { BottomNav } from '../../components/layout/BottomNav';
import type { MainTab } from '../../components/layout/BottomNav';
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';
import { ErrorNotice, Loading } from '../../components/ui/Feedback';
import { SettingsModal } from '../trip/SettingsModal';
import { InviteModal } from '../trip/InviteModal';
import { TripHero } from './TripHero';
import { DayTabs } from './DayTabs';
import { Timeline } from './Timeline';
import { PlacePool } from './PlacePool';
import { AddStopModal, AssignStopModal, DeleteStopDialog, DemoStopNotice, EditStopModal } from './StopModals';
import type { Stop } from '../../types/api';

type Modal = { kind: 'settings' | 'invite' | 'add' | 'demo' } | { kind: 'assign' | 'edit' | 'delete'; stopId: string } | null;

export function HomePage() {
  const { user, trip, isDemo, loading, error, refresh } = useTrip();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState(1);
  const [modal, setModal] = useState<Modal>(null);
  const [reordering, setReordering] = useState(false);
  const tab = (['map', 'expenses', 'packing'].includes(params.get('tab') ?? '') ? params.get('tab') : 'itinerary') as MainTab;
  const day = trip ? Math.min(selectedDay, trip.durationDays) : 1;
  const owner = !isDemo && trip?.members.some((member) => member.userId === user?.id && member.status === 'ACTIVE' && member.role === 'OWNER');
  const useTemplate = () => navigate('/onboarding?template=1');
  const afterSaved = async (nextDay: number) => { await refresh(trip?.id); setSelectedDay(nextDay); };
  const stopModal = modal && 'stopId' in modal ? modal : null;
  const activeStop = stopModal ? trip?.stops.find((stop) => stop.id === stopModal.stopId) : undefined;
  const openStop = (kind: 'assign' | 'edit' | 'delete', stop: Stop) => { setModal(isDemo ? { kind: 'demo' } : { kind, stopId: stop.id }); };
  const reloadStops = () => refresh(trip?.id);
  const stopModalKey = `${trip?.id}:${activeStop?.id}:${activeStop?.version}`;

  return <>
    <TopBar members={trip?.members} loading={loading} saving={reordering} error={Boolean(error)} onSettings={() => setModal({ kind: 'settings' })} />
    {!trip && loading ? <Loading /> : error ? <main className="space-y-4 px-5 py-10"><h1 className="font-serif text-[32px] font-bold leading-tight">Hành trình chờ bạn.</h1><ErrorNotice>{error}</ErrorNotice><Button className="w-full" onClick={() => { void refresh(); }}><RefreshCw className="size-4" aria-hidden="true" />Thử lại</Button><Button tone="secondary" className="w-full" onClick={() => navigate('/onboarding?template=0')}>Tạo chuyến đi mới</Button></main> : trip && <main className="pb-[calc(176px+env(safe-area-inset-bottom))]">
      {tab === 'itinerary' ? <>
        {day > 0 && <TripHero trip={trip} isDemo={isDemo} isOwner={Boolean(owner)} onInvite={() => setModal({ kind: 'invite' })} onUseTemplate={useTemplate} />}
        <DayTabs trip={trip} day={day} onChange={setSelectedDay} disabled={reordering || loading} />
        {day === 0 ? <PlacePool key={trip.id} trip={trip} disabled={loading} onAssign={(stop) => openStop('assign', stop)} onEdit={(stop) => openStop('edit', stop)} onDelete={(stop) => openStop('delete', stop)} /> : <Timeline key={`${trip.id}:${day}`} trip={trip} day={day} isDemo={isDemo} disabled={reordering || loading} onEdit={(stop) => openStop('edit', stop)} onDelete={(stop) => openStop('delete', stop)} onDemo={() => setModal({ kind: 'demo' })} onRefresh={reloadStops} onBusyChange={setReordering} />}
        <div className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[420px] border-t border-border-main bg-bg-page px-5 py-3"><Button className="w-full text-base" disabled={reordering || loading} onClick={() => { if (isDemo) useTemplate(); else setModal({ kind: 'add' }); }}><Plus className="size-5" aria-hidden="true" />Thêm địa điểm</Button></div>
      </> : <Placeholder tab={tab} onItinerary={() => navigate('/')} />}
    </main>}
    <BottomNav active={tab} />
    {modal?.kind === 'settings' && <SettingsModal onClose={() => setModal(null)} onInvite={owner && trip && trip.members.filter((member) => member.status === 'ACTIVE').length < 2 ? () => setModal({ kind: 'invite' }) : undefined} />}
    {modal?.kind === 'invite' && trip && owner && <InviteModal trip={trip} onClose={() => setModal(null)} />}
    {modal?.kind === 'add' && trip && !isDemo && <AddStopModal trip={trip} initialDay={day} onSaved={afterSaved} onClose={() => setModal(null)} />}
    {modal?.kind === 'assign' && trip && activeStop && !isDemo && <AssignStopModal key={stopModalKey} trip={trip} stop={activeStop} onSaved={afterSaved} onReload={reloadStops} onClose={() => setModal(null)} />}
    {modal?.kind === 'edit' && trip && activeStop && !isDemo && <EditStopModal key={stopModalKey} trip={trip} stop={activeStop} onSaved={afterSaved} onReload={reloadStops} onClose={() => setModal(null)} />}
    {modal?.kind === 'delete' && trip && activeStop && !isDemo && <DeleteStopDialog key={stopModalKey} trip={trip} stop={activeStop} onSaved={afterSaved} onReload={reloadStops} onClose={() => setModal(null)} />}
    {stopModal && trip && !activeStop && !isDemo && <Sheet open title="Điểm dừng đã thay đổi" onClose={() => setModal(null)}><p className="mb-5 text-sm leading-7 text-text-muted">Điểm dừng này đã được xóa hoặc không còn trong chuyến đi. Lịch trình đã được tải lại.</p><Button className="w-full" onClick={() => setModal(null)}>Về lịch trình</Button></Sheet>}
    {modal?.kind === 'demo' && <DemoStopNotice onClose={() => setModal(null)} onCreate={() => { setModal(null); useTemplate(); }} />}
  </>;
}

function Placeholder({ tab, onItinerary }: { tab: MainTab; onItinerary: () => void }) {
  const content = {
    map: { icon: MapPin, title: 'Bản đồ hành trình.', text: 'Những cung đường và điểm dừng sẽ được nối lại trên bản đồ.' },
    expenses: { icon: Wallet, title: 'Rõ ràng từng khoản chi.', text: 'Một nơi để ghi lại chi tiêu và chia sẻ cùng người đồng hành.' },
    packing: { icon: Backpack, title: 'Gói ghém hành trình.', text: 'Chuẩn bị đồ chung và những món cần thiết cho riêng bạn.' },
    itinerary: { icon: CalendarDays, title: 'Lịch trình của bạn.', text: 'Cùng nhau chuẩn bị cho một chuyến đi.' },
  }[tab];
  const Icon = content.icon;
  return <section className="px-5 py-12"><Icon className="mb-7 size-10 text-accent" strokeWidth={1.3} aria-hidden="true" /><p className="mb-3 text-xs font-medium text-route">Đang chuẩn bị</p><h1 className="font-serif text-[32px] font-bold leading-tight">{content.title}</h1><p className="mb-7 mt-4 text-sm leading-7 text-text-muted">{content.text} Bạn vẫn có thể xem các điểm dừng trong Lịch trình.</p><Button tone="secondary" onClick={onItinerary}>Xem lịch trình</Button></section>;
}
