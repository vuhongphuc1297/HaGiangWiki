import { useEffect, useRef, useState } from 'react';
import { Check, Clock3, Copy, Mountain, Plus, TriangleAlert } from 'lucide-react';
import { api, errorMessage } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { ErrorNotice, Loading } from '../../components/ui/Feedback';
import { Sheet } from '../../components/ui/Sheet';
import { ROAD_IMAGE } from '../../types/api';
import type { Invite, Trip } from '../../types/api';
import { dateRange, initial } from '../../utils/format';

export function InviteModal({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef<Promise<Invite> | null>(null);
  const copyTimer = useRef<number | undefined>(undefined);
  const linkInput = useRef<HTMLInputElement>(null);
  const owner = trip.members.find((member) => member.role === 'OWNER');

  useEffect(() => {
    let active = true;
    if (!pending.current) pending.current = api<Invite>(`/trips/${trip.id}/invites`, { method: 'POST' });
    pending.current.then((data) => { if (active) { setInvite(data); setError(null); } }).catch((reason: unknown) => {
      if (active) setError(errorMessage(reason));
      pending.current = null;
    });
    return () => { active = false; };
  }, [trip.id, attempt]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  async function copy() {
    if (!invite) return;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(invite.inviteUrl);
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      linkInput.current?.focus();
      linkInput.current?.select();
      setCopyError('Hãy chạm giữ liên kết và chọn Sao chép.');
    }
  }

  return <Sheet open title="Cùng nhau lên đường." onClose={onClose}>
    <img src={ROAD_IMAGE} alt="Cung đường giữa núi rừng Hà Giang" className="mb-5 h-32 w-full rounded-card object-cover" />
    <div className="mb-3 flex items-center justify-center gap-3" aria-label="Bạn và người đồng hành">
      <span className="flex size-14 items-center justify-center rounded-full bg-border-main/70 font-serif text-2xl">{initial(owner?.nickname ?? 'Bạn')}</span>
      <span className="flex size-14 items-center justify-center rounded-full border border-dashed border-text-muted"><Plus aria-hidden="true" className="size-6 text-accent" /></span>
    </div>
    <p className="text-center text-sm text-text-muted">Chuyến đi dành cho 2 người</p>
    <p className="my-4 text-sm leading-6 text-text-muted">Mời một người cùng xếp lịch, ghi chi tiêu và chuẩn bị hành lý.</p>
    <div className="mb-5 flex items-center gap-3 rounded-card border border-border-main p-3">
      <Mountain aria-hidden="true" className="size-8 shrink-0 text-accent" strokeWidth={1.4} />
      <div className="min-w-0"><p className="break-words font-serif text-lg font-bold leading-6">{trip.title}</p><p className="mt-1 text-xs text-text-muted">{dateRange(trip.startDate, trip.durationDays)} · {trip.durationDays} ngày</p></div>
    </div>
    {!invite && !error && <Loading label="Đang tạo liên kết mời…" />}
    {error && <div className="space-y-3"><ErrorNotice>{error}</ErrorNotice><Button tone="secondary" className="w-full" onClick={() => { setError(null); setAttempt((value) => value + 1); }}>Thử lại</Button></div>}
    {invite && <div>
      <label htmlFor="invite-url" className="field-label font-serif text-xl">Liên kết mời</label>
      <div className="relative mb-3"><input id="invite-url" ref={linkInput} className="field pr-12 text-sm" value={invite.inviteUrl} readOnly onFocus={(event) => event.currentTarget.select()} /><button type="button" onClick={() => { void copy(); }} aria-label="Sao chép liên kết mời" className="icon-button absolute right-0.5 top-0.5"><Copy className="size-5" aria-hidden="true" /></button></div>
      <Button className="w-full" aria-label={copied ? 'Đã sao chép liên kết!' : 'Sao chép liên kết'} onClick={() => { void copy(); }}>{copied ? <Check className="size-5" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}<span role="status">{copied ? 'Đã sao chép liên kết!' : 'Sao chép liên kết'}</span></Button>
      {copyError && <p role="status" className="mt-2 text-xs leading-5 text-text-muted">{copyError}</p>}
    </div>}
    <div className="mt-5 flex gap-3 rounded-btn bg-accent-soft p-3 text-accent"><Clock3 className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><p className="text-sm"><strong className="block font-semibold">Có hiệu lực trong 48 giờ</strong><span className="mt-1 block text-xs leading-5">Chỉ dùng một lần cho người đồng hành.</span></p></div>
    <div className="mt-3 flex items-center gap-2 rounded-btn bg-state-warning/10 p-3 text-xs leading-5 text-state-warning"><TriangleAlert className="size-5 shrink-0" aria-hidden="true" />Chỉ chia sẻ với người bạn muốn mời.</div>
  </Sheet>;
}
