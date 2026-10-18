import { addDays, addMonths, daysBetween, daysUntil, nextRecurring } from "./dates";
import { DUE_LIKE, PURCHASE_LIKE, type DigitalRecord } from "./types";

export type Tone = "success" | "warning" | "danger" | "neutral" | "info";
export type RecordStatus =
  | "active" // under warranty
  | "expiring" // warranty ends ≤ 30 days
  | "expired" // warranty ended
  | "incomplete" // purchase without warranty data
  | "upcoming" // due date later
  | "dueSoon" // due ≤ 14 days
  | "overdue" // due date passed
  | "none";

export const SOON_DAYS = 30;
export const DUE_SOON_DAYS = 14;

export type RecordInsight = {
  warrantyEnd: string | null;
  warrantyDaysLeft: number | null;
  warrantyProgress: number | null; // 0..1 elapsed share
  returnEnd: string | null;
  returnDaysLeft: number | null;
  nextDue: string | null;
  dueDaysLeft: number | null;
  status: RecordStatus;
  tone: Tone;
};

export function warrantyEndOf(r: DigitalRecord): string | null {
  return r.warrantyEndsOn ?? addMonths(r.purchaseDate, r.warrantyMonths);
}

export function insight(r: DigitalRecord): RecordInsight {
  const warrantyEnd = warrantyEndOf(r);
  const warrantyDaysLeft = daysUntil(warrantyEnd);
  const total = daysBetween(r.purchaseDate, warrantyEnd);
  const warrantyProgress =
    total && total > 0 && warrantyDaysLeft !== null
      ? Math.min(1, Math.max(0, (total - Math.max(0, warrantyDaysLeft)) / total))
      : null;
  const returnEnd = addDays(r.purchaseDate, r.returnPeriodDays);
  const returnDaysLeft = daysUntil(returnEnd);
  const nextDue = nextRecurring(r.dueDate, r.repeatEveryMonths);
  const dueDaysLeft = daysUntil(nextDue);

  let status: RecordStatus = "none";
  if (DUE_LIKE.includes(r.type) && nextDue) {
    status = dueDaysLeft! < 0 ? "overdue" : dueDaysLeft! <= DUE_SOON_DAYS ? "dueSoon" : "upcoming";
  } else if (warrantyEnd) {
    status = warrantyDaysLeft! < 0 ? "expired" : warrantyDaysLeft! <= SOON_DAYS ? "expiring" : "active";
  } else if (PURCHASE_LIKE.includes(r.type)) {
    status = "incomplete";
  } else if (nextDue) {
    status = dueDaysLeft! < 0 ? "overdue" : dueDaysLeft! <= DUE_SOON_DAYS ? "dueSoon" : "upcoming";
  }

  const tone: Tone =
    status === "active" || status === "upcoming"
      ? "success"
      : status === "expiring" || status === "dueSoon" || status === "incomplete"
        ? "warning"
        : status === "expired" || status === "overdue"
          ? "danger"
          : "neutral";

  return { warrantyEnd, warrantyDaysLeft, warrantyProgress, returnEnd, returnDaysLeft, nextDue, dueDaysLeft, status, tone };
}

export function isUnderWarranty(r: DigitalRecord) {
  const s = insight(r).status;
  return s === "active" || s === "expiring";
}

export type Deadline = {
  key: string;
  recordId: string;
  kind: "warranty" | "return" | "due" | "incomplete";
  date: string | null;
  daysLeft: number | null;
};

/** All deadlines worth surfacing (alerts screen + home timeline). Sorted soonest first. */
export function collectDeadlines(records: readonly DigitalRecord[], horizonDays = 90): Deadline[] {
  const out: Deadline[] = [];
  for (const r of records) {
    const i = insight(r);
    if (i.warrantyEnd && i.warrantyDaysLeft !== null && i.warrantyDaysLeft >= -7 && i.warrantyDaysLeft <= horizonDays) {
      out.push({ key: `${r.id}:w`, recordId: r.id, kind: "warranty", date: i.warrantyEnd, daysLeft: i.warrantyDaysLeft });
    }
    if (i.returnEnd && i.returnDaysLeft !== null && i.returnDaysLeft >= 0 && i.returnDaysLeft <= 14) {
      out.push({ key: `${r.id}:r`, recordId: r.id, kind: "return", date: i.returnEnd, daysLeft: i.returnDaysLeft });
    }
    if (i.nextDue && i.dueDaysLeft !== null && i.dueDaysLeft <= Math.min(horizonDays, 45)) {
      out.push({ key: `${r.id}:d`, recordId: r.id, kind: "due", date: i.nextDue, daysLeft: i.dueDaysLeft });
    }
    if (i.status === "incomplete") {
      out.push({ key: `${r.id}:i`, recordId: r.id, kind: "incomplete", date: null, daysLeft: null });
    }
  }
  return out.sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
}
