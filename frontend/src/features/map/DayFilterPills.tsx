import { cn } from '../../lib/utils';

type DayFilter = { day: number | null; label: string; count: number };

export function DayFilterPills({ filters, activeDay, onChange }: {
  filters: DayFilter[];
  activeDay: number | null;
  onChange: (day: number | null) => void;
}) {
  return <div role="group" aria-label="Lọc điểm dừng theo ngày" className="day-tabs flex gap-2 overflow-x-auto border-b border-border-main bg-bg-page px-3 py-2.5">
    {filters.map(({ day, label, count }) => {
      const active = day === activeDay;
      return <button key={day ?? 'all'} type="button" aria-pressed={active} className={cn(
        'min-h-11 shrink-0 rounded-full border px-3 text-xs font-semibold focus-visible:outline-offset-1',
        active ? 'border-accent bg-accent text-surface' : 'border-border-main bg-surface text-text-main hover:bg-accent-soft',
      )} onClick={(event) => {
        onChange(day);
        event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }}>
        {label} <span className={active ? 'text-surface/85' : 'text-text-muted'}>({count})</span>
      </button>;
    })}
  </div>;
}
