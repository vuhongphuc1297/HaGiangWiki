import { useEffect, useRef, useState } from 'react';
import { Check, Clock3, Copy, Mountain, TriangleAlert } from 'lucide-react';
import { api, errorMessage } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { ErrorNotice, Loading } from '../../components/ui/Feedback';
import { Sheet } from '../../components/ui/Sheet';
import { ROAD_IMAGE } from '../../types/api';
import type { Invite, Trip } from '../../types/api';
import { dateRange } from '../../utils/format';

type CopyTarget = 'code' | 'link';

export function InviteModal({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef<Promise<Invite> | null>(null);
  const copyTimer = useRef<number | undefined>(undefined);
  const codeInput = useRef<HTMLInputElement>(null);
  const linkInput = useRef<HTMLTextAreaElement>(null);

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

  async function copy(target: CopyTarget) {
    const value = target === 'code' ? invite?.inviteCode : invite?.inviteUrl;
    if (!value) return;
    window.clearTimeout(copyTimer.current);
    setCopied(null);
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
      copyTimer.current = window.setTimeout(() => setCopied(null), 2_000);
    } catch {
      const input = target === 'code' ? codeInput.current : linkInput.current;
      input?.focus();
      input?.select();
      setCopyError(target === 'code' ? 'Hãy chọn Sao chép trong ô mã mời.' : 'Hãy chọn Sao chép trong ô liên kết.');
    }
  }

  return <Sheet open title="Cùng nhau lên đường." onClose={onClose}>
    <img src={ROAD_IMAGE} alt="Cung đường giữa núi rừng Hà Giang" className="mb-4 h-20 w-full rounded-card object-cover min-[375px]:h-24" />
    <div className="mb-5 flex items-center gap-3 rounded-card border border-border-main p-3">
      <Mountain aria-hidden="true" className="size-8 shrink-0 text-accent" strokeWidth={1.4} />
      <div className="min-w-0"><p className="break-words font-serif text-lg font-bold leading-6">{trip.title}</p><p className="mt-1 text-xs text-text-muted">{dateRange(trip.startDate, trip.durationDays)} · {trip.durationDays} ngày</p></div>
    </div>
    {!invite && !error && <Loading label="Đang tạo lời mời…" />}
    {error && <div className="space-y-3"><ErrorNotice>{error}</ErrorNotice><Button tone="secondary" className="w-full" onClick={() => { setError(null); setAttempt((value) => value + 1); }}>Thử lại</Button></div>}
    {invite && <div className="space-y-4">
      {invite.inviteCode && <div>
        <label htmlFor="invite-code" className="field-label font-serif text-xl">Mã mời 6 ký tự</label>
        <div className="flex items-stretch gap-2">
          <input id="invite-code" ref={codeInput} className="field min-w-0 bg-accent-soft font-mono text-xl font-bold tracking-[0.18em] text-accent" value={invite.inviteCode} readOnly onFocus={(event) => event.currentTarget.select()} />
          <Button tone="secondary" className="shrink-0 px-3" aria-label="Sao chép mã mời" onClick={() => { void copy('code'); }}>
            {copied === 'code' ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            <span role="status">{copied === 'code' ? 'Đã chép mã' : 'Chép mã'}</span>
          </Button>
        </div>
        <p className="mt-1.5 text-xs leading-5 text-text-muted">Bạn đồng hành nhập mã ở Trang chủ để tham gia.</p>
      </div>}
      <div>
        <label htmlFor="invite-url" className="field-label font-serif text-xl">Liên kết mời</label>
        <textarea id="invite-url" ref={linkInput} rows={2} className="field mb-2 block resize-none break-all text-sm" value={invite.inviteUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
        <Button className="w-full" aria-label={copied === 'link' ? 'Đã sao chép liên kết!' : 'Sao chép liên kết'} onClick={() => { void copy('link'); }}>
          {copied === 'link' ? <Check className="size-5" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          <span role="status">{copied === 'link' ? 'Đã sao chép liên kết!' : 'Sao chép liên kết'}</span>
        </Button>
      </div>
      {copyError && <p role="status" className="text-xs leading-5 text-text-muted">{copyError}</p>}
    </div>}
    <div className="mt-5 flex gap-3 rounded-btn bg-accent-soft p-3 text-accent"><Clock3 className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><p className="text-sm"><strong className="block font-semibold">Có hiệu lực trong 48 giờ</strong><span className="mt-1 block text-xs leading-5">Chỉ dùng một lần cho người đồng hành.</span></p></div>
    <div className="mt-3 flex items-center gap-2 rounded-btn bg-state-warning/10 p-3 text-xs leading-5 text-state-warning"><TriangleAlert className="size-5 shrink-0" aria-hidden="true" />Chỉ chia sẻ với người bạn muốn mời.</div>
  </Sheet>;
}
