import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, LoaderCircle, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { Sheet } from '../../components/ui/Sheet';
import { Button } from '../../components/ui/Button';
import { ErrorNotice } from '../../components/ui/Feedback';
import { api, ApiError, errorMessage } from '../../services/api';
import type { Stop, Trip } from '../../types/api';

type SavedProps = { trip: Trip; onSaved: (day: number) => Promise<void>; onClose: () => void };
type ExistingStopProps = SavedProps & { stop: Stop; onReload: () => Promise<void> };
type Failure = { message: string; conflict: boolean };
type Draft = { name: string; category: string; day: number; arriveTime: string; leaveTime: string; cost: string; notes: string; latitude: string; longitude: string };
type FieldErrors = Partial<Record<keyof Draft, string>>;
const categories = ['Ngắm cảnh', 'Ăn uống', 'Tham quan', 'Nghỉ chân', 'Trải nghiệm', 'Ăn vặt', 'Di tích', 'Khác'];
const Spinner = () => <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />;

function failureFor(reason: unknown): Failure {
  return { message: errorMessage(reason), conflict: reason instanceof ApiError && reason.status === 409 };
}

function RequestFailure({ failure, onReload, busy, hasDraft = false }: { failure: Failure | null; onReload?: () => void; busy: boolean; hasDraft?: boolean }) {
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => { if (failure) notice.current?.scrollIntoView({ block: 'nearest' }); }, [failure]);
  if (!failure) return null;
  return <div ref={notice}><ErrorNotice>
    <p>{failure.message}</p>
    {failure.conflict && onReload && <>
      <p className="mt-1">Tải dữ liệu mới trước khi tiếp tục.{hasDraft && ' Nội dung đang nhập sẽ được thay bằng bản mới nhất.'}</p>
      <Button tone="secondary" className="mt-3 w-full" disabled={busy} onClick={onReload}>{busy ? <Spinner /> : <RefreshCw className="size-4" aria-hidden="true" />}Tải lại dữ liệu mới</Button>
    </>}
  </ErrorNotice></div>;
}

export function AddStopModal(props: SavedProps & { initialDay: number }) {
  return <StopEditor {...props} />;
}

export function EditStopModal(props: ExistingStopProps) {
  return <StopEditor {...props} initialDay={props.stop.day} />;
}

function StopEditor({ trip, initialDay, stop, onSaved, onClose, onReload }: SavedProps & { initialDay: number; stop?: Stop; onReload?: () => Promise<void> }) {
  const id = useId();
  const [draft, setDraft] = useState<Draft>(() => ({
    name: stop?.name ?? '', category: stop ? stop.category ?? '' : 'Ngắm cảnh', day: initialDay,
    arriveTime: stop?.arriveTime ?? '', leaveTime: stop?.leaveTime ?? '', cost: stop?.estimatedCost ?? '0',
    notes: stop?.notes ?? '', latitude: stop?.latitude?.toString() ?? '', longitude: stop?.longitude?.toString() ?? '',
  }));
  const [busy, setBusy] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const submitting = useRef(false);
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  const pending = busy || reloading;

  function change(field: keyof Draft, value: string | number) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, ...(['latitude', 'longitude'].includes(field) ? { latitude: undefined, longitude: undefined } : {}) }));
    setFailure((current) => current?.conflict ? current : null);
  }

  async function reload() {
    if (pending || !onReload) return;
    setReloading(true);
    try { await onReload(); }
    finally { setReloading(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || pending || failure?.conflict) return;
    const estimatedCost = Number(draft.cost);
    const latitude = draft.latitude.trim() === '' ? null : Number(draft.latitude);
    const longitude = draft.longitude.trim() === '' ? null : Number(draft.longitude);
    const invalid: FieldErrors = {};
    if (!draft.name.trim()) invalid.name = 'Hãy nhập tên địa điểm.';
    if (!draft.cost.trim() || !Number.isSafeInteger(estimatedCost) || estimatedCost < 0) invalid.cost = 'Dự toán cần là số tiền nguyên đồng không âm, trong giới hạn an toàn.';
    if (!Number.isInteger(draft.day) || draft.day < 0 || draft.day > trip.durationDays) invalid.day = 'Hãy chọn một ngày trong chuyến đi hoặc Kho tạm.';
    for (const field of ['arriveTime', 'leaveTime'] as const) if (draft[field] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft[field])) invalid[field] = 'Nhập giờ hợp lệ theo định dạng HH:mm.';
    if ((latitude === null) !== (longitude === null)) {
      invalid.latitude = invalid.longitude = 'Nhập đủ cả vĩ độ và kinh độ, hoặc để trống cả hai.';
    } else {
      if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) invalid.latitude = 'Vĩ độ phải từ −90 đến 90.';
      if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) invalid.longitude = 'Kinh độ phải từ −180 đến 180.';
    }
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      document.getElementById(`${id}-${Object.keys(invalid)[0]}`)?.focus();
      return;
    }
    const body = {
      name: draft.name.trim(), category: draft.category || null, day: draft.day,
      arriveTime: draft.arriveTime || null, leaveTime: draft.leaveTime || null,
      estimatedCost, notes: draft.notes.trim() || null, latitude, longitude,
      ...(stop ? { version: stop.version } : {}),
    };
    const fingerprint = JSON.stringify(body);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, key: crypto.randomUUID() };
    submitting.current = true;
    setBusy(true); setFailure(null);
    try {
      const saved = await api<Stop>(`/trips/${trip.id}/stops${stop ? `/${stop.id}` : ''}`, { method: stop ? 'PATCH' : 'POST', body, headers: { 'Idempotency-Key': request.current!.key } });
      await onSaved(saved.day); onClose();
    } catch (reason) { setFailure(failureFor(reason)); }
    finally { submitting.current = false; setBusy(false); }
  }

  function fieldProps(field: keyof Draft) {
    return { id: `${id}-${field}`, 'aria-invalid': Boolean(errors[field]), 'aria-describedby': errors[field] ? `${id}-${field}-error` : undefined };
  }
  const fieldError = (field: keyof Draft) => errors[field] && <p id={`${id}-${field}-error`} className="mt-1 text-xs leading-5 text-state-error" role="alert">{errors[field]}</p>;

  return <Sheet open title={stop ? 'Sửa điểm dừng' : 'Thêm địa điểm'} onClose={onClose} busy={pending}>
    <form noValidate onSubmit={(event) => { void submit(event); }} className="space-y-4" aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-4">
        <div><label className="field-label" htmlFor={`${id}-name`}>Tên địa điểm</label><input {...fieldProps('name')} className="field" required maxLength={160} placeholder="Ví dụ: Dốc Thẩm Mã" value={draft.name} onChange={(event) => change('name', event.target.value)} />{fieldError('name')}</div>
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          <div className="min-w-0"><label className="field-label" htmlFor={`${id}-category`}>Loại địa điểm</label><select {...fieldProps('category')} className="field" value={draft.category} onChange={(event) => change('category', event.target.value)}><option value="">Chưa chọn</option>{draft.category && !categories.includes(draft.category) && <option>{draft.category}</option>}{categories.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="min-w-0"><label className="field-label" htmlFor={`${id}-day`}>Xếp lịch</label><select {...fieldProps('day')} className="field" value={draft.day} onChange={(event) => change('day', Number(event.target.value))}><option value={0}>Kho tạm</option>{Array.from({ length: trip.durationDays }, (_, index) => <option key={index + 1} value={index + 1}>Ngày {index + 1}</option>)}</select>{fieldError('day')}</div>
        </div>
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          <div className="min-w-0"><label className="field-label" htmlFor={`${id}-arriveTime`}>Giờ đến</label><input {...fieldProps('arriveTime')} className="field min-w-0" type="time" value={draft.arriveTime} onChange={(event) => change('arriveTime', event.target.value)} />{fieldError('arriveTime')}</div>
          <div className="min-w-0"><label className="field-label" htmlFor={`${id}-leaveTime`}>Giờ rời đi</label><input {...fieldProps('leaveTime')} className="field min-w-0" type="time" value={draft.leaveTime} onChange={(event) => change('leaveTime', event.target.value)} />{fieldError('leaveTime')}</div>
        </div>
        <div><label className="field-label" htmlFor={`${id}-cost`}>Dự toán cho 2 người (đ)</label><input {...fieldProps('cost')} className="field tabular-nums" type="number" inputMode="numeric" required min={0} step={1} max={Number.MAX_SAFE_INTEGER} value={draft.cost} onChange={(event) => change('cost', event.target.value)} />{fieldError('cost')}</div>
        <div><label className="field-label" htmlFor={`${id}-notes`}>Ghi chú</label><textarea {...fieldProps('notes')} className="field resize-y" rows={3} maxLength={2000} placeholder="Điều bạn muốn nhớ trên đường…" value={draft.notes} onChange={(event) => change('notes', event.target.value)} /></div>
        <fieldset aria-describedby={`${id}-gps-hint`}>
          <legend className="field-label">Tọa độ GPS</legend>
          <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
            <div className="min-w-0"><label className="mb-2 block text-xs text-text-muted" htmlFor={`${id}-latitude`}>Vĩ độ (Latitude)</label><input {...fieldProps('latitude')} className="field" type="number" inputMode="decimal" step="any" min={-90} max={90} placeholder="Ví dụ: 23.0567" value={draft.latitude} onChange={(event) => change('latitude', event.target.value)} />{fieldError('latitude')}</div>
            <div className="min-w-0"><label className="mb-2 block text-xs text-text-muted" htmlFor={`${id}-longitude`}>Kinh độ (Longitude)</label><input {...fieldProps('longitude')} className="field" type="number" inputMode="decimal" step="any" min={-180} max={180} placeholder="Ví dụ: 104.9876" value={draft.longitude} onChange={(event) => change('longitude', event.target.value)} />{fieldError('longitude')}</div>
          </div>
          <p id={`${id}-gps-hint`} className="mt-2 text-xs leading-5 text-text-muted">Chưa có GPS? Bạn có thể để trống cả hai ô và bổ sung sau.</p>
        </fieldset>
      </fieldset>
      <RequestFailure failure={failure} onReload={onReload ? () => { void reload(); } : undefined} busy={pending} hasDraft />
      <Button className="w-full text-base" type="submit" disabled={pending || Boolean(failure?.conflict)}>{busy ? <Spinner /> : stop ? <Save className="size-5" aria-hidden="true" /> : <Plus className="size-5" aria-hidden="true" />}{busy ? 'Đang lưu…' : stop ? 'Lưu thay đổi' : 'Lưu địa điểm'}</Button>
    </form>
  </Sheet>;
}

export function AssignStopModal({ trip, stop, onSaved, onClose, onReload }: ExistingStopProps) {
  const [day, setDay] = useState(1);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const submitting = useRef(false);
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  async function save() {
    if (submitting.current || busy || failure?.conflict) return;
    const body = { day, version: stop.version };
    const fingerprint = JSON.stringify(body);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, key: crypto.randomUUID() };
    submitting.current = true;
    setBusy(true); setFailure(null);
    try {
      await api(`/trips/${trip.id}/stops/${stop.id}`, { method: 'PATCH', body, headers: { 'Idempotency-Key': request.current!.key } });
      await onSaved(day); onClose();
    } catch (reason) { setFailure(failureFor(reason)); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <Sheet open title="Xếp địa điểm vào ngày" onClose={onClose} busy={busy}>
    <p className="mb-5 font-serif text-xl font-semibold">{stop.name}</p>
    <label htmlFor="assign-day" className="field-label">Ngày trong hành trình</label><select id="assign-day" className="field mb-5" disabled={busy} value={day} onChange={(event) => { setDay(Number(event.target.value)); setFailure((current) => current?.conflict ? current : null); }}>{Array.from({ length: trip.durationDays }, (_, index) => <option key={index + 1} value={index + 1}>Ngày {index + 1}</option>)}</select>
    {failure && <div className="mb-4"><RequestFailure failure={failure} busy={busy} onReload={() => { setBusy(true); void onReload().finally(() => setBusy(false)); }} /></div>}
    <Button className="w-full" disabled={busy || Boolean(failure?.conflict)} onClick={() => { void save(); }}>{busy ? <Spinner /> : <Check className="size-5" aria-hidden="true" />}{busy ? 'Đang xếp lịch…' : `Xếp vào Ngày ${day}`}</Button>
  </Sheet>;
}

export function DeleteStopDialog({ trip, stop, onSaved, onClose, onReload }: ExistingStopProps) {
  const descriptionId = useId();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const submitting = useRef(false);
  const key = useRef<string | null>(null);

  async function remove() {
    if (submitting.current || busy || failure?.conflict) return;
    key.current ??= crypto.randomUUID();
    submitting.current = true;
    setBusy(true); setFailure(null);
    try {
      await api(`/trips/${trip.id}/stops/${stop.id}`, { method: 'DELETE', body: { version: stop.version }, headers: { 'Idempotency-Key': key.current } });
      await onSaved(stop.day); onClose();
    } catch (reason) { setFailure(failureFor(reason)); }
    finally { submitting.current = false; setBusy(false); }
  }

  return <Sheet open variant="dialog" title="Xóa địa điểm?" describedBy={descriptionId} busy={busy} onClose={onClose}>
    <p id={descriptionId} className="mb-5 break-words text-sm leading-7">Bạn có chắc chắn muốn xóa địa điểm <strong>{stop.name}</strong>? Toàn bộ thứ tự trong ngày sẽ được tự động sắp xếp lại.</p>
    {failure && <div className="mb-4"><RequestFailure failure={failure} busy={busy} onReload={() => { setBusy(true); void onReload().finally(() => setBusy(false)); }} /></div>}
    <div className="flex flex-wrap justify-end gap-3">
      <Button tone="secondary" disabled={busy} onClick={onClose}>Hủy</Button>
      <Button tone="danger" disabled={busy || Boolean(failure?.conflict)} onClick={() => { void remove(); }}>{busy ? <Spinner /> : <Trash2 className="size-4" aria-hidden="true" />}{busy ? 'Đang xóa…' : 'Xóa địa điểm'}</Button>
    </div>
  </Sheet>;
}

export function DemoStopNotice({ onClose, onCreate }: { onClose: () => void; onCreate: () => void }) {
  return <Sheet open title="Lịch trình của riêng bạn" onClose={onClose}>
    <p className="mb-6 text-sm leading-7 text-text-muted">Đây là lịch trình mẫu. Hãy tạo chuyến đi của riêng bạn để thoải mái chỉnh sửa và sắp xếp!</p>
    <Button className="w-full" onClick={onCreate}><Plus className="size-4" aria-hidden="true" />Tạo chuyến đi riêng</Button>
  </Sheet>;
}
