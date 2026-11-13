import { Bike, MapPin } from 'lucide-react';
import type { Stop, Trip } from '../../types/api';
import { money, shortDate } from '../../utils/format';

export function Timeline({ trip, day }: { trip: Trip; day: number }) {
  const stops = trip.stops.filter((stop) => stop.day === day);
  const first = stops[0];
  const last = stops[stops.length - 1];
  const title = first && last && first.id !== last.id ? `${first.name.replace(/^TP\.\s*/, '')} → ${last.name}` : `Ngày ${day} của hành trình`;
  return <section id="day-panel" role="tabpanel" aria-labelledby={`day-tab-${day}`} className="px-5 pt-3">
    <h2 className="break-words font-serif text-2xl font-bold leading-tight">{title}</h2>
    <p className="mb-5 mt-1 text-xs text-text-muted">{shortDate(trip.startDate, day)} · {stops.length} điểm dừng</p>
    {stops.length === 0 ? <div className="rounded-card border border-dashed border-border-main px-5 py-8 text-center"><MapPin className="mx-auto mb-3 size-7 text-route" aria-hidden="true" /><h3 className="font-serif text-xl font-semibold">Một ngày để khám phá.</h3><p className="mt-2 text-sm leading-6 text-text-muted">Thêm địa điểm hoặc xếp một điểm từ Kho tạm vào ngày này.</p></div> : <ol className="space-y-4">
      {stops.map((stop, index) => <TimelineStop key={stop.id} stop={stop} index={index} last={index === stops.length - 1} next={stops[index + 1]} />)}
    </ol>}
  </section>;
}

function TimelineStop({ stop, index, last, next }: { stop: Stop; index: number; last: boolean; next?: Stop }) {
  const sampleTravel = stop.name === 'TP. Hà Giang' && next?.name === 'Cổng trời Quản Bạ';
  return <li className="relative pl-11">
    {!last && <span aria-hidden="true" className="absolute bottom-[-17px] left-[14px] top-7 w-px bg-route/50" />}
    <span className="absolute left-0 top-1 flex size-[30px] items-center justify-center rounded-full bg-route text-xs font-medium tabular-nums text-surface">{String(index + 1).padStart(2, '0')}</span>
    <article className="rounded-card border border-border-main bg-surface p-3">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] leading-5">
        {(stop.arriveTime || stop.leaveTime) && <p className="font-medium tabular-nums">{stop.arriveTime ?? '—'} – {stop.leaveTime ?? '—'}</p>}
        {stop.category && <span className="rounded-btn bg-accent-soft px-1.5 text-accent">{stop.category}</span>}
      </div>
      <h3 className="break-words font-serif text-xl font-bold leading-6">{stop.name}</h3>
      {BigInt(stop.estimatedCost) > 0n && <p className="mt-1 text-[11px] leading-5 text-text-muted">Dự toán {money(stop.estimatedCost)}</p>}
      {stop.notes && <p className="mt-1 whitespace-pre-line break-words text-xs leading-5 text-text-muted">{stop.notes}</p>}
    </article>
    {sampleTravel && <div className="flex items-start gap-2 pb-1 pt-3 text-[11px] leading-4 text-text-muted"><Bike className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" /><p>46 km · Khoảng 1 giờ 30<span className="block text-[10px] text-text-muted/80">Ước tính tham khảo theo lịch trình mẫu</span></p></div>}
  </li>;
}
