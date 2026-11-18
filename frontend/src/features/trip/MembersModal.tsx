import { Check, UserPlus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';
import { cn } from '../../lib/utils';
import type { Trip } from '../../types/api';
import { initial } from '../../utils/format';

export function MembersModal({ trip, currentUserId, isOwner, onClose, onInvite }: {
  trip: Trip; currentUserId?: string; isOwner: boolean; onClose: () => void; onInvite: () => void;
}) {
  const active = trip.members.filter((member) => member.status === 'ACTIVE');
  const full = active.length >= 2;
  const canInvite = isOwner && !trip.readOnly && active.length === 1;

  return <Sheet open title="Thành viên chuyến đi" onClose={onClose}>
    <div className="mb-5 flex items-start justify-between gap-3">
      <p className="min-w-0 break-words text-sm leading-6 text-text-muted [overflow-wrap:anywhere]">{trip.title}</p>
      <span className="shrink-0 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold leading-5 text-accent">{active.length}/2 người</span>
    </div>
    <ul aria-label="Danh sách thành viên đang hoạt động" className="space-y-3">
      {active.map((member) => {
        const owner = member.role === 'OWNER';
        const name = member.displayName?.trim() || member.nickname;
        return <li key={member.id} className="flex items-start gap-3 rounded-card border border-border-main bg-bg-page p-4">
          <span aria-hidden="true" className={cn('flex size-12 shrink-0 items-center justify-center rounded-full font-serif text-xl font-semibold', owner ? 'bg-accent/10 text-accent' : 'bg-route/10 text-route')}>{initial(name)}</span>
          <div className="min-w-0 flex-1">
            <p className="break-words text-base font-semibold leading-6 [overflow-wrap:anywhere]">{name}{member.userId === currentUserId && currentUserId && <span className="ml-1.5 text-xs font-normal text-text-muted">(Bạn)</span>}</p>
            <span className={cn('mt-2 inline-block rounded-btn px-2 py-1 text-xs font-medium leading-5', owner ? 'bg-accent/10 text-accent' : 'bg-route/10 text-route')}>{owner ? 'Trưởng nhóm / Người tạo' : 'Bạn đồng hành / Người tham gia'}</span>
          </div>
        </li>;
      })}
    </ul>
    {!full && <div className="mt-3 flex items-start gap-3 rounded-card border border-dashed border-border-main p-4 text-text-muted">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-bg-page"><UserPlus className="size-5" aria-hidden="true" /></span>
      <div className="min-w-0 py-1"><p className="text-sm font-semibold leading-6">Chưa có người đồng hành</p><p className="mt-1 text-xs leading-5">Một người bạn cùng chuẩn bị cho hành trình.</p></div>
    </div>}
    {trip.readOnly ? <p className="mt-5 text-sm leading-6 text-text-muted">Đây là lịch trình mẫu. Tạo chuyến đi của bạn để mời người đồng hành.</p> : full ? <div role="status" className="mt-5 flex items-start gap-2 rounded-card bg-accent-soft p-4 text-sm leading-6 text-accent"><Check className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><p>Chuyến đi 2 người đã đầy đủ thành viên. Hai bạn đã có thể cùng nhau lên lịch trình.</p></div> : !canInvite && <p className="mt-5 text-sm leading-6 text-text-muted">Chỉ trưởng nhóm mới có quyền tạo liên kết mời bạn đồng hành.</p>}
    {canInvite && <Button className="mt-5 w-full" onClick={onInvite}><UserPlus className="size-5" aria-hidden="true" />Mời người đồng hành</Button>}
    <Button tone="secondary" className="mt-3 w-full" onClick={onClose}>Về lịch trình</Button>
  </Sheet>;
}
