import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, Bike, Car, Check, Mountain, Plane } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ErrorNotice, Loading } from '../../components/ui/Feedback';
import { useTrip } from '../../context/TripContext';
import { api, errorMessage } from '../../services/api';
import { ensureSession } from '../../services/session';
import { DEMO_TRIP_ID, ROAD_IMAGE } from '../../types/api';
import { cn } from '../../lib/utils';

export function OnboardingPage() {
  const { user, refresh, sessionChecked, error: workspaceError } = useTrip();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [name, setName] = useState(user?.displayName ?? '');
  const [title, setTitle] = useState('Hà Giang · Explore the Loop');
  const [startDate, setStartDate] = useState('2026-11-20');
  const [days, setDays] = useState(3);
  const [vehicle, setVehicle] = useState('XE_MAY');
  const [budget, setBudget] = useState('5000000');
  const [useTemplate, setUseTemplate] = useState(params.get('template') !== '0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<{ fingerprint: string; key: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !sessionChecked) return;
    if (!user && !name.trim()) { setError('Hãy nhập tên của bạn để bắt đầu.'); return; }
    if (!title.trim()) { setError('Hãy đặt tên cho chuyến đi.'); return; }
    const amount = Number(budget);
    if (!Number.isSafeInteger(amount) || amount < 0) { setError('Ngân sách cần là số tiền nguyên đồng hợp lệ.'); return; }
    const body = { title: title.trim(), startDate, durationDays: days, vehicle, budget: amount, ...(useTemplate ? { templateId: DEMO_TRIP_ID } : {}) };
    const fingerprint = JSON.stringify(body);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, key: crypto.randomUUID() };
    setBusy(true); setError(null);
    try {
      await ensureSession(user?.displayName ?? name.trim());
      const created = await api<{ id: string }>('/trips', { method: 'POST', body, headers: { 'Idempotency-Key': request.current!.key } });
      await refresh(created.id);
      navigate('/', { replace: true });
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }

  return <div className="pb-8">
    <header className="flex min-h-16 items-center gap-2 border-b border-border-main bg-surface px-3 pt-[env(safe-area-inset-top)]"><Link to="/" aria-label="Về lịch trình" className="icon-button"><ArrowLeft className="size-5" aria-hidden="true" /></Link><span className="font-serif text-xl font-bold text-accent">HaGiangWiki</span></header>
    <img src={ROAD_IMAGE} alt="Đường lên vùng cao Hà Giang" className="h-36 w-full object-cover" />
    <main className="px-5 pt-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-route">Một hành trình. Hai người đồng hành.</p>
      <h1 className="font-serif text-[32px] font-bold leading-[1.15]">Chuyến đi của bạn.</h1>
      <p className="mb-6 mt-3 text-sm leading-6 text-text-muted">Tạo một nơi riêng để cùng lên lịch, khám phá và lưu lại những điều nhỏ trên đường.</p>
      {!sessionChecked && (workspaceError ? <div className="mb-5 space-y-3"><ErrorNotice>{workspaceError}</ErrorNotice><Button tone="secondary" onClick={() => { void refresh(); }}>Thử lại kết nối</Button></div> : <Loading label="Đang chuẩn bị…" />)}
      <form onSubmit={(event) => { void submit(event); }} onChange={() => setError(null)} className="space-y-5">
        {!user ? <div><label htmlFor="your-name" className="field-label">Tên của bạn</label><input id="your-name" autoComplete="given-name" className="field" placeholder="Ví dụ: Tuấn" required maxLength={50} value={name} onChange={(event) => setName(event.target.value)} /></div> : <p className="rounded-btn bg-accent-soft px-3 py-3 text-sm text-accent">Xin chào, <strong>{user.displayName}</strong>.</p>}
        <div><label htmlFor="trip-title" className="field-label">Tên chuyến đi</label><input id="trip-title" className="field" required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3"><div className="min-w-0"><label htmlFor="start-date" className="field-label">Ngày khởi hành</label><input id="start-date" className="field min-w-0" type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div><div><label htmlFor="duration" className="field-label">Số ngày</label><input id="duration" className="field" type="number" min={1} max={30} required value={days} onChange={(event) => setDays(Number(event.target.value))} /></div></div>
        <fieldset><legend className="field-label">Phương tiện</legend><div className="grid grid-cols-3 gap-2">{[{ id: 'XE_MAY', label: 'Xe máy', icon: Bike }, { id: 'O_TO', label: 'Ô tô', icon: Car }, { id: 'MAY_BAY', label: 'Máy bay', icon: Plane }].map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={vehicle === id} onClick={() => setVehicle(id)} className={cn('flex min-h-12 items-center justify-center gap-1.5 rounded-btn border px-1 py-3 text-xs font-medium', vehicle === id ? 'border-accent bg-accent text-surface' : 'border-border-main bg-surface')}><Icon className="size-4 shrink-0" aria-hidden="true" />{label}</button>)}</div></fieldset>
        <div><label htmlFor="budget" className="field-label">Ngân sách cho 2 người (đ)</label><input id="budget" className="field tabular-nums" type="number" inputMode="numeric" min={0} step={1} max={Number.MAX_SAFE_INTEGER} required value={budget} onChange={(event) => setBudget(event.target.value)} /><p className="mt-2 text-xs leading-5 text-text-muted">Bao gồm các khoản chi của chuyến đi.</p></div>
        <label className="flex cursor-pointer items-start gap-3 rounded-card border border-border-main bg-surface p-4"><input type="checkbox" checked={useTemplate} onChange={(event) => setUseTemplate(event.target.checked)} className="mt-0.5 size-5 shrink-0 accent-accent" /><span><strong className="block text-sm font-semibold">Dùng lịch trình Hà Giang mẫu</strong><span className="mt-1 block text-xs leading-5 text-text-muted">9 điểm dừng để bắt đầu. Bạn có thể thêm và xếp lại theo ngày.</span></span></label>
        {error && <ErrorNotice>{error}</ErrorNotice>}
        <Button type="submit" disabled={busy || !sessionChecked} className="w-full text-base">{busy ? <Mountain className="size-5" aria-hidden="true" /> : <Check className="size-5" aria-hidden="true" />}{busy ? 'Đang tạo chuyến đi…' : !sessionChecked ? 'Đang chuẩn bị…' : 'Tạo chuyến đi'}</Button>
      </form>
    </main>
  </div>;
}
