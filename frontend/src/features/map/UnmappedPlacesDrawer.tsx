import { Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';
import type { Stop } from '../../types/api';

export function UnmappedPlacesDrawer({ stops, isDemo, onClose, onAddCoordinates }: {
  stops: Stop[];
  isDemo: boolean;
  onClose: () => void;
  onAddCoordinates: (stop: Stop) => void;
}) {
  return <Sheet open title="Địa điểm chưa có tọa độ" onClose={onClose}>
    {isDemo && <p className="mb-2 text-sm leading-6 text-text-muted">Tạo chuyến đi từ lịch trình mẫu để bổ sung tọa độ.</p>}
    <ul className="divide-y divide-border-main">
      {stops.map((stop) => <li key={stop.id} className="py-3">
        <p className="break-words font-serif text-lg font-bold leading-tight">{stop.name}</p>
        <p className="mt-1 text-xs text-text-muted">{stop.day === 0 ? 'Kho tạm' : `Ngày ${stop.day}`}</p>
        {stop.notes && <p className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-text-muted">{stop.notes}</p>}
        <Button tone="secondary" className="mt-2 min-h-11" onClick={() => onAddCoordinates(stop)}>
          <Plus className="size-4" aria-hidden="true" />Thêm tọa độ
        </Button>
      </li>)}
    </ul>
  </Sheet>;
}
