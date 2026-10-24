import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { deleteImage } from "@/lib/files";
import { clearReaderToken } from "@/lib/reader-identity";
import { uid } from "@/lib/id";
import { DEFAULT_PREFS, syncReminders, type ReminderPrefs } from "@/lib/notifications";
import { RECORD_TYPES, type DigitalRecord, type RecordDraft } from "@/lib/types";

const KEY_RECORDS = "dr:records:v1";
const KEY_PREFS = "dr:prefs:v1";
const KEY_ONBOARDED = "dr:onboarded:v1";

export const BACKUP_FORMAT = "digital-record-backup";
export const BACKUP_VERSION = 1;

type Store = {
  ready: boolean;
  records: DigitalRecord[];
  prefs: ReminderPrefs;
  onboarded: boolean;
  getRecord: (id: string) => DigitalRecord | undefined;
  addRecord: (draft: RecordDraft) => DigitalRecord;
  updateRecord: (id: string, patch: Partial<RecordDraft>) => void;
  deleteRecord: (id: string) => void;
  addNote: (id: string, text: string) => void;
  toggleFavorite: (id: string) => void;
  setPrefs: (p: Partial<ReminderPrefs>) => void;
  completeOnboarding: () => void;
  exportBackup: () => string;
  importBackup: (json: string) => number;
  resetAll: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

function sanitize(raw: unknown): DigitalRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.title !== "string") return null;
  const str = (v: unknown) => (typeof v === "string" && v.length ? v : null);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const now = new Date().toISOString();
  return {
    id: r.id,
    type: RECORD_TYPES.includes(r.type as never) ? (r.type as DigitalRecord["type"]) : "other",
    title: r.title.slice(0, 200),
    brand: str(r.brand),
    merchant: str(r.merchant),
    purchaseDate: str(r.purchaseDate),
    price: num(r.price),
    currency: str(r.currency),
    invoiceNumber: str(r.invoiceNumber),
    warrantyMonths: num(r.warrantyMonths),
    warrantyEndsOn: str(r.warrantyEndsOn),
    returnPeriodDays: num(r.returnPeriodDays),
    dueDate: str(r.dueDate),
    repeatEveryMonths: num(r.repeatEveryMonths),
    detail: str(r.detail),
    imageUri: str(r.imageUri),
    notes: Array.isArray(r.notes)
      ? (r.notes as unknown[]).filter((n): n is DigitalRecord["notes"][number] => !!n && typeof (n as { text?: unknown }).text === "string")
      : [],
    favorite: r.favorite === true,
    createdAt: str(r.createdAt) ?? now,
    updatedAt: str(r.updatedAt) ?? now,
  };
}

export function RecordsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [records, setRecords] = useState<DigitalRecord[]>([]);
  const [prefs, setPrefsState] = useState<ReminderPrefs>(DEFAULT_PREFS);
  const [onboarded, setOnboarded] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const [r, p, o] = await AsyncStorage.multiGet([KEY_RECORDS, KEY_PREFS, KEY_ONBOARDED]);
        if (r[1]) {
          const parsed: unknown = JSON.parse(r[1]);
          if (Array.isArray(parsed)) setRecords(parsed.map(sanitize).filter((x): x is DigitalRecord => !!x));
        }
        if (p[1]) setPrefsState({ ...DEFAULT_PREFS, ...(JSON.parse(p[1]) as Partial<ReminderPrefs>) });
        setOnboarded(o[1] === "1");
      } catch {
        // corrupted storage -> start clean but keep app usable
      } finally {
        loaded.current = true;
        setReady(true);
      }
    })();
  }, []);

  // Persist + resync reminders whenever data changes
  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(KEY_RECORDS, JSON.stringify(records)).catch(() => {});
    const timer = setTimeout(() => void syncReminders(records, prefs), 600);
    return () => clearTimeout(timer);
  }, [records, prefs]);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(KEY_PREFS, JSON.stringify(prefs)).catch(() => {});
  }, [prefs]);

  const getRecord = useCallback((id: string) => records.find((r) => r.id === id), [records]);

  const addRecord = useCallback((draft: RecordDraft) => {
    const now = new Date().toISOString();
    const rec: DigitalRecord = { ...draft, notes: draft.notes ?? [], favorite: draft.favorite ?? false, id: uid(), createdAt: now, updatedAt: now };
    setRecords((prev) => [rec, ...prev]);
    return rec;
  }, []);

  const updateRecord = useCallback((id: string, patch: Partial<RecordDraft>) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (patch.imageUri !== undefined && patch.imageUri !== r.imageUri) deleteImage(r.imageUri);
        return { ...r, ...patch, updatedAt: new Date().toISOString() };
      }),
    );
  }, []);

  const deleteRecord = useCallback((id: string) => {
    setRecords((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target) deleteImage(target.imageUri);
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  const addNote = useCallback((id: string, text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setRecords((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, notes: [{ id: uid(), text: clean.slice(0, 1000), createdAt: new Date().toISOString() }, ...r.notes], updatedAt: new Date().toISOString() } : r,
      ),
    );
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r)));
  }, []);

  const setPrefs = useCallback((p: Partial<ReminderPrefs>) => setPrefsState((prev) => ({ ...prev, ...p })), []);

  const completeOnboarding = useCallback(() => {
    setOnboarded(true);
    AsyncStorage.setItem(KEY_ONBOARDED, "1").catch(() => {});
  }, []);

  const exportBackup = useCallback(
    () =>
      JSON.stringify(
        { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), records: records.map((r) => ({ ...r, imageUri: null })) },
        null,
        2,
      ),
    [records],
  );

  const importBackup = useCallback((json: string) => {
    const data = JSON.parse(json) as { format?: string; records?: unknown[] };
    if (data.format !== BACKUP_FORMAT || !Array.isArray(data.records)) throw new Error("invalid-backup");
    const incoming = data.records.map(sanitize).filter((x): x is DigitalRecord => !!x);
    setRecords((prev) => {
      const map = new Map<string, DigitalRecord>(prev.map((r) => [r.id, r] as const));
      for (const r of incoming) map.set(r.id, { ...r, imageUri: map.get(r.id)?.imageUri ?? null });
      return Array.from(map.values()).sort((a: DigitalRecord, b: DigitalRecord) => b.createdAt.localeCompare(a.createdAt));
    });
    return incoming.length;
  }, []);

  const resetAll = useCallback(async () => {
    records.forEach((r) => deleteImage(r.imageUri));
    setRecords([]);
    await AsyncStorage.multiRemove([KEY_RECORDS]);
    await clearReaderToken();
  }, [records]);

  const value = useMemo<Store>(
    () => ({ ready, records, prefs, onboarded, getRecord, addRecord, updateRecord, deleteRecord, addNote, toggleFavorite, setPrefs, completeOnboarding, exportBackup, importBackup, resetAll }),
    [ready, records, prefs, onboarded, getRecord, addRecord, updateRecord, deleteRecord, addNote, toggleFavorite, setPrefs, completeOnboarding, exportBackup, importBackup, resetAll],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRecords(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRecords must be used inside RecordsProvider");
  return v;
}
