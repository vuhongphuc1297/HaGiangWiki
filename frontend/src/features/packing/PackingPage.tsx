import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Backpack, Check, CircleCheck, LockKeyhole, Pencil, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ErrorNotice, Loading } from '../../components/ui/Feedback';
import { Sheet } from '../../components/ui/Sheet';
import { cn } from '../../lib/utils';
import type { PackingItem } from '../../types/api';
import { usePacking } from './PackingContext';

export function PackingPage({ isDemo, onCreate }: { isDemo: boolean; onCreate: () => void }) {
  const packing = usePacking();
  const { data, loading, refreshing, busy, pendingId, error, notice, refresh } = packing;
  const [title, setTitle] = useState('');
  const [validation, setValidation] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ kind: 'rename' | 'delete'; item: PackingItem } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { setTitle(''); setEditor(null); setValidation(null); }, [packing.scope]);

  async function add(event: FormEvent) {
    event.preventDefault();
    const next = title.trim();
    if (!next || next.length > 160) { setValidation('Nhập tên món đồ từ 1 đến 160 ký tự.'); input.current?.focus(); return; }
    setValidation(null);
    if (await packing.add(next)) { setTitle(''); input.current?.focus(); }
  }
  const complete = !!data && data.stats.total > 0 && data.stats.packed === data.stats.total;

  return <section aria-labelledby="packing-heading" className="px-5 pb-10 pt-5">
    <header className="mb-5">
      <h1 id="packing-heading" className="font-serif text-[32px] font-bold leading-tight tracking-[-0.02em]">Hành trang của bạn</h1>
      <p className="mt-1 text-sm leading-6 text-text-muted">Gói ghém đủ đầy, thảnh thơi lên đường.</p>
      <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-accent"><LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />Chỉ bạn nhìn thấy danh sách này.</p>
    </header>

    {isDemo ? <div className="rounded-card border border-border-main bg-surface p-5">
      <Backpack className="mb-4 size-8 text-accent" strokeWidth={1.5} aria-hidden="true" />
      <h2 className="font-serif text-2xl font-semibold">Một chiếc balo của riêng bạn.</h2>
      <p className="mt-3 text-sm leading-7 text-text-muted">Tạo chuyến đi để chuẩn bị đồ cá nhân và đánh dấu những món đã xếp. Người đồng hành sẽ có danh sách riêng.</p>
      <Button className="mt-5 w-full" onClick={onCreate}>Tạo chuyến đi của bạn</Button>
    </div> : <>
      {error && <div className="mb-4"><ErrorNotice><p>{error}</p>
        <Button tone="secondary" className="mt-3 w-full" disabled={busy || loading || refreshing} onClick={() => { void refresh(); }}><RefreshCw className="size-4" aria-hidden="true" />Tải lại hành trang</Button>
      </ErrorNotice></div>}
      {notice && <p role="status" className="mb-4 rounded-btn bg-accent-soft px-3 py-2 text-sm leading-6 text-accent">{notice}</p>}
      {!data && (loading || !error) ? <Loading label="Đang tải hành trang…" /> : data && <>
        <section aria-labelledby="packing-progress-heading" className={cn('rounded-card border p-4', complete ? 'border-accent/25 bg-accent-soft' : 'border-border-main bg-surface')}>
          <div className="flex items-center justify-between gap-3"><h2 id="packing-progress-heading" className="text-sm font-semibold">Balo đã sẵn sàng?</h2><Backpack className="size-5 shrink-0 text-accent" strokeWidth={1.6} aria-hidden="true" /></div>
          <div className="mt-3 flex items-baseline justify-between gap-3"><p className="text-sm leading-6 text-text-muted"><strong className="text-xl font-semibold tabular-nums text-text-main">{data.stats.packed}/{data.stats.total}</strong> món đã chuẩn bị</p><span className="font-serif text-2xl font-bold tabular-nums text-accent">{data.stats.percentage}%</span></div>
          <div role="progressbar" aria-label="Tiến độ chuẩn bị hành trang" aria-valuemin={0} aria-valuemax={100} aria-valuenow={data.stats.percentage} aria-valuetext={`${data.stats.packed} trên ${data.stats.total} món đã chuẩn bị`} className="mt-3 h-2.5 overflow-hidden rounded-full bg-border-main/60">
            <div className="h-full rounded-full bg-accent transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${data.stats.percentage}%` }} />
          </div>
          {complete && <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-accent"><CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />Bạn đã chuẩn bị đầy đủ hành trang lên đường!</p>}
        </section>

        <section aria-labelledby="packing-list-heading" className="mt-6">
          <div className="mb-3 flex items-baseline justify-between gap-3"><h2 id="packing-list-heading" className="font-serif text-2xl font-bold">Đồ cần mang</h2><span className="text-xs tabular-nums text-text-muted">{data.stats.total} món</span></div>
          {data.items.length === 0 ? <div className="rounded-card border border-dashed border-border-main px-4 py-7 text-center">
            <Backpack className="mx-auto mb-3 size-8 text-accent" strokeWidth={1.3} aria-hidden="true" />
            <h3 className="font-serif text-xl font-semibold">Balo còn trống.</h3>
            <p className="mt-2 text-sm leading-6 text-text-muted">Thêm món đầu tiên ở ô bên dưới, hoặc nạp gợi ý để bắt đầu chuẩn bị.</p>
          </div> : <ul className="space-y-2.5">
            {data.items.map((item) => <li key={item.id} className={cn('flex items-center gap-1 rounded-btn border-4 px-1 py-1.5 transition-colors motion-reduce:transition-none', item.isPacked ? 'border-accent bg-accent-soft' : 'border-state-error bg-[#FBE9E7]')}>
              <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 px-2 py-2">
                <input type="checkbox" className="size-6 shrink-0 cursor-pointer accent-accent disabled:cursor-wait" checked={item.isPacked} disabled={busy} onChange={() => { void packing.toggle(item.id); }} />
                <span className="min-w-0"><span className="block break-words text-sm leading-6 [overflow-wrap:anywhere]">{item.title}</span>
                  {pendingId === item.id && <span className="block text-[10px] leading-5 text-accent">Đang lưu…</span>}
                </span>
              </label>
              <button type="button" className="icon-button shrink-0" disabled={busy} aria-label={`Đổi tên ${item.title}`} onClick={() => setEditor({ kind: 'rename', item })}><Pencil className="size-4" aria-hidden="true" /></button>
              <button type="button" className="icon-button shrink-0 text-state-error hover:bg-state-error/5" disabled={busy} aria-label={`Xóa ${item.title}`} onClick={() => setEditor({ kind: 'delete', item })}><Trash2 className="size-4" aria-hidden="true" /></button>
            </li>)}
          </ul>}
        </section>

        <div className="mt-5 border-t border-border-main pt-5">
          <Button tone="secondary" className="w-full px-3" disabled={busy} onClick={() => { void packing.templates(); }}><Sparkles className="size-4 shrink-0" strokeWidth={1.6} aria-hidden="true" /><span className="leading-6">Nạp gợi ý đồ phượt Hà Giang</span></Button>
          <p className="mt-2 text-xs leading-5 text-text-muted">7 món thiết yếu đi vùng cao. Các món đã có sẽ được giữ nguyên.</p>
        </div>
        <p role="status" className="sr-only">{busy ? 'Đang lưu hành trang…' : refreshing ? 'Đang tải lại hành trang…' : `${data.stats.packed} trên ${data.stats.total} món đã chuẩn bị.`}</p>
      </>}

      <form onSubmit={(event) => { void add(event); }} className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[420px] border-t border-border-main bg-bg-page px-5 py-3">
        <label htmlFor={inputId} className="mb-2 block text-xs font-semibold">Thêm vào balo</label>
        <div className="flex gap-2"><input ref={input} id={inputId} className="field min-w-0 flex-1" placeholder="Thêm món đồ cần mang..." value={title} maxLength={160} disabled={busy || !data} aria-invalid={!!validation} aria-describedby={validation ? `${inputId}-error` : undefined} autoComplete="off" enterKeyHint="done" onChange={(event) => { setTitle(event.target.value); setValidation(null); }} /><Button type="submit" className="shrink-0 px-3" disabled={busy || !data || !title.trim()}><Plus className="size-4" aria-hidden="true" />Thêm</Button></div>
        {validation && <p id={`${inputId}-error`} role="alert" className="mt-2 text-xs leading-5 text-state-error">{validation}</p>}
      </form>
      {editor && <PackingEditor key={`${editor.kind}:${editor.item.id}`} kind={editor.kind} item={editor.item} onClose={() => setEditor(null)} />}
    </>}
  </section>;
}

function PackingEditor({ kind, item, onClose }: { kind: 'rename' | 'delete'; item: PackingItem; onClose: () => void }) {
  const { data, busy, error, notice, rename, remove } = usePacking();
  const [title, setTitle] = useState(item.title);
  const [validation, setValidation] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const current = data?.items.find((value) => value.id === item.id);
  const stale = attempted && !!data && (!current || current.version !== item.version);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || stale) return;
    if (kind === 'rename' && (!title.trim() || title.trim().length > 160)) { setValidation('Nhập tên món đồ từ 1 đến 160 ký tự.'); input.current?.focus(); return; }
    setAttempted(true);
    if (await (kind === 'rename' ? rename(item, title) : remove(item))) onClose();
  }
  return <Sheet open title={kind === 'rename' ? 'Đổi tên món đồ' : 'Xóa món đồ?'} busy={busy} variant={kind === 'delete' ? 'dialog' : 'sheet'} onClose={onClose} describedBy={kind === 'delete' ? `${id}-description` : undefined}>
    <form onSubmit={(event) => { void save(event); }} className="space-y-4">
      {kind === 'rename' ? <div><label htmlFor={id} className="field-label">Tên món đồ</label><input ref={input} id={id} className="field" value={title} maxLength={160} autoFocus disabled={busy} aria-invalid={!!validation} aria-describedby={validation ? `${id}-error` : undefined} onChange={(event) => { setTitle(event.target.value); setValidation(null); }} />{validation && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-state-error">{validation}</p>}</div>
        : <p id={`${id}-description`} className="break-words text-sm leading-7">Xóa “{item.title}” khỏi balo cá nhân? Bạn có thể thêm lại nếu cần.</p>}
      {attempted && error && <ErrorNotice>{error}</ErrorNotice>}
      {attempted && notice && <p role="status" className="text-sm leading-6 text-accent">{notice}</p>}
      <div className="flex gap-3"><Button tone="secondary" className="flex-1" disabled={busy} onClick={onClose}>{stale ? 'Xem bản mới' : 'Đóng'}</Button><Button type="submit" tone={kind === 'delete' ? 'danger' : 'primary'} className="flex-1" disabled={busy || stale}>{kind === 'delete' ? <Trash2 className="size-4" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}{busy ? 'Đang lưu…' : kind === 'delete' ? 'Xóa món đồ' : 'Lưu tên'}</Button></div>
    </form>
  </Sheet>;
}
