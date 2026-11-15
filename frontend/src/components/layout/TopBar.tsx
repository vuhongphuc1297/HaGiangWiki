import { Check, CircleAlert, LoaderCircle, Plus, RefreshCw, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { TripMember } from '../../types/api';
import { initial } from '../../utils/format';
import { cn } from '../../lib/utils';

export function TopBar({ members = [], loading = false, saving = false, syncing = false, error = false, onSettings, onRefresh, onMembers }: { members?: TripMember[]; loading?: boolean; saving?: boolean; syncing?: boolean; error?: boolean; onSettings: () => void; onRefresh: () => void; onMembers: () => void }) {
  const active = members.filter((member) => member.status === 'ACTIVE').slice(0, 2);
  const status = error ? 'Chưa đồng bộ' : saving ? 'Đang lưu…' : loading ? 'Đang tải…' : syncing ? 'Đang đồng bộ…' : 'Đã lưu';
  return <header className="sticky top-0 z-30 border-b border-border-main bg-surface pt-[env(safe-area-inset-top)]">
    <div className="flex min-h-16 items-center gap-1 px-2 min-[375px]:gap-1.5 min-[375px]:px-3">
      <Link to="/" className="min-w-0 flex-1 whitespace-nowrap font-serif text-lg font-bold tracking-tight text-accent min-[375px]:text-[21px]">HaGiangWiki</Link>
      {active.length > 0 && <button type="button" disabled={loading || saving} onClick={onMembers} aria-haspopup="dialog" aria-label={`Quản lý thành viên chuyến đi (${active.length}/2 người)`} title="Xem danh sách thành viên" className="inline-flex min-h-11 min-w-11 shrink-0 items-center -space-x-1.5 rounded-btn px-1 transition-all hover:bg-accent-soft hover:opacity-90 active:scale-95 disabled:opacity-50 motion-reduce:transform-none motion-reduce:transition-none">
        {active.map((member) => <span key={member.id} aria-hidden="true" className={cn('flex size-7 items-center justify-center rounded-full border-2 border-surface font-serif text-xs font-semibold', member.role === 'OWNER' ? 'bg-accent-soft text-accent' : 'bg-route/10 text-route')}>{initial(member.displayName?.trim() || member.nickname)}</span>)}
        {active.length === 1 && <span title="Chạm để mời bạn đồng hành" aria-hidden="true" className="flex size-7 items-center justify-center rounded-full border-2 border-dashed border-accent/60 bg-surface text-accent"><Plus className="size-3.5" /></span>}
      </button>}
      <span role="status" aria-label={status} title={status} className="sr-only min-[375px]:not-sr-only min-[375px]:shrink-0"><span className={cn('inline-flex items-center gap-1 rounded-btn px-1.5 py-1.5 text-[10px] font-medium', error ? 'bg-state-warning/10 text-state-warning' : 'bg-accent-soft text-accent')}>
        {error ? <CircleAlert aria-hidden="true" className="size-3.5" /> : loading || saving || syncing ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" /> : <Check aria-hidden="true" className="size-3.5" />}
        <span className="sr-only">{status}</span>
      </span></span>
      <button type="button" className="icon-button shrink-0" aria-label="Làm mới dữ liệu" title="Làm mới dữ liệu" aria-busy={syncing || loading} disabled={loading || saving || syncing} onClick={onRefresh}><RefreshCw aria-hidden="true" className={cn('size-5', (syncing || loading) && 'animate-spin motion-reduce:animate-none')} strokeWidth={1.7} /></button>
      <button type="button" className="icon-button shrink-0" aria-label="Cài đặt chuyến đi" disabled={loading || saving} onClick={onSettings}><Settings aria-hidden="true" className="size-5" strokeWidth={1.7} /></button>
    </div>
  </header>;
}
