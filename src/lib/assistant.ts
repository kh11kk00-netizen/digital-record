import i18n from "@/i18n";
import { formatDate, formatDays, formatMoney } from "./format";
import { insight } from "./status";
import type { DigitalRecord } from "./types";

/**
 * On-device assistant: answers ONLY from the user's records, never invents data,
 * works offline in every supported language. Nothing leaves the phone.
 */
export type AssistantAnswer = { text: string; recordIds: string[] };

function normalize(v: string) {
  return v
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const STOP = new Set([
  "كيف", "متى", "كم", "هل", "اين", "ماذا", "ما", "عن", "من", "في", "الي", "علي", "هذا", "هذه", "ضمان", "فاتوره", "جهازي", "ينتهي", "انتهاء", "متي",
  "what", "when", "where", "which", "how", "about", "from", "with", "this", "that", "the", "for", "show", "tell", "does", "warranty", "invoice", "receipt", "expire", "ends", "my",
  "quand", "comment", "garantie", "facture", "cuando", "garantia", "factura", "wann", "garantie", "rechnung", "quando", "fatura", "garanti", "zaman", "ne",
]);

function nameScore(question: string, r: DigitalRecord): number {
  const q = normalize(question).split(" ").filter((w) => w.length >= 2 && !STOP.has(w));
  const hay = normalize(`${r.title} ${r.brand ?? ""} ${r.merchant ?? ""} ${r.detail ?? ""}`).split(" ").filter((w) => w.length >= 2);
  let score = 0;
  for (const w of q) {
    for (const h of hay) {
      if (h === w) score += 3;
      else if (w.length >= 3 && h.length >= 3 && (h.includes(w) || w.includes(h))) score += 1;
    }
  }
  return score;
}

const RX = {
  warranty: /ضمان|ضمانات|warrant|guarantee|garant|gew[aä]hr/,
  invoice: /فاتوره|فواتير|ايصال|invoice|receipt|bill|factur|rechnung|fatura|recibo|re[cç]u/,
  soon: /قريب|هذا الشهر|خلال شهر|الشهر|soon|this month|next month|30|coming|bient[oô]t|ce mois|pronto|este mes|bald|diesen monat|em breve|este m[eê]s|yak[iı]nda|bu ay/,
  expired: /منتهي|انتهي|انتهت|expired|ended|expir[eé]|vencid|abgelaufen|expirad|s[uü]resi dol/,
  active: /ساري|تحت الضمان|مشمول|active|covered|valid|under warranty|couvert|vigente|g[uü]ltig|v[aá]lid|ge[cç]erli/,
  due: /صيانه|اشتراك|موعد|تجديد|تامين|مركبه|سياره|مستند|هويه|جواز|maintenance|service|subscription|renew|appointment|insurance|vehicle|car|document|passport|entretien|abonnement|mantenimiento|suscrip|wartung|abo|termin|manuten|assinatura|bak[iı]m|abonelik|randevu/,
  spend: /صرفت|مصروف|اجمالي|قيمه|مجموع|total|spent|spend|value|worth|d[eé]pens|gast|ausgegeben|gesamt|gasto|harcad|toplam/,
  count: /كم سجل|عدد|how many|count|combien|cu[aá]nt|wie viele|quant|ka[cç] tane/,
};

function line(r: DigitalRecord): string {
  const t = i18n.t.bind(i18n);
  const i = insight(r);
  if (i.warrantyEnd) {
    const left = i.warrantyDaysLeft ?? 0;
    return left >= 0
      ? t("ai.lineWarrantyLeft", { name: r.title, date: formatDate(i.warrantyEnd), days: formatDays(left) })
      : t("ai.lineWarrantyEnded", { name: r.title, date: formatDate(i.warrantyEnd) });
  }
  if (i.nextDue) {
    return t("ai.lineDue", { name: r.title, date: formatDate(i.nextDue), days: formatDays(Math.max(0, i.dueDaysLeft ?? 0)) });
  }
  return t("ai.lineBasic", { name: r.title, type: t(`types.${r.type}`) });
}

function invoiceLine(r: DigitalRecord): string {
  const t = i18n.t.bind(i18n);
  const parts = [
    r.merchant ? t("ai.fMerchant", { v: r.merchant }) : null,
    r.purchaseDate ? t("ai.fDate", { v: formatDate(r.purchaseDate) }) : null,
    r.price !== null ? t("ai.fPrice", { v: formatMoney(r.price, r.currency) }) : null,
    r.invoiceNumber ? t("ai.fNumber", { v: r.invoiceNumber }) : null,
    r.imageUri ? t("ai.fImage") : t("ai.fNoImage"),
  ].filter(Boolean);
  return `${r.title}: ${parts.join(" · ")}`;
}

function list(items: DigitalRecord[], header: string, fmt: (r: DigitalRecord) => string = line): AssistantAnswer {
  const top = items.slice(0, 6);
  const more = items.length > top.length ? `\n${i18n.t("ai.andMore", { n: items.length - top.length })}` : "";
  return { text: `${header}\n${top.map((r) => `• ${fmt(r)}`).join("\n")}${more}`, recordIds: top.map((r) => r.id) };
}

export function askAssistant(question: string, records: readonly DigitalRecord[]): AssistantAnswer {
  const t = i18n.t.bind(i18n);
  const q = normalize(question);
  if (!q) return { text: t("ai.help"), recordIds: [] };
  if (!records.length) return { text: t("ai.noRecords"), recordIds: [] };

  const scored = records.map((r) => ({ r, s: nameScore(question, r) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  const best = scored.length ? scored.filter((x) => x.s === scored[0].s).map((x) => x.r) : [];

  // Specific item questions
  if (best.length) {
    if (RX.invoice.test(q)) return list(best, t("ai.invoiceFound"), invoiceLine);
    if (best.length === 1) {
      const r = best[0];
      const i = insight(r);
      if (RX.warranty.test(q) && !i.warrantyEnd) return { text: t("ai.noWarrantyData", { name: r.title }), recordIds: [r.id] };
      const extra = r.notes.length ? `\n${t("ai.lastNote", { v: r.notes[0].text })}` : "";
      return { text: `${line(r)}${extra}`, recordIds: [r.id] };
    }
    return list(best, t("ai.multipleMatches"));
  }

  const withWarranty = records.filter((r) => insight(r).warrantyEnd);

  if (RX.spend.test(q)) {
    const totals = new Map<string, number>();
    for (const r of records) if (r.price !== null) totals.set(r.currency ?? "", (totals.get(r.currency ?? "") ?? 0) + r.price);
    if (!totals.size) return { text: t("ai.noPrices"), recordIds: [] };
    const txt = Array.from(totals.entries()).map(([c, v]) => formatMoney(v, c || null)).join(" + ");
    const protectedValue = records.filter((r) => r.price !== null && ["active", "expiring"].includes(insight(r).status));
    const pv = new Map<string, number>();
    for (const r of protectedValue) pv.set(r.currency ?? "", (pv.get(r.currency ?? "") ?? 0) + (r.price ?? 0));
    const pvTxt = pv.size ? `\n${t("ai.protectedValue", { v: Array.from(pv.entries()).map(([c, v]) => formatMoney(v, c || null)).join(" + ") })}` : "";
    return { text: `${t("ai.totalSpent", { v: txt })}${pvTxt}`, recordIds: [] };
  }

  if (RX.count.test(q)) {
    const under = records.filter((r) => ["active", "expiring"].includes(insight(r).status)).length;
    return { text: t("ai.countSummary", { n: records.length, w: under }), recordIds: [] };
  }

  if (RX.warranty.test(q) || RX.soon.test(q) || RX.expired.test(q) || RX.active.test(q)) {
    if (RX.expired.test(q) && !RX.soon.test(q)) {
      const items = withWarranty.filter((r) => insight(r).status === "expired");
      return items.length ? list(items, t("ai.expiredHeader")) : { text: t("ai.noneExpired"), recordIds: [] };
    }
    if (RX.soon.test(q)) {
      const items = records
        .filter((r) => {
          const i = insight(r);
          return (i.warrantyDaysLeft !== null && i.warrantyDaysLeft >= 0 && i.warrantyDaysLeft <= 31) || (i.dueDaysLeft !== null && i.dueDaysLeft >= 0 && i.dueDaysLeft <= 31);
        })
        .sort((a, b) => (insight(a).warrantyDaysLeft ?? insight(a).dueDaysLeft ?? 0) - (insight(b).warrantyDaysLeft ?? insight(b).dueDaysLeft ?? 0));
      return items.length ? list(items, t("ai.soonHeader")) : { text: t("ai.noneSoon"), recordIds: [] };
    }
    const items = withWarranty.filter((r) => ["active", "expiring"].includes(insight(r).status));
    return items.length ? list(items, t("ai.activeHeader", { n: items.length })) : { text: t("ai.noneActive"), recordIds: [] };
  }

  if (RX.due.test(q)) {
    const items = records.filter((r) => insight(r).nextDue).sort((a, b) => (insight(a).dueDaysLeft ?? 0) - (insight(b).dueDaysLeft ?? 0));
    return items.length ? list(items, t("ai.dueHeader")) : { text: t("ai.noneDue"), recordIds: [] };
  }

  if (RX.invoice.test(q)) {
    const items = records.filter((r) => r.imageUri || r.invoiceNumber);
    return items.length ? list(items, t("ai.invoicesHeader"), invoiceLine) : { text: t("ai.noInvoices"), recordIds: [] };
  }

  return { text: t("ai.notFound"), recordIds: [] };
}
