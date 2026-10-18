import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";

/**
 * Copies a picked image into the app's private document folder so it survives
 * cache cleanup. Falls back to the original URI if copying is not possible (e.g. web).
 */
export function persistImage(uri: string): string {
  if (Platform.OS === "web") return uri;
  try {
    const dir = new Directory(Paths.document, "invoices");
    if (!dir.exists) dir.create({ intermediates: true });
    const ext = (uri.split("?")[0].split(".").pop() || "jpg").toLowerCase().slice(0, 5);
    const dest = new File(dir, `inv-${Date.now()}.${ext}`);
    new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return uri;
  }
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
