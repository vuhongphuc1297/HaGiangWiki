import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { ConflictNotice } from '../../components/ui/ConflictNotice';
import { ErrorNotice } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/Button';
import { api, ApiError, errorMessage } from '../../services/api';

type Failure = { message: string; conflict: boolean; missing: boolean };
export const ExpenseSpinner = () => <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />;

export function useLedgerMutation(onSaved: () => Promise<void>, onClose: () => void) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const submitting = useRef(false);
  const request = useRef<{ fingerprint: string; key: string } | null>(null);

  async function run(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<{ ok: true } | { ok: false; error: unknown }> {
    if (submitting.current || failure?.conflict) return { ok: false, error: null };
    const fingerprint = JSON.stringify({ path, method, body });
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, key: crypto.randomUUID() };
    submitting.current = true;
    setBusy(true); setFailure(null);
    try {
      await api(path, { method, body, headers: { 'Idempotency-Key': request.current!.key } });
    } catch (reason) {
      setFailure({
        message: errorMessage(reason),
        conflict: reason instanceof ApiError && reason.status === 409 && reason.currentVersion !== undefined,
        missing: reason instanceof ApiError && reason.status === 404,
      });
      submitting.current = false; setBusy(false);
      return { ok: false, error: reason };
    }
    // The write has committed. A failed refresh must never invite resubmission of that write.
    request.current = null;
    try { await onSaved(); } catch { /* The owning data context reports refresh errors. */ }
    finally { onClose(); submitting.current = false; setBusy(false); }
    return { ok: true };
  }

  return { busy, failure, run, clearFailure: () => setFailure((current) => current?.conflict ? current : null) };
}

export function ExpenseRequestFailure({ failure, onReload, busy, subject = 'khoản chi', hasDraft = false }: {
  failure: Failure | null; onReload?: () => void; busy: boolean;
  subject?: 'khoản chi' | 'giao dịch chuyển trả'; hasDraft?: boolean;
}) {
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => { if (failure) notice.current?.scrollIntoView({ block: 'nearest' }); }, [failure]);
  if (!failure) return null;
  return <div ref={notice}>{failure.conflict && onReload
    ? <ConflictNotice subject={subject} hasDraft={hasDraft} onReload={onReload} busy={busy} />
    : <ErrorNotice><p>{failure.message}</p>{failure.missing && onReload && <Button tone="secondary" className="mt-3 w-full" disabled={busy} onClick={onReload}><RefreshCw className="size-4" aria-hidden="true" />Làm mới dữ liệu</Button>}</ErrorNotice>}</div>;
}
