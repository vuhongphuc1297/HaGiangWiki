import type { Expense, SettlementTransfer } from '@prisma/client';

export type SplitType = 'EQUAL' | 'FOR_OTHER' | 'PERSONAL';
type LedgerExpense = Pick<Expense, 'payerMemberId' | 'amount' | 'splitType' | 'deletedAt'>;
type LedgerTransfer = Pick<SettlementTransfer, 'fromMemberId' | 'toMemberId' | 'amount' | 'deletedAt'>;

export function allocateExpense(amount: bigint, splitType: SplitType, hasCompanion = true) {
  if (amount < 0n) throw new RangeError('Expense amount must be nonnegative.');
  if (splitType === 'FOR_OTHER' && !hasCompanion) throw new RangeError('FOR_OTHER requires a companion.');
  // The payer bears the extra dong: both shares always add up to the amount.
  const otherShare = !hasCompanion || splitType === 'PERSONAL' ? 0n
    : splitType === 'FOR_OTHER' ? amount : amount / 2n;
  return { payerShare: amount - otherShare, otherShare };
}

export function calculateExpenseSummary(
  memberIds: readonly string[], budget: bigint,
  expenses: readonly LedgerExpense[], settlements: readonly LedgerTransfer[],
) {
  if (memberIds.length > 2 || new Set(memberIds).size !== memberIds.length) {
    throw new RangeError('Settlement supports at most two distinct members.');
  }
  const spentByMember: Record<string, bigint> = Object.fromEntries(memberIds.map((id) => [id, 0n]));
  const [memberA, memberB] = memberIds;
  let totalSpent = 0n;
  // Positive means B owes A; negative means A owes B.
  let balance = 0n;
  for (const expense of expenses) {
    if (expense.deletedAt !== null) continue;
    if (!memberIds.includes(expense.payerMemberId)) throw new RangeError('Unknown expense payer.');
    if (!['EQUAL', 'FOR_OTHER', 'PERSONAL'].includes(expense.splitType)) throw new RangeError('Unknown split type.');
    totalSpent += expense.amount;
    spentByMember[expense.payerMemberId] = spentByMember[expense.payerMemberId]! + expense.amount;
    const { otherShare } = allocateExpense(expense.amount, expense.splitType as SplitType, memberB !== undefined);
    balance += expense.payerMemberId === memberA ? otherShare : -otherShare;
  }
  for (const transfer of settlements) {
    if (transfer.deletedAt !== null) continue;
    if (transfer.amount < 0n || transfer.fromMemberId === transfer.toMemberId
      || !memberIds.includes(transfer.fromMemberId) || !memberIds.includes(transfer.toMemberId)) {
      throw new RangeError('Invalid settlement transfer.');
    }
    balance += transfer.fromMemberId === memberA ? transfer.amount : -transfer.amount;
  }
  return {
    totalSpent, budget, remainingBudget: budget - totalSpent, spentByMember,
    settlement: {
      debtorMemberId: balance === 0n ? null : balance > 0n ? memberB! : memberA!,
      creditorMemberId: balance === 0n ? null : balance > 0n ? memberA! : memberB!,
      netAmount: balance < 0n ? -balance : balance,
      isSettled: balance === 0n,
    },
  };
}
