import i18n from "@/i18n";
import { isValidIsoDate } from "./dates";

function locale() {
  const l = i18n.language || "en";
  // Arabic UI with Latin digits reads better in dates/prices for invoices (matches the design).
  return l === "ar" ? "ar-u-nu-latn" : l;
}

export function formatDate(value: string | null, style: "short" | "long" = "short"): string {
  if (!isValidIsoDate(value)) return "—";
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  try {
    return new Intl.DateTimeFormat(locale(), style === "long" ? { year: "numeric", month: "long", day: "numeric" } : { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch {
    return value;
  }
}

export function formatMoney(amount: number | null, currency: string | null): string {
  if (amount === null || !Number.isFinite(amount)) return "—";
  try {
    if (currency) {
      return new Intl.NumberFormat(locale(), { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
    }
  } catch {
    // unknown currency code -> fall through
  }
  const n = new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(amount);
  return currency ? `${n} ${currency}` : n;
}

export function formatNumber(n: number): string {
  try {
    return new Intl.NumberFormat(locale()).format(n);
  } catch {
    return String(n);
  }
}

/** Day counts with correct Arabic grammar (يوم / يومان / أيام / يومًا). */
export function formatDays(n: number): string {
  const abs = Math.abs(n);
  const lang = i18n.language;
  if (lang === "ar") {
    if (abs === 1) return "يوم واحد";
    if (abs === 2) return "يومان";
    if (abs >= 3 && abs <= 10) return `${abs} أيام`;
    return `${abs} يومًا`;
  }
  return i18n.t(abs === 1 ? "common.day1" : "common.days", { n: formatNumber(abs) });
}

/** Month counts with correct Arabic grammar (شهر / شهران / أشهر / شهرًا). */
export function formatMonths(n: number): string {
  const abs = Math.abs(n);
  if (i18n.language === "ar") {
    if (abs === 1) return "شهر واحد";
    if (abs === 2) return "شهران";
    if (abs >= 3 && abs <= 10) return `${abs} أشهر`;
    return `${abs} شهرًا`;
  }
  return i18n.t(abs === 1 ? "common.month1" : "common.months", { n: formatNumber(abs) });
}
