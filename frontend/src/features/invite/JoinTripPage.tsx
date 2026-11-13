import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, Link2Off, Mountain } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, errorMessage } from '../../services/api';
import { useTrip } from '../../context/TripContext';
import { ROAD_IMAGE } from '../../types/api';
import type { InvitePreview } from '../../types/api';
import { Button } from '../../components/ui/Button';
import { ErrorNotice, Loading } from '../../components/ui/Feedback';

export function JoinTripPage() {
  const { token = '' } = useParams();
  const { user, refresh, sessionChecked, error: workspaceError } = useTrip();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setPreview(null); setError(null);
    api<InvitePreview>(`/invites/${encodeURIComponent(token)}`, { signal: controller.signal }).then(setPreview).catch((reason: unknown) => { if (!controller.signal.aborted) setError(errorMessage(reason)); });
    return () => controller.abort();
  }, [token, attempt]);

  async function join(event: FormEvent) {
    event.preventDefault();
    if (busy || !sessionChecked) return;
    const displayName = user?.displayName ?? name.trim();
    if (!displayName) { setError('Hãy nhập tên của bạn.'); return; }
    setBusy(true); setError(null);
    try {
      const result = await api<{ success: true; tripId: string; memberId: string }>(`/invites/${encodeURIComponent(token)}/join`, { method: 'POST', body: { displayName } });
      await refresh(result.tripId);
      navigate('/', { replace: true });
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 400) setPreview({ valid: false, message: reason.message });
      else setError(errorMessage(reason));
    } finally { setBusy(false); }
  }

  return <div className="flex min-h-dvh flex-col">
    <header className="flex min-h-16 items-center gap-2 border-b border-border-main bg-surface px-5 pt-[env(safe-area-inset-top)]"><Mountain aria-hidden="true" className="size-6 text-accent" strokeWidth={1.5} /><Link to="/" className="font-serif text-xl font-bold text-accent">HaGiangWiki</Link></header>
    <img src={ROAD_IMAGE} alt="Cung đèo Hà Giang giữa núi rừng" className="h-48 w-full object-cover" />
    <main className="flex-1 px-5 py-8">
      {!preview && !error && <Loading label="Đang mở lời mời…" />}
      {!preview && error && <div className="space-y-4"><ErrorNotice>{error}</ErrorNotice><Button className="w-full" onClick={() => setAttempt((value) => value + 1)}>Thử lại</Button></div>}
      {preview?.valid === false && <div><Link2Off className="mb-5 size-9 text-route" aria-hidden="true" /><h1 className="font-serif text-[32px] font-bold leading-tight">Lời mời không còn hiệu lực.</h1><p className="mb-6 mt-4 text-sm leading-6 text-text-muted">Mã mời không tồn tại, đã hết hạn hoặc đã được sử dụng.</p><Button className="w-full" onClick={() => navigate('/', { replace: true })}>Về trang chủ</Button></div>}
      {preview?.valid && <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-route">Lời mời đồng hành</p>
        <h1 className="font-serif text-[32px] font-bold leading-[1.15]">Hà Giang, cùng nhau lên đường.</h1>
        <p className="mb-7 mt-4 break-words text-sm leading-7 text-text-muted"><strong className="font-semibold text-text-main">{preview.ownerName}</strong> mời bạn cùng tham gia chuyến đi <strong className="font-semibold text-text-main">{preview.tripTitle}</strong> ({preview.durationDays} ngày).</p>
        <form onSubmit={(event) => { void join(event); }} className="space-y-4">
          {!sessionChecked && (workspaceError ? <div className="space-y-3"><ErrorNotice>{workspaceError}</ErrorNotice><Button tone="secondary" onClick={() => { void refresh(); }}>Thử lại kết nối</Button></div> : <Loading label="Đang chuẩn bị…" />)}
          {user ? <div className="rounded-card border border-border-main bg-surface p-4 text-sm leading-6">Bạn đang dùng tên <strong>{user.displayName}</strong>.</div> : <div><label htmlFor="partner-name" className="field-label">Tên của bạn</label><input id="partner-name" className="field" placeholder="Ví dụ: Linh" autoComplete="given-name" maxLength={50} required value={name} onChange={(event) => { setName(event.target.value); setError(null); }} /></div>}
          {error && <ErrorNotice>{error}</ErrorNotice>}
          <Button className="w-full text-base" type="submit" disabled={busy || !sessionChecked}>{busy ? 'Đang tham gia…' : !sessionChecked ? 'Đang chuẩn bị…' : 'Cùng nhau lên đường'}{!busy && <ArrowRight className="size-5" aria-hidden="true" />}</Button>
          <p className="text-center text-xs leading-5 text-text-muted">Một hành trình. Hai người đồng hành.</p>
        </form>
      </div>}
    </main>
  </div>;
}
