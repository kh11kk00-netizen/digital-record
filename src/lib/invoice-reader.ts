export const readerUrl = process.env.EXPO_PUBLIC_OCR_URL?.replace(/\/$/, "") ?? "";
export const extractionKeys = ["title", "brand", "merchant", "purchaseDate", "price", "currency", "invoiceNumber", "warrantyMonths", "warrantyEndsOn", "returnPeriodDays", "dueDate", "detail"] as const;
export type Extraction = Partial<Record<typeof extractionKeys[number], string>>;

export async function readInvoice(image: string, token: string, signal: AbortSignal): Promise<Extraction> {
  if (!readerUrl.startsWith("https://")) throw Error("NOT_CONFIGURED");
  if (image.length > 8_000_000) throw Error("IMAGE_TOO_LARGE");
  const response = await fetch(readerUrl + "/extract", {
    method: "POST", signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.trim()}` },
    body: JSON.stringify({ image }),
  });
  const data = await response.json();
  if (!response.ok) throw Error(typeof data.error === "string" ? data.error : "PROVIDER_UNAVAILABLE");
  if (!data.fields || typeof data.fields !== "object") throw Error("UNREADABLE");
  const fields: Extraction = {};
  for (const key of extractionKeys) {
    if (typeof data.fields[key] === "string" && data.fields[key].length <= 2000) fields[key] = data.fields[key];
  }
  if (!Object.keys(fields).length) throw Error("UNREADABLE");
  return fields;
}
