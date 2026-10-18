const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string | null | undefined): value is string {
  if (!value || !ISO.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function toIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function todayIso(): string {
  return toIso(new Date());
}

export function addDays(value: string | null, days: number | null): string | null {
  if (!isValidIsoDate(value) || days === null || !Number.isFinite(days)) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Adds calendar months, clamping to the last day of the target month (31 Jan + 1m = 28/29 Feb). */
export function addMonths(value: string | null, months: number | null): string | null {
  if (!isValidIsoDate(value) || months === null || !Number.isInteger(months)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const idx = m - 1 + months;
  const ty = y + Math.floor(idx / 12);
  const tm = ((idx % 12) + 12) % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ty, tm, Math.min(d, last))).toISOString().slice(0, 10);
}

export function daysUntil(value: string | null): number | null {
  if (!isValidIsoDate(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.UTC(y, m - 1, d) - today) / 86_400_000);
}

export function daysBetween(a: string | null, b: string | null): number | null {
  if (!isValidIsoDate(a) || !isValidIsoDate(b)) return null;
  const pa = a.split("-").map(Number);
  const pb = b.split("-").map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86_400_000);
}

export function parseLocalDate(value: string): Date | null {
  if (!isValidIsoDate(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Next occurrence on/after today for a recurring due date. */
export function nextRecurring(dueDate: string | null, repeatEveryMonths: number | null): string | null {
  if (!isValidIsoDate(dueDate)) return null;
  const left = daysUntil(dueDate);
  if (left !== null && left >= 0) return dueDate;
  if (!repeatEveryMonths || repeatEveryMonths < 1) return dueDate;
  let current: string | null = dueDate;
  for (let i = 0; i < 240 && current; i += 1) {
    current = addMonths(current, repeatEveryMonths);
    const l = daysUntil(current);
    if (l !== null && l >= 0) return current;
  }
  return dueDate;
}

/** Converts Arabic-Indic / Persian digits to Latin so users can type in any keyboard. */
export function normalizeDigits(value: string): string {
  return value
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[٫,]/g, ".");
}

/** Accepts 2025-4-2, 2025/04/02, ٢٠٢٥-٠٤-٠٢ and returns a valid YYYY-MM-DD or null. */
export function coerceDateInput(raw: string): string | null {
  const v = normalizeDigits(raw.trim()).replace(/[./]/g, "-");
  const m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return isValidIsoDate(iso) ? iso : null;
}
