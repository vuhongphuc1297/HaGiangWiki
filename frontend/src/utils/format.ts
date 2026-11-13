export const vehicleNames = { XE_MAY: 'Xe máy', O_TO: 'Ô tô', MAY_BAY: 'Máy bay' } as const;

export function money(value: string | number): string {
  try { return `${new Intl.NumberFormat('vi-VN').format(BigInt(value))}đ`; }
  catch { return '0đ'; }
}

export function tripDate(startDate: string, day = 1): Date {
  const date = new Date(`${startDate.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + day - 1);
  return date;
}

export function shortDate(startDate: string, day = 1): string {
  const date = tripDate(startDate, day);
  return `${String(date.getUTCDate()).padStart(2, '0')}.${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function dateRange(startDate: string, durationDays: number): string {
  const first = tripDate(startDate);
  const last = tripDate(startDate, durationDays);
  const full = (date: Date) => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date).replaceAll('/', '.');
  if (durationDays === 1) return full(first);
  if (first.getUTCMonth() === last.getUTCMonth() && first.getUTCFullYear() === last.getUTCFullYear()) return `${String(first.getUTCDate()).padStart(2, '0')}–${full(last)}`;
  return `${full(first)} – ${full(last)}`;
}

export function initial(name: string): string { return name.trim().slice(0, 1).toLocaleUpperCase('vi-VN') || '?'; }
export function searchable(text: string): string { return text.toLocaleLowerCase('vi-VN').normalize('NFD').replace(/\p{Diacritic}/gu, '').replaceAll('đ', 'd'); }
