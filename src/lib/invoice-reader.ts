export const readerUrl = process.env.EXPO_PUBLIC_OCR_URL?.replace(/\/$/, "") ?? "";
export const extractionKeys = ["title", "brand", "merchant", "purchaseDate", "price", "currency", "invoiceNumber", "warrantyMonths", "warrantyEndsOn", "returnPeriodDays", "dueDate", "detail"] as const;
export type Extraction = Partial<Record<typeof extractionKeys[number], string>>;

type Field = typeof extractionKeys[number];
const purchaseFields: readonly Field[] = ["title", "brand", "merchant", "purchaseDate", "price", "currency", "invoiceNumber", "warrantyMonths", "warrantyEndsOn", "returnPeriodDays", "detail"];
const dueFields: readonly Field[] = ["title", "dueDate", "price", "currency", "merchant", "detail"];
/** The single allow-list of visible extracted fields for each record type. */
export const visibleRecordFields = {
  purchase: purchaseFields, warranty: purchaseFields, home: purchaseFields, other: purchaseFields,
  maintenance: dueFields, vehicle: dueFields, subscription: dueFields,
  document: ["title", "detail", "dueDate", "invoiceNumber"] as readonly Field[],
};
export function usableExtraction(type: keyof typeof visibleRecordFields, fields: Extraction): Extraction {
  return Object.fromEntries(Object.entries(fields).filter(([key]) => visibleRecordFields[type].includes(key as Field)));
}
export function defaultExtractionSelection(snapshot: Record<string, string | null>, fields: Extraction): Extraction {
  return Object.fromEntries(Object.entries(fields).filter(([key]) => !snapshot[key]?.trim()));
}

/** Apply only reviewed fields that have not changed since this scan started. */
export function mergeReviewedExtraction<T extends Record<typeof extractionKeys[number], string | null>>(current: T, snapshot: T | null, fields: Extraction): T {
  const next = { ...current };
  if (!snapshot) return next;
  for (const key of extractionKeys) {
    if (typeof fields[key] === "string" && current[key] === snapshot[key]) next[key] = fields[key] as T[typeof key];
  }
  return next;
}

const dateFields = new Set<Field>(["purchaseDate", "warrantyEndsOn", "dueDate"]);
const integerFields = new Set<Field>(["warrantyMonths", "returnPeriodDays"]);
/** Second check on the device: never fill a field with a date, amount or currency the form would reject. */
export function validExtractionValue(key: Field, raw: string): string | null {
  const value = raw.trim();
  if (!value || value.length > (key === "detail" ? 2000 : 200)) return null;
  if (dateFields.has(key)) {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m || Number(m[1]) < 1900 || Number(m[1]) > 2200) return null;
    const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return date.toISOString().slice(0, 10) === value ? value : null;
  }
  if (key === "price") return /^\d{1,12}(\.\d{1,4})?$/.test(value) && Number.isFinite(Number(value)) ? value : null;
  if (key === "currency") return /^[A-Z]{3}$/.test(value) ? value : null;
  if (integerFields.has(key)) return /^\d{1,4}$/.test(value) && Number(value) > 0 && Number(value) <= 1200 ? value : null;
  return value;
}

export async function readInvoice(image: string, token: string, signal: AbortSignal): Promise<Extraction> {
  if (!readerUrl.startsWith("https://")) throw Error("NOT_CONFIGURED");
  if (image.length > 8_000_000) throw Error("IMAGE_TOO_LARGE");
  let response: Response;
  try {
    response = await fetch(readerUrl + "/extract", {
      method: "POST", signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.trim()}` },
      body: JSON.stringify({ image }),
    });
  } catch (error) {
    // An aborted request is reported by the caller (cancel or timeout); anything else is a connection failure.
    if (signal.aborted) throw error;
    throw Error("NETWORK");
  }
  if (response.status === 404 || response.status >= 500 || !/^application\/(?:[\w.-]+\+)?json\b/i.test(response.headers.get("content-type") ?? "")) throw Error("SERVER_UNAVAILABLE");
  let data;
  try { data = await response.json(); } catch (error) {
    if (signal.aborted) throw error;
    throw Error("SERVER_UNAVAILABLE");
  }
  if (!data || typeof data !== "object") throw Error("SERVER_UNAVAILABLE");
  if (!response.ok) throw Error(typeof data.error === "string" ? data.error : "PROVIDER_UNAVAILABLE");
  if (!data.fields || typeof data.fields !== "object") throw Error("UNREADABLE");
  const fields: Extraction = {};
  for (const key of extractionKeys) {
    const value = typeof data.fields[key] === "string" ? validExtractionValue(key, data.fields[key]) : null;
    if (value !== null) fields[key] = value;
  }
  if (!Object.keys(fields).length) throw Error("UNREADABLE");
  return fields;
}
