import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Plus } from 'lucide-react';
import { Sheet } from '../../components/ui/Sheet';
import { Button } from '../../components/ui/Button';
import { ErrorNotice } from '../../components/ui/Feedback';
import { api, errorMessage } from '../../services/api';
import type { Stop, Trip } from '../../types/api';

export function AddStopModal({ trip, initialDay, onSaved, onClose }: { trip: Trip; initialDay: number; onSaved: (day: number) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Ngắm cảnh');
  const [day, setDay] = useState(initialDay);
  const [arriveTime, setArriveTime] = useState('');
  const [leaveTime, setLeaveTime] = useState('');
  const [cost, setCost] = useState('0');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!name.trim()) { setError('Hãy nhập tên địa điểm.'); return; }
    const estimatedCost = Number(cost);
    if (!Number.isSafeInteger(estimatedCost) || estimatedCost < 0) { setError('Dự toán cần là số tiền nguyên đồng hợp lệ.'); return; }
    const body = { name: name.trim(), category, day, arriveTime: arriveTime || null, leaveTime: leaveTime || null, estimatedCost, notes: notes.trim() };
    const fingerprint = JSON.stringify(body);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, key: crypto.randomUUID() };
    setBusy(true); setError(null);
    try {
      await api<Stop>(`/trips/${trip.id}/stops`, { method: 'POST', body, headers: { 'Idempotency-Key': request.current!.key } });
      await onSaved(day); onClose();
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  return <Sheet open title="Thêm địa điểm" onClose={onClose} busy={busy}>
    <form onSubmit={(event) => { void submit(event); }} onChange={() => setError(null)} className="space-y-4">
      <div><label className="field-label" htmlFor="stop-name">Tên địa điểm</label><input id="stop-name" className="field" required maxLength={160} placeholder="Ví dụ: Dốc Thẩm Mã" value={name} onChange={(event) => setName(event.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3"><div><label className="field-label" htmlFor="stop-category">Loại địa điểm</label><select id="stop-category" className="field" value={category} onChange={(event) => setCategory(event.target.value)}>{['Ngắm cảnh', 'Ăn uống', 'Tham quan', 'Nghỉ chân', 'Trải nghiệm', 'Ăn vặt', 'Di tích', 'Khác'].map((item) => <option key={item}>{item}</option>)}</select></div><div><label className="field-label" htmlFor="stop-day">Xếp lịch</label><select id="stop-day" className="field" value={day} onChange={(event) => setDay(Number(event.target.value))}><option value={0}>Kho tạm</option>{Array.from({ length: trip.durationDays }, (_, index) => <option key={index + 1} value={index + 1}>Ngày {index + 1}</option>)}</select></div></div>
      <div className="grid grid-cols-2 gap-3"><div className="min-w-0"><label className="field-label" htmlFor="arrive-time">Giờ đến</label><input id="arrive-time" className="field min-w-0" type="time" value={arriveTime} onChange={(event) => setArriveTime(event.target.value)} /></div><div className="min-w-0"><label className="field-label" htmlFor="leave-time">Giờ rời đi</label><input id="leave-time" className="field min-w-0" type="time" value={leaveTime} onChange={(event) => setLeaveTime(event.target.value)} /></div></div>
      <div><label className="field-label" htmlFor="stop-cost">Dự toán cho 2 người (đ)</label><input id="stop-cost" className="field tabular-nums" type="number" inputMode="numeric" min={0} step={1} max={Number.MAX_SAFE_INTEGER} value={cost} onChange={(event) => setCost(event.target.value)} /></div>
      <div><label className="field-label" htmlFor="stop-notes">Ghi chú</label><textarea id="stop-notes" className="field resize-y" rows={3} maxLength={2000} placeholder="Điều bạn muốn nhớ trên đường…" value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
      <p className="text-xs leading-5 text-text-muted">Có thể bổ sung tọa độ sau. Địa điểm mới sẽ được lưu khi bạn xác nhận.</p>
      {error && <ErrorNotice>{error}</ErrorNotice>}
      <Button className="w-full text-base" type="submit" disabled={busy}><Plus className="size-5" aria-hidden="true" />{busy ? 'Đang lưu…' : 'Lưu địa điểm'}</Button>
    </form>
  </Sheet>;
}

export function AssignStopModal({ trip, stop, onSaved, onClose }: { trip: Trip; stop: Stop; onSaved: (day: number) => Promise<void>; onClose: () => void }) {
  const [day, setDay] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  async function save() {
    if (busy) return;
    const body = { day, version: stop.version };
    const fingerprint = JSON.stringify(body);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, key: crypto.randomUUID() };
    setBusy(true); setError(null);
    try {
      await api(`/trips/${trip.id}/stops/${stop.id}`, { method: 'PATCH', body, headers: { 'Idempotency-Key': request.current!.key } });
      await onSaved(day); onClose();
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  return <Sheet open title="Xếp địa điểm vào ngày" onClose={onClose} busy={busy}>
    <p className="mb-5 font-serif text-xl font-semibold">{stop.name}</p>
    <label htmlFor="assign-day" className="field-label">Ngày trong hành trình</label><select id="assign-day" className="field mb-5" value={day} onChange={(event) => { setDay(Number(event.target.value)); setError(null); }}>{Array.from({ length: trip.durationDays }, (_, index) => <option key={index + 1} value={index + 1}>Ngày {index + 1}</option>)}</select>
    {error && <div className="mb-4"><ErrorNotice>{error}</ErrorNotice></div>}
    <Button className="w-full" disabled={busy} onClick={() => { void save(); }}><Check className="size-5" aria-hidden="true" />{busy ? 'Đang xếp lịch…' : `Xếp vào Ngày ${day}`}</Button>
  </Sheet>;
}
