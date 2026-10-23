import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";

/**
 * Copies a picked image into the app's private document folder so it survives
 * cache cleanup. A failed native copy must prevent saving a temporary URI.
 */
export function persistImage(uri: string): string {
  if (Platform.OS === "web") return uri;
  let dest: File | undefined;
  try {
    const dir = new Directory(Paths.document, "invoices");
    if (!dir.exists) dir.create({ intermediates: true });
    const ext = (uri.split("?")[0].split(".").pop() || "jpg").toLowerCase().slice(0, 5);
    dest = new File(dir, `inv-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
    new File(uri).copy(dest);
    if (!dest.exists || dest.size === 0) throw new Error("IMAGE_SAVE_FAILED");
    return dest.uri;
  } catch {
    try { if (dest?.exists) dest.delete(); } catch { /* best effort partial-copy cleanup */ }
    throw new Error("IMAGE_SAVE_FAILED");
  }
}

/** Never delete a library original: only files within this app's cache. */
export function deleteCachedImage(uri: string | null) {
  if (!uri || Platform.OS === "web" || !uri.startsWith(Paths.cache.uri)) return;
  try { const f = new File(uri); if (f.exists) f.delete(); } catch { /* best effort */ }
}

export function deleteImage(uri: string | null) {
  if (!uri || Platform.OS === "web" || !uri.includes("/invoices/")) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // ignore
  }
}

export function writeTempText(name: string, content: string): string | null {
  if (Platform.OS === "web") return null;
  try {
    const f = new File(Paths.cache, name);
    if (f.exists) f.delete();
    f.create();
    f.write(content);
    return f.uri;
  } catch {
    return null;
  }
}

export async function readTextFile(uri: string): Promise<string> {
  if (Platform.OS === "web") {
    const res = await fetch(uri);
    return res.text();
  }
  return new File(uri).text();
}
