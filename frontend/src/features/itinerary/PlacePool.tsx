import { useState } from 'react';
import { ArrowRight, MapPin, Pencil, Search, Trash2 } from 'lucide-react';
import type { Stop, Trip } from '../../types/api';
import { searchable } from '../../utils/format';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';

export function PlacePool({ trip, onAssign, onEdit, onDelete, disabled = false }: { trip: Trip; onAssign: (stop: Stop) => void; onEdit: (stop: Stop) => void; onDelete: (stop: Stop) => void; disabled?: boolean }) {
  const [query, setQuery] = useState('');
  const pool = trip.stops.filter((stop) => stop.day === 0);
  const filtered = pool.filter((stop) => searchable(`${stop.name} ${stop.category ?? ''} ${stop.notes ?? ''}`).includes(searchable(query)));
  return <section id="day-panel" role="tabpanel" aria-labelledby="day-tab-0" className="px-5 pt-5">
    <h2 className="font-serif text-[28px] font-bold leading-tight">Để dành cho chuyến đi.</h2>
    <p className="mb-5 mt-2 text-sm text-text-muted">{pool.length} địa điểm chưa xếp lịch</p>
    <label htmlFor="pool-search" className="sr-only">Tìm địa điểm đã lưu</label>
    <div className="relative mb-5"><Search aria-hidden="true" className="absolute left-3 top-3.5 size-5 text-text-muted" /><input id="pool-search" type="search" autoComplete="off" placeholder="Tìm địa điểm đã lưu" className="field pl-10 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    <div className="space-y-3">{filtered.map((stop) => {
      const mapped = stop.latitude !== null && stop.longitude !== null;
      const sampleMetadata = stop.notes?.endsWith(' · Chưa có GPS') ? stop.notes.replace(' · Chưa có GPS', '') : null;
      return <article key={stop.id} className="rounded-card border border-border-main bg-surface p-4">
        <h3 className="break-words font-serif text-xl font-bold leading-6">{stop.name}</h3>
        {(sampleMetadata || stop.category) && <p className="mt-1 text-xs text-text-muted">{sampleMetadata ?? stop.category}</p>}
        <span className={cn('mt-3 inline-flex items-center gap-1.5 rounded-btn px-2 py-1 text-[11px] font-medium', mapped ? 'bg-accent-soft text-accent' : 'bg-state-warning/10 text-state-warning')}><MapPin className="size-3.5" aria-hidden="true" />{mapped ? 'Đã có tọa độ' : 'Chưa có GPS'}</span>
        {stop.notes && !sampleMetadata && <p className="mt-3 whitespace-pre-line break-words text-xs leading-5 text-text-muted">{stop.notes}</p>}
        <div className="mt-3 flex justify-end gap-1 border-t border-border-main/60 pt-1">
          <button type="button" className="inline-flex min-h-11 items-center gap-1.5 rounded-btn px-3 text-xs font-medium text-accent hover:bg-accent-soft disabled:opacity-50" aria-label={`Sửa ${stop.name}`} disabled={disabled} onClick={() => onEdit(stop)}><Pencil className="size-3.5" aria-hidden="true" />Sửa</button>
          <button type="button" className="inline-flex min-h-11 items-center gap-1.5 rounded-btn px-3 text-xs font-medium text-state-error hover:bg-state-error/5 disabled:opacity-50" aria-label={`Xóa ${stop.name}`} disabled={disabled} onClick={() => onDelete(stop)}><Trash2 className="size-3.5" aria-hidden="true" />Xóa</button>
        </div>
        <Button tone="secondary" className="mt-2 min-h-11 w-full py-2 text-xs" disabled={disabled} onClick={() => onAssign(stop)}>Xếp vào ngày<ArrowRight className="size-4" aria-hidden="true" /></Button>
      </article>;
    })}</div>
    {filtered.length === 0 && <div className="py-8 text-center"><MapPin className="mx-auto mb-3 size-7 text-route" aria-hidden="true" /><p className="font-serif text-xl font-semibold">{query ? 'Chưa tìm thấy địa điểm này.' : 'Kho tạm đang để ngỏ.'}</p><p className="mt-2 text-sm leading-6 text-text-muted">{query ? 'Thử tên hoặc loại địa điểm khác.' : 'Lưu những nơi bạn muốn ghé, rồi xếp lịch sau.'}</p>{query && <Button tone="quiet" onClick={() => setQuery('')}>Xóa tìm kiếm</Button>}</div>}
    <p className="mt-5 text-center font-serif text-base italic text-text-muted">Lưu trước, xếp lịch sau.</p>
  </section>;
}
