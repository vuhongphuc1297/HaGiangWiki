import { Bike, Car } from 'lucide-react';
import type { RouteLeg, Trip } from '../../types/api';
import { vehicleNames } from '../../utils/format';
import { formatDistance } from './useDayRoutes';

export function LegEstimate({ leg, vehicle }: { leg: RouteLeg; vehicle: Trip['vehicle'] }) {
  const roadVehicle = vehicle === 'O_TO' ? 'O_TO' : 'XE_MAY';
  const Icon = roadVehicle === 'O_TO' ? Car : Bike;
  return <div className="flex items-start gap-2 text-xs leading-5 text-text-muted">
    <Icon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
    <div className="min-w-0">
      <span className="block font-medium text-text-main">{formatDistance(leg.distanceKm)} · {leg.durationFormatted} · {vehicleNames[roadVehicle]}</span>
      {leg.isFallback && <span className="block text-state-warning">Ước tính đường đèo</span>}
    </div>
  </div>;
}
