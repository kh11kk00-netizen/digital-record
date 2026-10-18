import { Platform, Share } from "react-native";
import * as Sharing from "expo-sharing";
import i18n from "@/i18n";
import { formatDate, formatDays, formatMoney } from "./format";
import { insight } from "./status";
import type { DigitalRecord } from "./types";

/** "Claim kit": a ready-to-send warranty / return summary for the store or service center. */
export function buildClaimText(r: DigitalRecord): string {
  const t = i18n.t.bind(i18n);
  const i = insight(r);
  const rows: [string, string | null][] = [
    [t("fields.title"), r.title],
    [t("fields.brand"), r.brand],
    [t("fields.merchant"), r.merchant],
    [t("fields.purchaseDate"), r.purchaseDate ? formatDate(r.purchaseDate, "long") : null],
    [t("fields.invoiceNumber"), r.invoiceNumber],
    [t("fields.price"), r.price !== null ? formatMoney(r.price, r.currency) : null],
    [t("details.warrantyEnds"), i.warrantyEnd ? formatDate(i.warrantyEnd, "long") : null],
    [t("details.remaining"), i.warrantyDaysLeft !== null ? (i.warrantyDaysLeft >= 0 ? formatDays(i.warrantyDaysLeft) : t("status.expired")) : null],
    [t("fields.detail"), r.detail],
  ];
  const body = rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");
  const notes = r.notes.length ? `\n\n${t("details.notes")}:\n${r.notes.slice(0, 3).map((n) => `- ${n.text}`).join("\n")}` : "";
  return `${t("claim.heading")}\n\n${body}${notes}\n\n— ${t("app.name")} · DIGITAL RECORD`;
}

export async function shareClaim(r: DigitalRecord) {
  await Share.share({ message: buildClaimText(r), title: i18n.t("claim.heading") });
}

export async function shareInvoiceImage(r: DigitalRecord): Promise<boolean> {
  if (!r.imageUri || Platform.OS === "web") return false;
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(r.imageUri, { dialogTitle: i18n.t("claim.shareImage") });
  return true;
}
