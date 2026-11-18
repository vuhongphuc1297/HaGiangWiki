export const MAX_EXPENSE_AMOUNT = 9_223_372_036_854_775_807n;
export const expenseCategories = ['Ăn uống', 'Lưu trú', 'Xăng xe', 'Vé', 'Mua sắm', 'Khác'];

export function amountInput(value: string): string {
  // A minus sign or letters must remain invalid instead of silently becoming a positive amount.
  if (!/^[\d.,\s]*$/.test(value)) return value;
  return value.replace(/[.,\s]/g, '').replace(/^0+(?=\d)/, '');
}

export function formattedAmount(value: string): string {
  return /^\d+$/.test(value) ? new Intl.NumberFormat('vi-VN').format(BigInt(value)) : value;
}

export function positiveAmount(value: string): string | null {
  if (!/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > MAX_EXPENSE_AMOUNT) return null;
  return value;
}
