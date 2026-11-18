import { useEffect } from 'react';
import { ArrowRight, ArrowRightLeft, Check, CircleCheck, MapPin, Pencil, Plus, ReceiptText, RefreshCw, Scale, Trash2, Wallet } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ErrorNotice } from '../../components/ui/Feedback';
import { cn } from '../../lib/utils';
import type { Expense, ExpenseSummary, SettlementTransfer, Trip, TripMember } from '../../types/api';
import { initial, money } from '../../utils/format';
import { useExpenses } from './ExpenseContext';

type Props = {
  trip: Trip; isDemo: boolean;
  onCreate: () => void; onAdd: () => void;
  onEdit: (expense: Expense) => void; onDelete: (expense: Expense) => void;
  onSettlement: () => void; onDeleteSettlement: (settlement: SettlementTransfer) => void;
};

const splitNames = { EQUAL: 'Chia đôi', FOR_OTHER: 'Chi hộ', PERSONAL: 'Chi riêng' } as const;
const amountText = (amount: string) => money(amount).replace(/đ$/, ' đ');
const memberName = (member?: TripMember) => member?.displayName?.trim() || member?.nickname || 'Thành viên';

function Avatar({ member, large = false }: { member?: TripMember; large?: boolean }) {
  return <span aria-hidden="true" className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-serif font-semibold',
    large ? 'size-8 text-base' : 'size-6 text-xs', member?.role === 'OWNER' ? 'bg-accent-soft text-accent' : 'bg-[#F0E0D6] text-route')}>
    {initial(memberName(member))}
  </span>;
}

function entryDate(value: string, timezone: string) {
  try { return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: timezone }).format(new Date(value)); }
  catch { return ''; }
}

export function ExpensesPage({ trip, isDemo, onCreate, onAdd, onEdit, onDelete, onSettlement, onDeleteSettlement }: Props) {
  const { data, loading, refreshing, error, refresh } = useExpenses();
  // Entering the ledger must include expenses added while this user viewed another tab.
  useEffect(() => { void refresh(); }, [refresh]);
  const expenses = data ? [...data.expenses].filter((expense) => !expense.deletedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)) : [];
  const settlements = data ? [...data.settlements].filter((settlement) => !settlement.deletedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)) : [];
  const findMember = (id: string | null) => trip.members.find((member) => member.id === id);

  return <section aria-labelledby="expenses-heading" className="px-5 pt-5">
    <header className="mb-5">
      <h1 id="expenses-heading" className="font-serif text-[32px] font-bold leading-tight tracking-[-0.02em]">Chi tiêu</h1>
      <p className="mt-1 text-sm leading-6 text-text-muted">Rõ ràng từng khoản chi, nhẹ lòng cả hành trình.</p>
    </header>

    {isDemo ? <div className="rounded-card border border-border-main bg-surface p-5">
      <Wallet className="mb-4 size-8 text-accent" strokeWidth={1.5} aria-hidden="true" />
      <h2 className="font-serif text-2xl font-semibold leading-tight">Sổ chi tiêu của hai bạn.</h2>
      <p className="mt-3 text-sm leading-7 text-text-muted">Tạo chuyến đi riêng để ghi tiền ăn, tiền phòng và những khoản chi dọc đường. Công nợ sẽ được tính tự động sau mỗi lần ghi.</p>
      <p className="mt-4 rounded-btn bg-accent-soft p-3 text-xs leading-6 text-accent">Bạn đang xem lịch trình mẫu. Bấm Thêm khoản chi để bắt đầu chuyến đi của mình.</p>
    </div> : <>
      {error && <div className="mb-5"><ErrorNotice>
        <p>{data ? `Chưa thể cập nhật sổ chi tiêu: ${error}` : error}</p>
        {data && <p className="mt-1">Các khoản đã tải vẫn được giữ trên màn hình.</p>}
        <Button tone="secondary" className="mt-3 w-full" disabled={refreshing || loading} onClick={() => { void refresh(); }}>
          <RefreshCw className={cn('size-4', (refreshing || loading) && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />Thử tải lại
        </Button>
      </ErrorNotice></div>}
      {!data && (loading || !error) ? <ExpensesLoading /> : data && <>
        <p role="status" className="sr-only">{refreshing ? 'Đang cập nhật chi tiêu…' : `Đã chi ${amountText(data.summary.totalSpent)}. ${data.summary.settlement.isSettled ? 'Hai bạn đã sòng phẳng.' : `Công nợ còn ${amountText(data.summary.settlement.netAmount)}.`}`}</p>
        <BudgetCard trip={trip} summary={data.summary} />
        <SettlementCard trip={trip} summary={data.summary} onSettlement={onSettlement} />

        <section aria-labelledby="expense-list-heading" className="mt-7">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="expense-list-heading" className="font-serif text-2xl font-bold">Các khoản chi</h2>
            <span className="shrink-0 text-xs tabular-nums text-text-muted">{expenses.length} khoản</span>
          </div>
          {expenses.length === 0 ? <div className="rounded-card border border-dashed border-border-main px-4 py-7 text-center">
            <ReceiptText className="mx-auto mb-3 size-7 text-accent" strokeWidth={1.5} aria-hidden="true" />
            <h3 className="font-serif text-xl font-semibold">Bắt đầu từ khoản đầu tiên.</h3>
            <p className="mt-2 text-sm leading-6 text-text-muted">Bấm Thêm khoản chi để ghi lại tiền ăn, phòng nghỉ hoặc vé tham quan.</p>
          </div> : <ul className="space-y-3">
            {expenses.map((expense) => {
              const payer = findMember(expense.payerMemberId);
              const stop = trip.stops.find((item) => item.id === expense.stopId);
              return <li key={expense.id}><article className="rounded-card border border-border-main bg-surface p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words font-semibold leading-6">{expense.title}</h3>
                    <p className="mt-0.5 break-words text-xs leading-5 text-text-muted">{expense.category || 'Khác'}</p>
                  </div>
                  <p className="max-w-[55%] break-words text-right text-base font-semibold tabular-nums leading-6 [overflow-wrap:anywhere]">{amountText(expense.amount)}</p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
                  <span className="inline-flex min-w-0 items-center gap-1.5"><Avatar member={payer} /><span className="min-w-0 break-words leading-5">{memberName(payer)} trả</span></span>
                  <span className={cn('rounded-btn px-2 py-1 text-[10px] font-medium', expense.splitType === 'PERSONAL' ? 'bg-bg-page text-text-muted' : 'bg-accent-soft text-accent')}>{splitNames[expense.splitType]}</span>
                </div>
                {expense.stopId && <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-text-muted"><MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{stop ? stop.name : 'Điểm dừng đã được xóa'}</span></p>}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-1 border-t border-border-main/60 pt-1">
                  <time dateTime={expense.createdAt} className="text-[10px] leading-5 text-text-muted">{entryDate(expense.createdAt, trip.timezone)}</time>
                  <div className="flex items-center gap-1">
                    <button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-btn px-2 text-xs font-medium text-accent hover:bg-accent-soft" aria-label={`Sửa khoản chi ${expense.title}`} onClick={() => onEdit(expense)}><Pencil className="size-3.5" aria-hidden="true" />Sửa</button>
                    <button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-btn px-2 text-xs font-medium text-state-error hover:bg-state-error/5" aria-label={`Xóa khoản chi ${expense.title}`} onClick={() => onDelete(expense)}><Trash2 className="size-3.5" aria-hidden="true" />Xóa</button>
                  </div>
                </div>
              </article></li>;
            })}
          </ul>}
        </section>

        <section aria-labelledby="settlement-history-heading" className="mt-7">
          <h2 id="settlement-history-heading" className="mb-3 font-serif text-2xl font-bold">Lịch sử chuyển trả</h2>
          {settlements.length === 0 ? <p className="border-t border-border-main py-4 text-sm leading-6 text-text-muted">Chưa có lần chuyển trả nào. Khi một người trả nợ, hãy ghi nhận tại thẻ công nợ phía trên.</p> : <ul className="divide-y divide-border-main border-y border-border-main">
            {settlements.map((settlement) => <li key={settlement.id} className="py-4">
              <div className="flex items-start gap-2">
                <ArrowRightLeft className="mt-1 size-4 shrink-0 text-accent" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium leading-6">{memberName(findMember(settlement.fromMemberId))}<span className="mx-1.5 font-normal text-text-muted">→</span>{memberName(findMember(settlement.toMemberId))}</p>
                  <p className="mt-1 break-words text-base font-semibold tabular-nums [overflow-wrap:anywhere]">{amountText(settlement.amount)}</p>
                  {settlement.notes && <p className="mt-1 whitespace-pre-line break-words text-xs leading-5 text-text-muted">{settlement.notes}</p>}
                  <time dateTime={settlement.transferDate} className="mt-1 block text-[10px] leading-5 text-text-muted">{entryDate(settlement.transferDate, trip.timezone)}</time>
                </div>
                <button type="button" className="icon-button -mr-2 shrink-0 text-state-error hover:bg-state-error/5" aria-label={`Xóa chuyển trả ${amountText(settlement.amount)} từ ${memberName(findMember(settlement.fromMemberId))} cho ${memberName(findMember(settlement.toMemberId))}`} onClick={() => onDeleteSettlement(settlement)}><Trash2 className="size-4" aria-hidden="true" /></button>
              </div>
            </li>)}
          </ul>}
          {settlements.length > 0 && <p className="mt-3 text-xs leading-5 text-text-muted">Tiền chuyển trả chỉ giảm công nợ, không cộng vào tổng chi tiêu.</p>}
        </section>
      </>}
    </>}

    <div className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[420px] border-t border-border-main bg-bg-page px-5 py-3">
      <Button className="w-full text-base" disabled={!isDemo && (!data || loading)} onClick={isDemo ? onCreate : onAdd}><Plus className="size-5" aria-hidden="true" />Thêm khoản chi</Button>
    </div>
  </section>;
}

function BudgetCard({ trip, summary }: { trip: Trip; summary: ExpenseSummary }) {
  const budget = BigInt(summary.budget);
  const spent = BigInt(summary.totalSpent);
  const remaining = BigInt(summary.remainingBudget);
  const over = spent > budget;
  const warning = !over && budget > 0n && spent * 100n > budget * 80n;
  const unclamped = budget > 0n ? spent * 10_000n / budget : spent > 0n ? 10_000n : 0n;
  // Only the bounded display ratio becomes a Number; amounts retain BigInt precision.
  const progress = Number(unclamped > 10_000n ? 10_000n : unclamped) / 100;
  const percentage = budget > 0n ? `${new Intl.NumberFormat('vi-VN').format(spent * 100n / budget)}%` : 'Chưa đặt ngân sách';
  return <section aria-labelledby="budget-heading" className="rounded-card border border-border-main bg-surface p-4">
    <div className="flex items-center justify-between gap-3">
      <h2 id="budget-heading" className="text-sm font-semibold">Ngân sách chuyến đi</h2>
      <Wallet className="size-4 shrink-0 text-accent" aria-hidden="true" />
    </div>
    <dl className="mt-2 space-y-1">
      <div className="flex items-baseline justify-between gap-3"><dt className="shrink-0 text-xs leading-6 text-text-muted">Dự toán</dt><dd className="min-w-0 break-words text-right text-sm font-semibold tabular-nums leading-6 [overflow-wrap:anywhere]">{amountText(summary.budget)}</dd></div>
      <div className="flex items-baseline justify-between gap-3"><dt className="shrink-0 text-xs leading-7 text-text-muted">Tổng thực chi</dt><dd className="min-w-0 break-words text-right font-serif text-2xl font-bold tabular-nums leading-7 [overflow-wrap:anywhere]">{amountText(summary.totalSpent)}</dd></div>
    </dl>
    <div role="progressbar" aria-label="Ngân sách đã sử dụng" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={budget > 0n ? `${percentage} ngân sách, đã chi ${amountText(summary.totalSpent)}` : `Chưa đặt ngân sách, đã chi ${amountText(summary.totalSpent)}`} className="mt-3 h-2.5 overflow-hidden rounded-full bg-border-main/65">
      <div className={cn('h-full rounded-full', over ? 'bg-state-error' : warning ? 'bg-state-warning' : 'bg-accent')} style={{ width: `${progress}%` }} />
    </div>
    <div className={cn('mt-1 flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-xs leading-5', over ? 'text-state-error' : warning ? 'text-state-warning' : 'text-text-muted')}>
      <p className="break-words tabular-nums [overflow-wrap:anywhere]">{percentage}</p>
      <p className="break-words font-medium tabular-nums [overflow-wrap:anywhere]">{remaining < 0n ? `Vượt ${amountText((-remaining).toString())}` : `Còn lại ${amountText(summary.remainingBudget)}`}</p>
    </div>
    {warning && <p className="mt-1 text-xs leading-5 text-state-warning">Đã sử dụng hơn 80% ngân sách.</p>}
    <div className="mt-2 border-t border-border-main pt-2">
      <h3 className="sr-only">Mỗi người đã trả</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {Object.entries(summary.spentByMember).map(([memberId, amount]) => {
          const member = trip.members.find((item) => item.id === memberId);
          return <div key={memberId} className="min-w-0">
            <dt className="flex items-start gap-1.5 text-xs leading-6"><Avatar member={member} /><span className="min-w-0 break-words">{memberName(member)} <span className="text-text-muted">đã trả</span></span></dt>
            <dd className="break-words text-sm font-semibold tabular-nums leading-5 [overflow-wrap:anywhere]">{amountText(amount)}</dd>
          </div>;
        })}
      </dl>
    </div>
  </section>;
}

function SettlementCard({ trip, summary, onSettlement }: { trip: Trip; summary: ExpenseSummary; onSettlement: () => void }) {
  const settlement = summary.settlement;
  if (settlement.isSettled || BigInt(settlement.netAmount) === 0n) return <section aria-labelledby="settlement-heading" className="mt-4 rounded-card border border-accent/20 bg-accent-soft p-4 text-accent">
    <div className="flex items-start gap-3"><CircleCheck className="mt-0.5 size-6 shrink-0" strokeWidth={1.6} aria-hidden="true" /><div>
      <h2 id="settlement-heading" className="font-serif text-xl font-bold">Hai bạn đã sòng phẳng.</h2>
      <p className="mt-1 text-sm leading-6">Không ai nợ ai!</p>
    </div></div>
  </section>;
  const debtor = trip.members.find((member) => member.id === settlement.debtorMemberId);
  const creditor = trip.members.find((member) => member.id === settlement.creditorMemberId);
  const canSettle = debtor?.status === 'ACTIVE' && creditor?.status === 'ACTIVE';
  return <section aria-labelledby="settlement-heading" className="mt-4 rounded-card bg-accent p-4 text-surface">
    <h2 id="settlement-heading" className="flex items-center gap-2 text-sm font-medium"><Scale className="size-5" strokeWidth={1.6} aria-hidden="true" />Quyết toán hai người</h2>
    <div className="mt-3 grid grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)] items-center gap-2">
      <div className="flex min-w-0 items-center gap-1.5"><Avatar member={debtor} large /><p className="min-w-0 break-words text-sm font-semibold leading-5">{memberName(debtor)}</p></div>
      <ArrowRight className="size-5 text-surface/80" aria-hidden="true" />
      <div className="flex min-w-0 items-center justify-end gap-1.5"><Avatar member={creditor} large /><p className="min-w-0 break-words text-right text-sm font-semibold leading-5">{memberName(creditor)}</p></div>
    </div>
    <p className="mt-2 break-words text-sm leading-5">{memberName(debtor)} đang nợ {memberName(creditor)}:</p>
    <p className="mt-1 break-words font-serif text-[30px] font-bold tabular-nums leading-tight [overflow-wrap:anywhere]">{amountText(settlement.netAmount)}</p>
    <Button tone="secondary" className="mt-3 w-full border-surface/70 bg-transparent text-surface hover:bg-surface/10" disabled={!canSettle} onClick={onSettlement}><Check className="size-4" aria-hidden="true" />Ghi nhận chuyển trả</Button>
    {!canSettle && <p className="mt-3 text-xs leading-5 text-surface/80">Cần hai thành viên đang tham gia để ghi nhận chuyển trả. Công nợ cũ vẫn được giữ lại.</p>}
  </section>;
}

function ExpensesLoading() {
  return <div role="status" aria-label="Đang tải sổ chi tiêu" className="space-y-4">
    <span className="sr-only">Đang tải sổ chi tiêu…</span>
    <div aria-hidden="true" className="rounded-card border border-border-main bg-surface p-4">
      <div className="h-4 w-40 animate-pulse rounded bg-border-main/50 motion-reduce:animate-none" />
      <div className="mt-5 h-9 w-48 animate-pulse rounded bg-border-main/50 motion-reduce:animate-none" />
      <div className="mt-5 h-2.5 animate-pulse rounded-full bg-border-main/50 motion-reduce:animate-none" />
      <div className="mt-6 h-16 animate-pulse rounded bg-border-main/30 motion-reduce:animate-none" />
    </div>
    <div aria-hidden="true" className="h-36 animate-pulse rounded-card bg-accent/10 motion-reduce:animate-none" />
    <div aria-hidden="true" className="h-28 animate-pulse rounded-card bg-border-main/30 motion-reduce:animate-none" />
  </div>;
}
