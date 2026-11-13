import { Backpack, CalendarDays, MapPin, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

export type MainTab = 'itinerary' | 'map' | 'expenses' | 'packing';
const tabs = [
  { id: 'itinerary', label: 'Lịch trình', icon: CalendarDays },
  { id: 'map', label: 'Bản đồ', icon: MapPin },
  { id: 'expenses', label: 'Chi tiêu', icon: Wallet },
  { id: 'packing', label: 'Hành lý', icon: Backpack },
] as const;

export function BottomNav({ active }: { active: MainTab }) {
  return <nav aria-label="Điều hướng chính" className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[420px] border-t border-border-main bg-surface pb-[env(safe-area-inset-bottom)]">
    <div className="grid h-[76px] grid-cols-4">
      {tabs.map(({ id, label, icon: Icon }) => <Link key={id} to={id === 'itinerary' ? '/' : `/?tab=${id}`} aria-current={active === id ? 'page' : undefined} className={cn('relative flex min-w-0 flex-col items-center justify-center gap-1.5 pb-2 text-xs', active === id ? 'font-semibold text-accent' : 'text-text-muted')}>
        <Icon className="size-[23px]" aria-hidden="true" strokeWidth={1.7} /><span>{label}</span>
        {active === id && <span aria-hidden="true" className="absolute bottom-1.5 h-[3px] w-9 rounded-full bg-accent" />}
      </Link>)}
    </div>
  </nav>;
}
