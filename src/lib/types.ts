export const RECORD_TYPES = [
  "purchase",
  "warranty",
  "maintenance",
  "vehicle",
  "home",
  "subscription",
  "document",
  "other",
] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export type RecordNote = { id: string; text: string; createdAt: string };

export type DigitalRecord = {
  id: string;
  type: RecordType;
  title: string;
  brand: string | null;
  merchant: string | null;
  /** YYYY-MM-DD */
  purchaseDate: string | null;
  price: number | null;
  /** ISO 4217 */
  currency: string | null;
  invoiceNumber: string | null;
  warrantyMonths: number | null;
  warrantyEndsOn: string | null;
  returnPeriodDays: number | null;
  /** Next due / expiry date for services, subscriptions, documents, vehicles */
  dueDate: string | null;
  repeatEveryMonths: number | null;
  /** Free detail e.g. plate number, policy number, service kind */
  detail: string | null;
  imageUri: string | null;
  notes: RecordNote[];
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecordDraft = Omit<DigitalRecord, "id" | "createdAt" | "updatedAt" | "notes" | "favorite"> & {
  notes?: RecordNote[];
  favorite?: boolean;
};

/** Types where purchase / warranty fields matter */
export const PURCHASE_LIKE: readonly RecordType[] = ["purchase", "warranty", "home", "other"];
/** Types driven by a due/expiry date */
export const DUE_LIKE: readonly RecordType[] = ["maintenance", "vehicle", "subscription", "document"];
