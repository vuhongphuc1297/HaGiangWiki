import { useMemo, useState } from 'react';
import { ChevronRight, MapPinOff, Route } from 'lucide-react';
import type { Stop, Trip } from '../../types/api';
import { DayFilterPills } from './DayFilterPills';
import { MapContainer } from './MapContainer';
import type { MapStop } from './MapContainer';
import { UnmappedPlacesDrawer } from './UnmappedPlacesDrawer';
import { formatDistance, formatTravelDuration, useDayRoutes } from '../external/useDayRoutes';

function groupStops(stops: Stop[], durationDays: number) {
  const dayOrder = (day: number) => day === 0 ? durationDays + 1 : day;
  const ordered = [...stops].sort((a, b) => dayOrder(a.day) - dayOrder(b.day) || a.orderIndex - b.orderIndex || a.id.localeCompare(b.id));
  const points: MapStop[] = [];
  const unmapped: Stop[] = [];
  const counts = new Map<number, number>();

  ordered.forEach((stop, index) => {
    const { latitude, longitude } = stop;
    if (latitude === null || longitude === null) {
      unmapped.push(stop);
      return;
    }
    points.push({ stop, position: [latitude, longitude], number: String(index + 1).padStart(2, '0') });
    counts.set(stop.day, (counts.get(stop.day) ?? 0) + 1);
  });

  return { points, unmapped, counts };
}

export function MapPage({ trip, isDemo, onSelectStop, onAddCoordinates }: {
  trip: Trip;
  isDemo: boolean;
  onSelectStop: (stop: Stop) => void;
  onAddCoordinates: (stop: Stop) => void;
}) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { points, unmapped, counts } = useMemo(() => groupStops(trip.stops, trip.durationDays), [trip.stops, trip.durationDays]);
  const hasPool = trip.stops.some((stop) => stop.day === 0);
  const activeDay = selectedDay !== null && (selectedDay === 0 ? hasPool : selectedDay <= trip.durationDays) ? selectedDay : null;
  const visible = useMemo(() => activeDay === null ? points : points.filter(({ stop }) => stop.day === activeDay), [points, activeDay]);
  const { summaries, loading: routesLoading } = useDayRoutes(trip, activeDay, isDemo);
  const legs = summaries.flatMap((summary) => summary.legs);
  const fallback = legs.some((leg) => leg.isFallback);
  const totalKm = legs.reduce((total, leg) => total + leg.distanceMeters, 0) / 1000;
  const totalSeconds = legs.reduce((total, leg) => total + leg.durationSeconds, 0);
  const filters = [
    { day: null, label: 'Tất cả', count: points.length },
    ...Array.from({ length: trip.durationDays }, (_, index) => ({
      day: index + 1, label: `Ngày ${index + 1}`, count: counts.get(index + 1) ?? 0,
    })),
    ...(hasPool ? [{ day: 0, label: 'Kho tạm', count: counts.get(0) ?? 0 }] : []),
  ];

  return <section className="flex min-h-0 flex-1 flex-col" aria-label="Bản đồ chuyến đi">
    <DayFilterPills filters={filters} activeDay={activeDay} onChange={setSelectedDay} />
    {activeDay !== 0 && <div role="status" className="flex items-start gap-2 border-b border-border-main bg-surface px-4 py-2 text-xs leading-5">
      <Route className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-semibold text-text-main">
          <span className="text-accent">{activeDay === null ? 'Toàn tuyến' : `Ngày ${activeDay}`}</span>
          {routesLoading ? ' · Đang tính đường đi…' : legs.length > 0
            ? ` · ${formatDistance(totalKm)} · ${formatTravelDuration(totalSeconds)} lái xe` : ' · Chưa đủ điểm GPS để tính đường đi'}
        </p>
        <div className="flex flex-wrap gap-x-2">
          {fallback && <p className="text-state-warning">Nét đứt · Ước tính đường đèo</p>}
          {summaries.some(({ unmappedStopsCount }) => unmappedStopsCount > 0) && <p className="text-text-muted">Chỉ tính giữa các điểm có GPS</p>}
        </div>
      </div>
    </div>}
    <MapContainer trip={trip} isDemo={isDemo} points={visible} activeDay={activeDay} summaries={summaries} onSelectStop={onSelectStop} />
    {unmapped.length > 0 && <div className="border-t border-border-main bg-bg-page px-3 py-2">
      <div className="flex items-center gap-2 rounded-card border border-state-warning/20 bg-[#FBEDD2] px-3 text-state-warning">
        <MapPinOff className="size-4 shrink-0" aria-hidden="true" />
        <p className="flex-1 py-2 text-xs font-medium leading-5">Có {unmapped.length} địa điểm chưa có tọa độ trên bản đồ</p>
        <button type="button" aria-haspopup="dialog" className="inline-flex min-h-11 shrink-0 items-center gap-0.5 text-xs font-semibold underline underline-offset-2" onClick={() => setDrawerOpen(true)}>
          Xem danh sách <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>}
    {drawerOpen && unmapped.length > 0 && <UnmappedPlacesDrawer stops={unmapped} isDemo={isDemo} onClose={() => setDrawerOpen(false)} onAddCoordinates={(stop) => {
      setDrawerOpen(false);
      onAddCoordinates(stop);
    }} />}
  </section>;
}
