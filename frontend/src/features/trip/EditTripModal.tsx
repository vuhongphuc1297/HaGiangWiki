import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { LoaderCircle, Save, TriangleAlert } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ConflictNotice } from '../../components/ui/ConflictNotice';
import { ErrorNotice } from '../../components/ui/Feedback';
import { Sheet } from '../../components/ui/Sheet';
import { api, ApiError, errorMessage } from '../../services/api';
import type { Trip, TripUpdate } from '../../types/api';
import { money, vehicleNames } from '../../utils/format';

type Draft = { title: string; startDate: string; durationDays: string; vehicle: Trip['vehicle']; budget: string };
type FieldErrors = Partial<Record<keyof Draft, string>>;

export function EditTripModal({ trip, onSaved, onReload, onClose }: {
  trip: Trip; onSaved: (trip: TripUpdate) => void; onReload: () => Promise<void>; onClose: () => void;
}) {
  const id = useId();
  // Keep the opening snapshot and its version until save or explicit refresh.
  const [draft, setDraft] = useState<Draft>(() => ({ title: trip.title, startDate: trip.startDate.slice(0, 10), durationDays: String(trip.durationDays), vehicle: trip.vehicle, budget: trip.budget }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => { if (error || conflict) notice.current?.scrollIntoView({ block: 'nearest' }); }, [error, conflict]);
  const durationDays = Number(draft.durationDays);
  const budget = Number(draft.budget);
  const shrinking = Number.isInteger(durationDays) && durationDays >= 1 && durationDays < trip.durationDays;
  const affectedDays = durationDays + 1 === trip.durationDays ? `Ngày ${trip.durationDays}` : `Ngày ${durationDays + 1} đến Ngày ${trip.durationDays}`;
  const affectedStops = trip.stops.filter((stop) => stop.day > durationDays).length;

  function change<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (!conflict) setError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || busy || conflict) return;
    const invalid: FieldErrors = {};
    if (!draft.title.trim() || draft.title.trim().length > 200) invalid.title = 'Tên chuyến đi cần có từ 1 đến 200 ký tự.';
    const date = new Date(`${draft.startDate}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.startDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== draft.startDate) invalid.startDate = 'Hãy chọn ngày bắt đầu hợp lệ.';
    if (!draft.durationDays.trim() || !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 30) invalid.durationDays = 'Số ngày phải là số nguyên từ 1 đến 30.';
    if (!draft.budget.trim() || !Number.isSafeInteger(budget) || budget < 0) invalid.budget = 'Ngân sách cần là số nguyên đồng không âm trong giới hạn an toàn.';
    setErrors(invalid);
    if (Object.keys(invalid).length) { document.getElementById(`${id}-${Object.keys(invalid)[0]}`)?.focus(); return; }
    const body = { title: draft.title.trim(), startDate: draft.startDate, durationDays, vehicle: draft.vehicle, budget, version: trip.version };
    const fingerprint = JSON.stringify(body);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, key: crypto.randomUUID() };
    submitting.current = true; setBusy(true); setError(null);
    try {
      const saved = await api<TripUpdate>(`/trips/${trip.id}`, { method: 'PATCH', body, headers: { 'Idempotency-Key': request.current!.key } });
      onSaved(saved);
    } catch (reason) {
      setConflict(reason instanceof ApiError && reason.status === 409);
      setError(errorMessage(reason));
    } finally { submitting.current = false; setBusy(false); }
  }

  const fieldProps = (field: keyof Draft) => ({ id: `${id}-${field}`, 'aria-invalid': Boolean(errors[field]), 'aria-describedby': errors[field] ? `${id}-${field}-error` : undefined });
  const fieldError = (field: keyof Draft) => errors[field] && <p id={`${id}-${field}-error`} role="alert" className="mt-1 text-xs leading-5 text-state-error">{errors[field]}</p>;

  return <Sheet open title="Chỉnh sửa cấu hình" busy={busy} onClose={onClose}>
    <form noValidate onSubmit={(event) => { void submit(event); }} className="space-y-5" aria-busy={busy}>
      <fieldset disabled={busy} className="space-y-5">
        <div><label className="field-label" htmlFor={`${id}-title`}>Tên chuyến đi</label><input {...fieldProps('title')} className="field" required maxLength={200} value={draft.title} onChange={(event) => change('title', event.target.value)} />{fieldError('title')}</div>
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          <div className="min-w-0"><label className="field-label" htmlFor={`${id}-startDate`}>Ngày bắt đầu</label><input {...fieldProps('startDate')} className="field min-w-0" type="date" required value={draft.startDate} onChange={(event) => change('startDate', event.target.value)} />{fieldError('startDate')}</div>
          <div className="min-w-0"><label className="field-label" htmlFor={`${id}-durationDays`}>Số ngày</label><input {...fieldProps('durationDays')} className="field" type="number" inputMode="numeric" required min={1} max={30} step={1} value={draft.durationDays} onChange={(event) => change('durationDays', event.target.value)} />{fieldError('durationDays')}</div>
        </div>
        {shrinking && <div role="status" className="rounded-card border border-state-warning/30 bg-state-warning/10 p-4 text-sm leading-6 text-state-warning">
          <div className="flex items-start gap-2"><TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><p><strong>Lưu ý:</strong> Bạn đang rút ngắn chuyến đi từ {trip.durationDays} ngày xuống {durationDays} ngày. Toàn bộ các địa điểm thuộc {affectedDays} sẽ được tự động chuyển về Kho lưu tạm (Chưa xếp ngày) mà không bị mất dữ liệu.</p></div>
          <p className="mt-2 text-xs leading-5">Theo lịch hiện tại: {affectedStops} địa điểm sẽ được chuyển.</p>
        </div>}
        <div><label className="field-label" htmlFor={`${id}-vehicle`}>Phương tiện</label><select {...fieldProps('vehicle')} className="field" value={draft.vehicle} onChange={(event) => change('vehicle', event.target.value as Trip['vehicle'])}>{Object.entries(vehicleNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div><label className="field-label" htmlFor={`${id}-budget`}>Ngân sách dự kiến (đ)</label><input {...fieldProps('budget')} className="field tabular-nums" type="number" inputMode="numeric" required min={0} max={Number.MAX_SAFE_INTEGER} step={1} value={draft.budget} onChange={(event) => change('budget', event.target.value)} />{fieldError('budget')}<p className="mt-2 text-xs leading-5 text-text-muted">{draft.budget.trim() && Number.isSafeInteger(budget) && budget >= 0 ? `${money(budget)} cho cả chuyến đi.` : 'Nhập số tiền nguyên đồng cho cả chuyến đi.'}</p></div>
      </fieldset>
      {(conflict || error) && <div ref={notice}>{conflict ? <ConflictNotice hasDraft busy={busy} onReload={() => { void onReload(); }} /> : <ErrorNotice>{error}</ErrorNotice>}</div>}
      <div className="flex flex-wrap gap-3"><Button tone="secondary" disabled={busy} onClick={onClose}>Hủy</Button><Button className="min-w-0 flex-1" type="submit" disabled={busy || conflict}>{busy ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</Button></div>
    </form>
  </Sheet>;
}
