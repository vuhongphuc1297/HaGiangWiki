import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Plus, Save, Trash2 } from 'lucide-react';
import { Sheet } from '../../components/ui/Sheet';
import { Button } from '../../components/ui/Button';
import { ApiError } from '../../services/api';
import type { Expense, ExpenseSplitType, Stop, Trip } from '../../types/api';
import { initial, money } from '../../utils/format';
import { amountInput, expenseCategories, formattedAmount, positiveAmount } from './expense.form';
import { ExpenseRequestFailure, ExpenseSpinner, useLedgerMutation } from './ExpenseFormShared';

type SavedProps = { trip: Trip; onSaved: () => Promise<void>; onClose: () => void };
type ExistingProps = SavedProps & { expense: Expense; onReload: () => Promise<void> };
type Draft = { title: string; amount: string; payerMemberId: string; splitType: ExpenseSplitType; category: string; stopId: string };
type FieldErrors = Partial<Record<keyof Draft, string>>;
const splitChoices = [
  { value: 'EQUAL', label: 'Chia đôi', help: 'Mỗi người chịu 50%.' },
  { value: 'FOR_OTHER', label: 'Chi hộ', help: 'Trả hộ 100% cho bạn.' },
  { value: 'PERSONAL', label: 'Chi riêng', help: 'Tiêu riêng, không chia tiền.' },
] as const;

export function AddExpenseModal(props: SavedProps & { currentUserId?: string; initialStop?: Stop }) {
  return <ExpenseEditor {...props} />;
}

export function EditExpenseModal(props: ExistingProps & { currentUserId?: string }) {
  return <ExpenseEditor {...props} />;
}

function ExpenseEditor({ trip, currentUserId, initialStop, expense, onSaved, onClose, onReload }: SavedProps & {
  currentUserId?: string; initialStop?: Stop; expense?: Expense; onReload?: () => Promise<void>;
}) {
  const id = useId();
  const active = trip.members.filter((member) => member.status === 'ACTIVE');
  const [draft, setDraft] = useState<Draft>(() => ({
    title: expense?.title ?? (initialStop ? `Chi tiêu tại ${initialStop.name}`.slice(0, 160) : ''),
    amount: expense?.amount ?? '',
    payerMemberId: expense?.payerMemberId ?? active.find((member) => member.userId === currentUserId)?.id ?? active[0]?.id ?? '',
    splitType: expense?.splitType ?? 'EQUAL',
    category: expense?.category ?? '', stopId: expense?.stopId ?? initialStop?.id ?? '',
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [reloading, setReloading] = useState(false);
  const mutation = useLedgerMutation(onSaved, onClose);
  const pending = mutation.busy || reloading;
  const payer = trip.members.find((member) => member.id === draft.payerMemberId);
  // Historical members still share EQUAL expenses in the backend ledger after revocation.
  const other = trip.members.find((member) => member.id !== draft.payerMemberId);
  const amount = positiveAmount(draft.amount);
  const otherShare = amount && other ? draft.splitType === 'FOR_OTHER' ? BigInt(amount) : draft.splitType === 'EQUAL' ? BigInt(amount) / 2n : 0n : 0n;
  const retainedStop = expense?.stopId && !trip.stops.some((stop) => stop.id === expense.stopId);

  function change<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    mutation.clearFailure();
  }
  async function reload() {
    if (pending || !onReload) return;
    setReloading(true);
    try { await onReload(); } finally { setReloading(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || mutation.failure?.conflict) return;
    const invalid: FieldErrors = {};
    if (!draft.title.trim() || draft.title.trim().length > 160) invalid.title = 'Hãy nhập tên khoản chi từ 1 đến 160 ký tự.';
    if (!amount) invalid.amount = 'Nhập số tiền nguyên đồng lớn hơn 0, tối đa 9.223.372.036.854.775.807đ.';
    if (!active.some((member) => member.id === draft.payerMemberId)) invalid.payerMemberId = 'Hãy chọn một thành viên đang tham gia chuyến đi.';
    if (draft.splitType === 'FOR_OTHER' && active.length !== 2) invalid.splitType = 'Chi hộ cần có hai người đang tham gia chuyến đi.';
    if (draft.stopId && draft.stopId !== expense?.stopId && !trip.stops.some((stop) => stop.id === draft.stopId)) invalid.stopId = 'Điểm dừng đã thay đổi. Hãy chọn lại.';
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      document.getElementById(`${id}-${Object.keys(invalid)[0]}`)?.focus();
      return;
    }
    const body = {
      title: draft.title.trim(), amount: amount!, payerMemberId: draft.payerMemberId,
      splitType: draft.splitType, category: draft.category || null,
      // Omitting an unchanged reference preserves links to tombstoned stops.
      ...(expense && draft.stopId === expense.stopId ? {} : { stopId: draft.stopId || null }),
      ...(expense ? { version: expense.version } : {}),
    };
    const result = await mutation.run(`/trips/${encodeURIComponent(trip.id)}/expenses${expense ? `/${encodeURIComponent(expense.id)}` : ''}`, expense ? 'PATCH' : 'POST', body);
    if (!result.ok && result.error instanceof ApiError) {
      const serverFields: FieldErrors = {};
      for (const issue of result.error.details) if (issue.field in draft) serverFields[issue.field as keyof Draft] = issue.message;
      setErrors(serverFields);
    }
  }
  function fieldProps(field: keyof Draft) {
    return { id: `${id}-${field}`, 'aria-invalid': Boolean(errors[field]), 'aria-describedby': errors[field] ? `${id}-${field}-error` : undefined };
  }
  const fieldError = (field: keyof Draft) => errors[field] && <p id={`${id}-${field}-error`} role="alert" className="mt-1 text-xs leading-5 text-state-error">{errors[field]}</p>;

  return <Sheet open title={expense ? 'Sửa khoản chi' : 'Thêm khoản chi'} onClose={onClose} busy={pending}>
    <form noValidate className="space-y-5" onSubmit={(event) => { void submit(event); }} aria-busy={pending}>
      <fieldset disabled={pending} className="min-w-0 space-y-5">
        <div><label className="field-label" htmlFor={`${id}-title`}>Tên khoản chi</label><input {...fieldProps('title')} className="field" required maxLength={160} placeholder="Tiền Homestay, ăn trưa Yên Minh…" value={draft.title} onChange={(event) => change('title', event.target.value)} />{fieldError('title')}</div>
        <div><label className="field-label" htmlFor={`${id}-amount`}>Số tiền (đ)</label><div className="relative"><input {...fieldProps('amount')} className="field pr-10 text-2xl font-semibold tabular-nums" required inputMode="numeric" autoComplete="off" placeholder="0" value={formattedAmount(draft.amount)} onChange={(event) => change('amount', amountInput(event.target.value))} /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true">đ</span></div>{fieldError('amount')}</div>
        <fieldset id={`${id}-payerMemberId`} tabIndex={-1} aria-invalid={Boolean(errors.payerMemberId)} aria-describedby={errors.payerMemberId ? `${id}-payerMemberId-error` : undefined}>
          <legend className="field-label">Người trả tiền</legend>
          <div className="grid grid-cols-2 gap-2">{active.map((member) => <label key={member.id} className="relative min-w-0 cursor-pointer"><input className="peer sr-only" type="radio" name={`${id}-payer`} value={member.id} checked={draft.payerMemberId === member.id} onChange={() => change('payerMemberId', member.id)} /><span className="flex min-h-14 min-w-0 items-center gap-2 rounded-btn border border-border-main bg-surface p-2.5 peer-checked:border-accent peer-checked:bg-accent-soft peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-state-focus"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-border-main/50 text-sm text-accent" aria-hidden="true">{initial(member.nickname || member.displayName)}</span><span className="min-w-0 break-words text-sm font-medium">{member.nickname || member.displayName}{member.userId === currentUserId && <span className="block text-[10px] font-normal text-text-muted">Bạn</span>}</span>{draft.payerMemberId === member.id && <Check className="ml-auto size-4 shrink-0 text-accent" aria-hidden="true" />}</span></label>)}</div>
          {expense && payer?.status === 'REVOKED' && <p className="mt-2 text-xs leading-5 text-state-warning">Người trả cũ đã rời chuyến đi. Chọn người trả đang tham gia để lưu thay đổi.</p>}{fieldError('payerMemberId')}
        </fieldset>
        <fieldset id={`${id}-splitType`} tabIndex={-1} aria-invalid={Boolean(errors.splitType)} aria-describedby={errors.splitType ? `${id}-splitType-error` : undefined}>
          <legend className="field-label">Cách chia tiền</legend>
          <div className="grid grid-cols-3 gap-2">{splitChoices.map((choice) => <label key={choice.value} className="relative min-w-0 cursor-pointer"><input className="peer sr-only" type="radio" name={`${id}-split`} value={choice.value} checked={draft.splitType === choice.value} onChange={() => change('splitType', choice.value)} /><span className="flex min-h-12 items-center justify-center rounded-btn border border-border-main bg-surface px-1 text-center text-sm font-medium peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-state-focus">{choice.label}</span></label>)}</div>
          <p className="mt-2 text-xs leading-5 text-text-muted">{splitChoices.find((choice) => choice.value === draft.splitType)?.help}</p>{fieldError('splitType')}
        </fieldset>
        {amount && payer && <div className="break-words rounded-btn bg-accent-soft p-3 text-sm leading-6 text-accent [overflow-wrap:anywhere]" aria-live="polite">
          {draft.splitType === 'PERSONAL' ? <p>Khoản chi riêng của <strong>{payer.nickname || payer.displayName}</strong>, không phát sinh công nợ.</p>
            : other ? <><p><strong>{payer.nickname || payer.displayName}</strong> chịu {money((BigInt(amount) - otherShare).toString())} · <strong>{other.nickname || other.displayName}</strong> chịu {money(otherShare.toString())}</p><p className="mt-1 text-xs">{other.nickname || other.displayName} nợ người trả thêm {money(otherShare.toString())}.</p></>
              : <p>Chưa có bạn đồng hành, khoản này chưa phát sinh công nợ.</p>}
        </div>}
        <div><label className="field-label" htmlFor={`${id}-category`}>Danh mục</label><select {...fieldProps('category')} className="field" value={draft.category} onChange={(event) => change('category', event.target.value)}><option value="">Chưa chọn</option>{draft.category && !expenseCategories.includes(draft.category) && <option value={draft.category}>{draft.category}</option>}{expenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select>{fieldError('category')}</div>
        <div><label className="field-label" htmlFor={`${id}-stopId`}>Gắn với điểm dừng</label><select {...fieldProps('stopId')} className="field max-w-full" value={draft.stopId} onChange={(event) => change('stopId', event.target.value)}><option value="">Khoản chi chung không gắn điểm</option>{retainedStop && <option value={expense!.stopId!}>Điểm dừng đã xóa · giữ liên kết cũ</option>}{trip.stops.map((stop) => <option key={stop.id} value={stop.id}>{stop.name} · {stop.day === 0 ? 'Kho tạm' : `Ngày ${stop.day}`}</option>)}</select>{fieldError('stopId')}</div>
      </fieldset>
      <ExpenseRequestFailure failure={mutation.failure} onReload={onReload ? () => { void reload(); } : undefined} busy={pending} hasDraft />
      <Button className="w-full text-base" type="submit" disabled={pending || Boolean(mutation.failure?.conflict)}>{mutation.busy ? <ExpenseSpinner /> : expense ? <Save className="size-5" aria-hidden="true" /> : <Plus className="size-5" aria-hidden="true" />}{mutation.busy ? 'Đang lưu…' : expense ? 'Lưu thay đổi' : 'Lưu khoản chi'}</Button>
    </form>
  </Sheet>;
}

export function DeleteExpenseDialog({ trip, expense, onSaved, onClose, onReload }: ExistingProps) {
  const descriptionId = useId();
  const [reloading, setReloading] = useState(false);
  const mutation = useLedgerMutation(onSaved, onClose);
  const pending = mutation.busy || reloading;
  return <Sheet open variant="dialog" title="Xóa khoản chi?" describedBy={descriptionId} busy={pending} onClose={onClose}>
    <p id={descriptionId} className="mb-4 break-words text-sm leading-7">Xóa <strong>{expense.title}</strong> ({money(expense.amount)}) khỏi sổ chi tiêu? Tổng chi và công nợ sẽ được tính lại.</p>
    <div className="mb-4"><ExpenseRequestFailure failure={mutation.failure} onReload={() => { setReloading(true); void onReload().finally(() => setReloading(false)); }} busy={pending} /></div>
    <div className="flex flex-wrap justify-end gap-3"><Button tone="secondary" disabled={pending} onClick={onClose}>Hủy</Button><Button tone="danger" disabled={pending || Boolean(mutation.failure?.conflict)} onClick={() => { void mutation.run(`/trips/${encodeURIComponent(trip.id)}/expenses/${encodeURIComponent(expense.id)}`, 'DELETE', { version: expense.version }); }}>{mutation.busy ? <ExpenseSpinner /> : <Trash2 className="size-4" aria-hidden="true" />}{mutation.busy ? 'Đang xóa…' : 'Xóa khoản chi'}</Button></div>
  </Sheet>;
}
