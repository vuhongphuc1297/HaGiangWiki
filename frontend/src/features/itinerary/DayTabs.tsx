import { cn } from '../../lib/utils';
import type { Trip } from '../../types/api';

export function DayTabs({ trip, day, onChange, disabled = false }: { trip: Trip; day: number; onChange: (day: number) => void; disabled?: boolean }) {
  return <div role="tablist" aria-label="Ngày trong hành trình" className="day-tabs flex gap-2 overflow-x-auto px-5 py-3">
    {Array.from({ length: trip.durationDays + 1 }, (_, value) => <button key={value} id={`day-tab-${value}`} type="button" role="tab" disabled={disabled} tabIndex={day === value ? 0 : -1} aria-selected={day === value} onKeyDown={(event) => {
      if (disabled) return;
      const next = event.key === 'ArrowRight' ? (value + 1) % (trip.durationDays + 1) : event.key === 'ArrowLeft' ? (value + trip.durationDays) % (trip.durationDays + 1) : event.key === 'Home' ? 0 : event.key === 'End' ? trip.durationDays : null;
      if (next !== null) { event.preventDefault(); onChange(next); const target = document.getElementById(`day-tab-${next}`); target?.focus(); target?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    }} aria-controls="day-panel" onClick={(event) => { onChange(value); event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }} className={cn('min-h-11 shrink-0 rounded-btn border px-3.5 py-2.5 text-xs font-medium disabled:opacity-60', day === value ? 'border-accent bg-accent text-surface' : 'border-border-main bg-surface text-text-main hover:bg-accent-soft')}>
      {value === 0 ? 'Kho tạm' : `Ngày ${value}`} <span className={day === value ? 'text-surface/80' : 'text-text-muted'}>({trip.stops.filter((stop) => stop.day === value).length})</span>
    </button>)}
  </div>;
}
