import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import i18n from "@/i18n";
import { addDays, nextRecurring, parseLocalDate } from "./dates";
import { formatDays } from "./format";
import { warrantyEndOf } from "./status";
import type { DigitalRecord, RecordType } from "./types";

export type ReminderPrefs = { warranty: boolean; returns: boolean; services: boolean; hour: number };
export const DEFAULT_PREFS: ReminderPrefs = { warranty: true, returns: true, services: true, hour: 9 };

const MAX_SCHEDULED = 48; // below iOS 64 pending-notification limit
const WARRANTY_OFFSETS = [90, 30, 7, 1];
const RETURN_OFFSETS = [3, 1];
const DUE_OFFSETS: Partial<Record<RecordType, number[]>> = {
  maintenance: [30, 7, 1],
  vehicle: [30, 7, 1],
  subscription: [7, 1],
  document: [60, 30, 7],
};
const CHANNEL = "deadlines";
const supported = Platform.OS === "ios" || Platform.OS === "android";

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function ensurePermission(): Promise<boolean> {
  if (!supported) return false;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: i18n.t("notif.channel"),
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

type Candidate = { at: Date; title: string; body: string; recordId: string };

function at(dateIso: string, offset: number, hour: number): Date | null {
  const base = parseLocalDate(dateIso);
  if (!base) return null;
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - offset, hour, 0, 0, 0);
  return d.getTime() > Date.now() ? d : null;
}

export function buildPlan(records: readonly DigitalRecord[], prefs: ReminderPrefs): Candidate[] {
  const t = i18n.t.bind(i18n);
  const list: Candidate[] = [];
  for (const r of records) {
    if (prefs.warranty) {
      const end = warrantyEndOf(r);
      if (end) for (const o of WARRANTY_OFFSETS) {
        const d = at(end, o, prefs.hour);
        if (d) list.push({ at: d, recordId: r.id, title: t("notif.warrantyTitle"), body: t("notif.warrantyBody", { name: r.title, days: formatDays(o) }) });
      }
    }
    if (prefs.returns) {
      const end = addDays(r.purchaseDate, r.returnPeriodDays);
      if (end) for (const o of RETURN_OFFSETS) {
        const d = at(end, o, prefs.hour);
        if (d) list.push({ at: d, recordId: r.id, title: t("notif.returnTitle"), body: t("notif.returnBody", { name: r.title, days: formatDays(o) }) });
      }
    }
    if (prefs.services) {
      const due = nextRecurring(r.dueDate, r.repeatEveryMonths);
      const offsets = DUE_OFFSETS[r.type];
      if (due && offsets) for (const o of offsets) {
        const d = at(due, o, prefs.hour);
        if (d) list.push({ at: d, recordId: r.id, title: t("notif.dueTitle"), body: t("notif.dueBody", { name: r.title, days: formatDays(o) }) });
      }
    }
  }
  return list.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_SCHEDULED);
}

let syncing: Promise<number> | null = null;

/** Cancels and re-schedules the rolling queue of local reminders. Returns how many were scheduled. */
export function syncReminders(records: readonly DigitalRecord[], prefs: ReminderPrefs): Promise<number> {
  if (!supported) return Promise.resolve(0);
  const run = async () => {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return 0;
    await Notifications.cancelAllScheduledNotificationsAsync();
    const plan = buildPlan(records, prefs);
    for (const c of plan) {
      await Notifications.scheduleNotificationAsync({
        content: { title: c.title, body: c.body, data: { recordId: c.recordId } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: c.at,
          ...(Platform.OS === "android" ? { channelId: CHANNEL } : {}),
        },
      });
    }
    return plan.length;
  };
  const chained = (syncing ?? Promise.resolve(0)).catch(() => 0).then(run);
  syncing = chained;
  return chained.catch(() => 0);
}

export function onReminderTap(handler: (recordId: string) => void): () => void {
  if (!supported) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((res) => {
    const id = res.notification.request.content.data?.recordId;
    if (typeof id === "string") handler(id);
  });
  return () => sub.remove();
}
