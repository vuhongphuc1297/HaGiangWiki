import { ArrowRight, CalendarDays, UserPlus } from 'lucide-react';
import { ROAD_IMAGE } from '../../types/api';
import type { Trip } from '../../types/api';
import { dateRange, vehicleNames } from '../../utils/format';

export function TripHero({ trip, isDemo, isOwner, onInvite, onUseTemplate }: { trip: Trip; isDemo: boolean; isOwner: boolean; onInvite: () => void; onUseTemplate: () => void }) {
  const activeMembers = trip.members.filter((member) => member.status === 'ACTIVE');
  const title = trip.title === 'Hà Giang · Explore the Loop' ? ['Hà Giang', 'Explore the Loop'] : null;
  return <section aria-label="Chuyến đi hiện tại">
    <div className="relative">
      <img src={ROAD_IMAGE} alt="Cung đèo Hà Giang uốn quanh những dãy núi xanh" fetchPriority="high" className="h-32 w-full object-cover object-right" />
      {isDemo && <span className="absolute left-4 top-3 rounded-btn bg-surface/95 px-2.5 py-1.5 text-[10px] font-semibold text-text-muted">Lịch trình mẫu</span>}
      {isDemo ? <button type="button" onClick={onUseTemplate} className="absolute right-4 top-3 inline-flex min-h-11 items-center gap-2 rounded-btn border border-border-main bg-surface px-3 py-2 text-xs font-semibold text-accent">Dùng lịch trình này<ArrowRight className="size-4" aria-hidden="true" /></button> : isOwner && activeMembers.length < 2 && <button type="button" onClick={onInvite} className="absolute right-4 top-3 inline-flex min-h-11 items-center gap-2 rounded-btn border border-border-main bg-surface px-3 py-2 text-xs font-semibold text-accent"><UserPlus className="size-4" aria-hidden="true" />Mời bạn</button>}
    </div>
    <div className="px-5 pb-2 pt-4">
      <h1 aria-label={trip.title} className="break-words font-serif text-[32px] font-bold leading-[1.1] tracking-[-0.02em]">{title ? <>{title[0]}<span className="mt-1 block text-2xl font-semibold tracking-normal">{title[1]}</span></> : trip.title}</h1>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
        <p>{trip.durationDays} ngày · {vehicleNames[trip.vehicle]} · {activeMembers.length} người</p>
        <span className="inline-flex items-center gap-1.5 rounded-btn bg-accent-soft px-2 py-1.5 text-accent"><CalendarDays className="size-3.5" aria-hidden="true" />{dateRange(trip.startDate, trip.durationDays)}</span>
      </div>
    </div>
  </section>;
}
