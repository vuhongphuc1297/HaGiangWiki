import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ErrorNotice } from '../../components/ui/Feedback';
import { useTrip } from '../../context/TripContext';
import { ROAD_IMAGE } from '../../types/api';
import { inviteTokenFromInput } from './inviteInput';

export function LandingPage() {
  const { trip, user, error, loading, refresh } = useTrip();
  const navigate = useNavigate();
  const inviteInput = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [inviteError, setInviteError] = useState<string>();

  function openInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = inviteTokenFromInput(value);
    if (!token) {
      setInviteError('Hãy nhập mã 6 ký tự hoặc dán link mời hợp lệ.');
      inviteInput.current?.focus();
      return;
    }
    navigate(`/join/${encodeURIComponent(token)}`);
  }

  return <>
    <header className="flex min-h-16 items-center px-4 pt-[env(safe-area-inset-top)] min-[375px]:px-5">
      <Link to="/" className="font-serif text-[25px] font-bold tracking-tight text-accent">HaGiangWiki</Link>
    </header>
    <main className="pb-[max(20px,env(safe-area-inset-bottom))]">
      <img src={ROAD_IMAGE} alt="Cung đèo uốn lượn qua những sườn núi xanh ở Hà Giang"
        fetchPriority="high" className="h-[clamp(11rem,55vw,14.5rem)] w-full bg-accent-soft object-cover object-[64%_49%]" />

      <div className="space-y-4 px-4 pt-5 min-[375px]:px-5">
        <div>
          <h1 className="font-serif text-[clamp(1.65rem,8vw,2.2rem)] font-bold leading-[1.16] tracking-tight">
            <span className="block">Một hành trình.</span>{' '}
            <span className="block">Hai người đồng hành.</span>
          </h1>
          <p className="mt-3 text-sm leading-6 text-text-muted">Sổ tay lên lịch, khám phá cung đường và chia tiền sòng phẳng dành riêng cho 2 người.</p>
        </div>

        {user && trip && <section aria-labelledby="resume-trip-title" className="rounded-card border border-accent/25 bg-accent-soft p-3.5">
          <h2 id="resume-trip-title" className="break-words font-serif text-lg font-bold leading-tight text-accent">Tiếp tục chuyến đi: {trip.title}</h2>
          <Link to="/trip" className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-btn text-sm font-semibold text-accent underline-offset-4 hover:underline">
            Vào lịch trình <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </section>}

        {error && <div className="space-y-2">
          <ErrorNotice>{error}</ErrorNotice>
          <Button tone="secondary" disabled={loading} onClick={() => { void refresh(); }}>Thử lại kết nối</Button>
        </div>}

        <Link to="/onboarding" className="relative flex min-h-12 items-center justify-center gap-2 rounded-btn border border-accent bg-accent px-4 py-3 text-sm font-semibold text-surface hover:bg-accent/90">
          Tạo chuyến đi mới <ArrowRight className="absolute right-4 size-5" aria-hidden="true" />
        </Link>

        <section aria-labelledby="join-trip-title" className="rounded-card border border-border-main bg-surface p-3.5">
          <h2 id="join-trip-title" className="font-serif text-[23px] font-bold leading-tight">Tham gia chuyến đi</h2>
          <form className="mt-3 space-y-2.5" onSubmit={openInvite}>
            <label htmlFor="landing-invite" className="sr-only">Mã hoặc link mời</label>
            <input id="landing-invite" ref={inviteInput} className="field min-w-0 placeholder:text-sm max-[374px]:placeholder:text-[13px]"
              placeholder="Nhập mã 6 ký tự hoặc dán link mời..." value={value}
              aria-invalid={Boolean(inviteError)} aria-describedby={inviteError ? 'landing-invite-error' : undefined}
              autoComplete="off" spellCheck={false} autoCapitalize="none"
              onChange={(event) => { setValue(event.target.value); setInviteError(undefined); }} />
            {inviteError && <p id="landing-invite-error" role="alert" className="text-xs leading-5 text-state-error">{inviteError}</p>}
            <Button type="submit" tone="secondary" className="w-full border-accent">Tham gia</Button>
          </form>
        </section>

        <Link to="/demo" className="flex items-center justify-between gap-3 rounded-card border border-border-main bg-surface p-3.5 hover:border-route/60">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-route">Lịch trình tham khảo</p>
            <h2 className="mt-1 font-serif text-xl font-bold leading-tight">Khám phá lịch trình mẫu (3N2Đ)</h2>
            <p className="mt-1.5 text-xs leading-5 text-text-muted">9 điểm dừng qua Mã Pí Lèng, Cột cờ Lũng Cú.</p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-route" aria-hidden="true" />
        </Link>
      </div>
    </main>
  </>;
}
