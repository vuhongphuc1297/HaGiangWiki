import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, LoaderCircle, MapPin, MapPinOff, Pencil, RefreshCw, Trash2, Wallet } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ErrorNotice } from '../../components/ui/Feedback';
import { api, errorMessage } from '../../services/api';
import type { RouteLeg, Stop, Trip } from '../../types/api';
import { money, shortDate } from '../../utils/format';
import { LegEstimate } from '../external/LegEstimate';
import { estimateTravelLeg, hasCoordinates, useDayRoutes } from '../external/useDayRoutes';

type Direction = 'up' | 'down';
type Props = {
  trip: Trip; day: number; isDemo: boolean; disabled: boolean;
  onEdit: (stop: Stop) => void; onDelete: (stop: Stop) => void; onDemo: () => void;
  onAddExpense: (stop: Stop) => void;
  onRefresh: () => Promise<void>; onBusyChange: (busy: boolean) => void;
};

export function Timeline({ trip, day, isDemo, disabled, onEdit, onDelete, onDemo, onAddExpense, onRefresh, onBusyChange }: Props) {
  const [optimistic, setOptimistic] = useState<{ stops: Stop[]; stopId: string; direction: Direction } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [reloading, setReloading] = useState(false);
  const inFlight = useRef(false);
  const errorNotice = useRef<HTMLDivElement>(null);
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  const stops = optimistic?.stops ?? trip.stops.filter((stop) => stop.day === day);
  const busy = disabled || optimistic !== null || reloading;
  const { summaries, loading: routesLoading } = useDayRoutes(trip, day, isDemo);
  useEffect(() => { if (error) errorNotice.current?.scrollIntoView({ block: 'nearest' }); }, [error]);

  async function move(index: number, direction: Direction) {
    if (inFlight.current || busy) return;
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    const stop = stops[index];
    const neighbor = stops[nextIndex];
    if (!stop || !neighbor) return;
    if (isDemo) { onDemo(); return; }
    const reordered = [...stops];
    reordered[index] = neighbor;
    reordered[nextIndex] = stop;
    const body = { day, stopIds: reordered.map((item) => item.id) };
    const fingerprint = JSON.stringify(body);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, key: crypto.randomUUID() };
    inFlight.current = true;
    setOptimistic({ stops: reordered, stopId: stop.id, direction });
    setError(null); onBusyChange(true);
    try {
      const saved = await api<Stop[]>(`/trips/${trip.id}/stops/reorder`, { method: 'PATCH', body, headers: { 'Idempotency-Key': request.current!.key } });
      // A later move is a new intent, even if another device restored this order.
      request.current = null;
      // Keep server versions on screen until the complete trip refresh finishes.
      setOptimistic({ stops: saved, stopId: stop.id, direction });
      await onRefresh();
      setAnnouncement(`Đã chuyển ${stop.name} ${direction === 'up' ? 'lên' : 'xuống'} và lưu thứ tự.`);
    } catch (reason) {
      setError(`${errorMessage(reason)} Thứ tự trên màn hình đã được khôi phục. Hãy tải lại để kiểm tra dữ liệu mới nhất.`);
    } finally {
      setOptimistic(null); inFlight.current = false; onBusyChange(false);
    }
  }

  async function reload() {
    if (busy || inFlight.current) return;
    setReloading(true); onBusyChange(true);
    try { await onRefresh(); setError(null); }
    finally { setReloading(false); onBusyChange(false); }
  }

  const first = stops[0];
  const last = stops[stops.length - 1];
  const title = first && last && first.id !== last.id ? `${first.name.replace(/^TP\.\s*/, '')} → ${last.name}` : `Ngày ${day} của hành trình`;
  return <section id="day-panel" role="tabpanel" aria-labelledby={`day-tab-${day}`} className="px-5 pt-3">
    <h2 className="break-words font-serif text-2xl font-bold leading-tight">{title}</h2>
    <p className="mb-5 mt-1 text-xs text-text-muted">{shortDate(trip.startDate, day)} · {stops.length} điểm dừng</p>
    <p role="status" className="sr-only">{optimistic ? 'Đang lưu thứ tự điểm dừng…' : announcement}</p>
    {error && <div ref={errorNotice} className="mb-4"><ErrorNotice><p>{error}</p><Button tone="secondary" className="mt-3 w-full" disabled={busy} onClick={() => { void reload(); }}>{reloading ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}Tải lại dữ liệu mới</Button></ErrorNotice></div>}
    {stops.length === 0 ? <div className="rounded-card border border-dashed border-border-main px-5 py-8 text-center"><MapPin className="mx-auto mb-3 size-7 text-route" aria-hidden="true" /><h3 className="font-serif text-xl font-semibold">Một ngày để khám phá.</h3><p className="mt-2 text-sm leading-6 text-text-muted">Thêm địa điểm hoặc xếp một điểm từ Kho tạm vào ngày này.</p></div> : <ol className="space-y-4" aria-busy={optimistic !== null}>
      {stops.map((stop, index) => {
        const next = stops[index + 1];
        let leg: RouteLeg | undefined;
        if (next && hasCoordinates(stop) && hasCoordinates(next)) {
          leg = summaries[0]?.legs.find((route) => route.fromStopId === stop.id && route.toStopId === next.id);
          if (!leg && (!routesLoading || optimistic)) leg = estimateTravelLeg(stop, next);
        }
        return <TimelineStop key={stop.id} stop={stop} index={index} next={next} leg={leg} vehicle={trip.vehicle} disabled={busy} pendingDirection={optimistic?.stopId === stop.id ? optimistic.direction : undefined} onMove={(direction) => { void move(index, direction); }} onEdit={() => onEdit(stop)} onDelete={() => onDelete(stop)} onAddExpense={() => onAddExpense(stop)} />;
      })}
    </ol>}
  </section>;
}

function TimelineStop({ stop, index, next, leg, vehicle, disabled, pendingDirection, onMove, onEdit, onDelete, onAddExpense }: {
  stop: Stop; index: number; next?: Stop; leg?: RouteLeg; vehicle: Trip['vehicle']; disabled: boolean; pendingDirection?: Direction;
  onMove: (direction: Direction) => void; onEdit: () => void; onDelete: () => void; onAddExpense: () => void;
}) {
  const missingGps = next && (!hasCoordinates(stop) || !hasCoordinates(next));
  return <li className="relative pl-11">
    {next && <span aria-hidden="true" className={`absolute bottom-[-17px] left-[14px] top-7 border-l ${missingGps ? 'border-dashed border-border-main' : 'border-route/50'}`} />}
    <span className="absolute left-0 top-1 flex size-[30px] items-center justify-center rounded-full bg-route text-xs font-medium tabular-nums text-surface">{String(index + 1).padStart(2, '0')}</span>
    <article className="rounded-card border border-border-main bg-surface p-3">
      <div className="mb-1 flex items-start justify-between gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-[10px] leading-5">
        {(stop.arriveTime || stop.leaveTime) && <p className="font-medium tabular-nums">{stop.arriveTime ?? '—'} – {stop.leaveTime ?? '—'}</p>}
        {stop.category && <span className="rounded-btn bg-accent-soft px-1.5 text-accent">{stop.category}</span>}
        </div>
        <div className="-mr-1 -mt-1 flex shrink-0" role="group" aria-label={`Thứ tự ${stop.name}`}>
          <button type="button" className="icon-button disabled:cursor-default" aria-label={`Di chuyển ${stop.name} lên`} title="Di chuyển lên" disabled={disabled || index === 0} onClick={() => onMove('up')}>{pendingDirection === 'up' ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowUp className="size-4" aria-hidden="true" />}</button>
          <button type="button" className="icon-button disabled:cursor-default" aria-label={`Di chuyển ${stop.name} xuống`} title="Di chuyển xuống" disabled={disabled || !next} onClick={() => onMove('down')}>{pendingDirection === 'down' ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowDown className="size-4" aria-hidden="true" />}</button>
        </div>
      </div>
      <h3 className="break-words font-serif text-xl font-bold leading-6">{stop.name}</h3>
      {BigInt(stop.estimatedCost) > 0n && <p className="mt-1 text-[11px] leading-5 text-text-muted">Dự toán {money(stop.estimatedCost)}</p>}
      {stop.notes && <p className="mt-1 whitespace-pre-line break-words text-xs leading-5 text-text-muted">{stop.notes}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-1 border-t border-border-main/60 pt-1">
        <button type="button" className="mr-auto inline-flex min-h-11 basis-full items-center gap-1.5 rounded-btn px-2 text-xs font-semibold text-accent hover:bg-accent-soft disabled:opacity-50 min-[375px]:basis-auto" aria-label={`Ghi chi tiêu tại ${stop.name}`} disabled={disabled} onClick={onAddExpense}><Wallet className="size-3.5 shrink-0" aria-hidden="true" />+ Ghi chi tiêu</button>
        <button type="button" className="inline-flex min-h-11 items-center gap-1.5 rounded-btn px-3 text-xs font-medium text-accent hover:bg-accent-soft disabled:opacity-50" aria-label={`Sửa ${stop.name}`} disabled={disabled} onClick={onEdit}><Pencil className="size-3.5" aria-hidden="true" />Sửa</button>
        <button type="button" className="inline-flex min-h-11 items-center gap-1.5 rounded-btn px-3 text-xs font-medium text-state-error hover:bg-state-error/5 disabled:opacity-50" aria-label={`Xóa ${stop.name}`} disabled={disabled} onClick={onDelete}><Trash2 className="size-3.5" aria-hidden="true" />Xóa</button>
      </div>
    </article>
    {next && <div className="px-1 pt-2.5" role="group" aria-label={`Di chuyển đến ${next.name}`}>
      {leg ? <LegEstimate leg={leg} vehicle={vehicle} /> : missingGps ? <p className="flex items-center gap-2 text-xs leading-5 text-text-muted">
        <MapPinOff className="size-4 shrink-0" aria-hidden="true" />Chưa có ước tính (Thiếu tọa độ GPS)
      </p> : <p className="text-xs leading-5 text-text-muted">Đang tính quãng đường…</p>}
    </div>}
  </li>;
}
