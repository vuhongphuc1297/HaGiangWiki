import { useState } from 'react';
import { Check, LogOut, Plus, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Sheet } from '../../components/ui/Sheet';
import { Button } from '../../components/ui/Button';
import { ErrorNotice } from '../../components/ui/Feedback';
import { useTrip } from '../../context/TripContext';
import { api, errorMessage } from '../../services/api';
import { dateRange, money, vehicleNames } from '../../utils/format';

export function SettingsModal({ onClose, onInvite }: { onClose: () => void; onInvite?: () => void }) {
  const { user, trip, trips, isDemo, refresh } = useTrip();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function logout() {
    setBusy(true);
    try { await api('/auth/logout', { method: 'POST' }); await refresh(); onClose(); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  return <Sheet open title="Chuyến đi của bạn" onClose={onClose} busy={busy}>
    {trip && <div className="mb-5 rounded-card border border-border-main bg-bg-page p-4">
      <p className="font-serif text-xl font-bold">{trip.title}</p>
      <p className="mt-2 text-sm leading-6 text-text-muted">{dateRange(trip.startDate, trip.durationDays)}<br />{trip.durationDays} ngày · {vehicleNames[trip.vehicle]}<br />Ngân sách {money(trip.budget)}</p>
      {isDemo && <p className="mt-3 text-xs text-route">Lịch trình mẫu · Chỉ xem</p>}
    </div>}
    {user && <p className="mb-5 text-sm text-text-muted">Bạn đang dùng tên <strong className="text-text-main">{user.displayName}</strong>.</p>}
    {trips.length > 1 && <div className="mb-5 space-y-2"><h3 className="field-label">Đổi chuyến đi</h3>{trips.map((item) => <button key={item.id} type="button" disabled={busy} onClick={() => { setBusy(true); void refresh(item.id).then(onClose).finally(() => setBusy(false)); }} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-btn border border-border-main p-3 text-left text-sm"><span>{item.title}</span>{item.id === trip?.id && <Check aria-hidden="true" className="size-4 shrink-0 text-accent" />}</button>)}</div>}
    {error && <ErrorNotice>{error}</ErrorNotice>}
    {onInvite && <Button tone="secondary" className="mb-2 w-full" onClick={onInvite}><UserPlus className="size-4" aria-hidden="true" />Mời người đồng hành</Button>}
    <Button className="mt-3 w-full" onClick={() => { onClose(); navigate('/onboarding?template=1'); }}><Plus className="size-5" aria-hidden="true" />{isDemo ? 'Tạo chuyến đi của bạn' : 'Tạo chuyến đi mới'}</Button>
    {user && <Button tone="quiet" disabled={busy} className="mt-2 w-full" onClick={() => { void logout(); }}><LogOut className="size-4" aria-hidden="true" />{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</Button>}
  </Sheet>;
}
