import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function Sheet({ open, title, onClose, children, busy = false }: { open: boolean; title: string; onClose: () => void; children: ReactNode; busy?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  useEffect(() => {
    if (open && !dialog.current?.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.current?.showModal();
    }
    if (!open && dialog.current?.open) dialog.current.close();
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; if (opener.current?.isConnected) opener.current.focus(); };
  }, [open]);

  return <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClose={onClose} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div aria-hidden="true" className="mx-auto mt-3 h-1 w-9 rounded-full bg-border-main" />
    <header className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-surface px-5 pb-3 pt-2">
      <h2 id={titleId} className="font-serif text-2xl font-bold leading-tight">{title}</h2>
      <button type="button" className="icon-button -mr-2 shrink-0" disabled={busy} aria-label="Đóng" onClick={onClose}><X aria-hidden="true" className="size-5" /></button>
    </header>
    <div className="px-5 pb-[max(24px,env(safe-area-inset-bottom))]">{children}</div>
  </dialog>;
}
