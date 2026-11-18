import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, Check, Trash2 } from 'lucide-react';
import { Sheet } from '../../components/ui/Sheet';
import { Button } from '../../components/ui/Button';
import { ApiError } from '../../services/api';
import type { ExpenseSummary, SettlementTransfer, Trip } from '../../types/api';
import { initial, money } from '../../utils/format';
import { amountInput, formattedAmount, positiveAmount } from './expense.form';
import { ExpenseRequestFailure, ExpenseSpinner, useLedgerMutation } from './ExpenseFormShared';

type SavedProps = { trip: Trip; onSaved: () => Promise<void>; onClose: () => void };

export function SettlementModal({ trip, summary, onSaved, onClose }: SavedProps & { summary: ExpenseSummary }) {
  const id = useId();
  const [amount, setAmount] = useState(summary.settlement.netAmount);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ amount?: string; notes?: string; members?: string }>({});
  const mutation = useLedgerMutation(onSaved, onClose);
  const from = trip.members.find((member) => member.id === summary.settlement.debtorMemberId);
  const to = trip.members.find((member) => member.id === summary.settlement.creditorMemberId);
  const validAmount = positiveAmount(amount);
  const remainder = validAmount ? BigInt(summary.settlement.netAmount) - BigInt(validAmount) : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (mutation.busy) return;
    const invalid: typeof errors = {};
    if (!validAmount) invalid.amount = 'Nhập số tiền nguyên đồng lớn hơn 0, trong giới hạn lưu trữ.';
    if (notes.trim().length > 2000) invalid.notes = 'Ghi chú tối đa 2.000 ký tự.';
    if (!from || !to || from.id === to.id || from.status !== 'ACTIVE' || to.status !== 'ACTIVE') invalid.members = 'Cần hai thành viên đang tham gia để ghi nhận chuyển trả. Hãy làm mới dữ liệu chuyến đi.';
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      document.getElementById(`${id}-${invalid.amount ? 'amount' : invalid.notes ? 'notes' : 'members'}`)?.focus();
      return;
    }
    const result = await mutation.run(`/trips/${encodeURIComponent(trip.id)}/settlements`, 'POST', {
      fromMemberId: from!.id, toMemberId: to!.id, amount: validAmount!, notes: notes.trim() || null,
    });
    if (!result.ok && result.error instanceof ApiError) {
      const fields: typeof errors = {};
      for (const issue of result.error.details) {
        if (issue.field === 'amount' || issue.field === 'notes') fields[issue.field] = issue.message;
        else if (issue.field === 'fromMemberId' || issue.field === 'toMemberId') fields.members = issue.message;
      }
      setErrors(fields);
    }
  }

  return <Sheet open title="Ghi nhận chuyển trả" onClose={onClose} busy={mutation.busy}>
    <form noValidate className="space-y-5" aria-busy={mutation.busy} onSubmit={(event) => { void submit(event); }}>
      <div id={`${id}-members`} tabIndex={-1} className="rounded-card border border-border-main p-4" aria-describedby={errors.members ? `${id}-members-error` : undefined}>
        <p className="text-xs text-text-muted">Công nợ hiện tại</p><p className="mt-1 break-words font-serif text-xl font-bold">{from?.nickname || from?.displayName || 'Người chuyển'} nợ {to?.nickname || to?.displayName || 'người nhận'} {money(summary.settlement.netAmount)}</p>
        <div className="mt-4 flex items-center justify-between gap-2 text-sm"><div className="flex min-w-0 items-center gap-2"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-border-main/60 text-accent" aria-hidden="true">{initial(from?.nickname || from?.displayName || '?')}</span><span className="min-w-0 break-words">{from?.nickname || from?.displayName}</span></div><ArrowRight className="size-5 shrink-0 text-accent" aria-hidden="true" /><div className="flex min-w-0 items-center gap-2"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent" aria-hidden="true">{initial(to?.nickname || to?.displayName || '?')}</span><span className="min-w-0 break-words">{to?.nickname || to?.displayName}</span></div></div>
      </div>
      {errors.members && <p id={`${id}-members-error`} role="alert" className="text-xs leading-5 text-state-error">{errors.members}</p>}
      <fieldset disabled={mutation.busy} className="space-y-5">
        <div><label className="field-label" htmlFor={`${id}-amount`}>Số tiền chuyển trả (đ)</label><input id={`${id}-amount`} className="field text-2xl font-semibold tabular-nums" required inputMode="numeric" autoComplete="off" value={formattedAmount(amount)} aria-invalid={Boolean(errors.amount)} aria-describedby={errors.amount ? `${id}-amount-error` : undefined} onChange={(event) => { setAmount(amountInput(event.target.value)); setErrors((current) => ({ ...current, amount: undefined })); mutation.clearFailure(); }} />{errors.amount && <p id={`${id}-amount-error`} role="alert" className="mt-1 text-xs leading-5 text-state-error">{errors.amount}</p>}</div>
        <div><label className="field-label" htmlFor={`${id}-notes`}>Ghi chú phương thức <span className="font-normal text-text-muted">(tùy chọn)</span></label><textarea id={`${id}-notes`} className="field resize-y" rows={2} maxLength={2000} placeholder="Chuyển khoản Vietcombank, tiền mặt, Momo…" value={notes} aria-invalid={Boolean(errors.notes)} aria-describedby={errors.notes ? `${id}-notes-error` : undefined} onChange={(event) => { setNotes(event.target.value); setErrors((current) => ({ ...current, notes: undefined })); mutation.clearFailure(); }} />{errors.notes && <p id={`${id}-notes-error`} role="alert" className="mt-1 text-xs leading-5 text-state-error">{errors.notes}</p>}</div>
      </fieldset>
      {remainder !== null && <div className="rounded-card bg-accent-soft p-4 text-sm leading-6 text-accent" aria-live="polite"><p className="text-xs">Sau khi ghi nhận</p><p className="mt-1 break-words font-serif text-xl font-bold">{remainder === 0n ? 'Hai bạn sẽ sòng phẳng.' : remainder > 0n ? `${from?.nickname || from?.displayName} còn nợ ${to?.nickname || to?.displayName} ${money(remainder.toString())}` : `${to?.nickname || to?.displayName} sẽ nợ lại ${from?.nickname || from?.displayName} ${money((-remainder).toString())}`}</p></div>}
      <ExpenseRequestFailure failure={mutation.failure} busy={mutation.busy} subject="giao dịch chuyển trả" hasDraft />
      <p className="text-xs leading-5 text-text-muted">Chỉ ghi nhận khi tiền đã được chuyển hoặc nhận. Chuyển trả không cộng vào tổng chi tiêu.</p>
      <Button type="submit" className="w-full text-base" disabled={mutation.busy}>{mutation.busy ? <ExpenseSpinner /> : <Check className="size-5" aria-hidden="true" />}{mutation.busy ? 'Đang lưu…' : 'Lưu chuyển trả'}</Button>
    </form>
  </Sheet>;
}

export function DeleteSettlementDialog({ trip, settlement, onSaved, onClose, onReload }: SavedProps & { settlement: SettlementTransfer; onReload: () => Promise<void> }) {
  const descriptionId = useId();
  const [reloading, setReloading] = useState(false);
  const mutation = useLedgerMutation(onSaved, onClose);
  const pending = mutation.busy || reloading;
  const from = trip.members.find((member) => member.id === settlement.fromMemberId);
  const to = trip.members.find((member) => member.id === settlement.toMemberId);
  return <Sheet open variant="dialog" title="Xóa lần chuyển trả?" describedBy={descriptionId} busy={pending} onClose={onClose}>
    <p id={descriptionId} className="mb-4 break-words text-sm leading-7">Xóa giao dịch <strong>{money(settlement.amount)}</strong> từ <strong>{from?.nickname || from?.displayName || 'người chuyển'}</strong> đến <strong>{to?.nickname || to?.displayName || 'người nhận'}</strong>? Công nợ sẽ được tính lại.</p>
    <div className="mb-4"><ExpenseRequestFailure failure={mutation.failure} onReload={() => { setReloading(true); void onReload().finally(() => setReloading(false)); }} busy={pending} subject="giao dịch chuyển trả" /></div>
    <div className="flex flex-wrap justify-end gap-3"><Button tone="secondary" disabled={pending} onClick={onClose}>Hủy</Button><Button tone="danger" disabled={pending} onClick={() => { void mutation.run(`/trips/${encodeURIComponent(trip.id)}/settlements/${encodeURIComponent(settlement.id)}`, 'DELETE'); }}>{mutation.busy ? <ExpenseSpinner /> : <Trash2 className="size-4" aria-hidden="true" />}{mutation.busy ? 'Đang xóa…' : 'Xóa chuyển trả'}</Button></div>
  </Sheet>;
}
