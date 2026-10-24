import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// Anonymous reader identity issued by the reader server. It is kept in the
// Keychain/Keystore, never in records, backups or AsyncStorage.
const KEY = "dr.reader.identity.v1";
const options: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export async function loadReaderToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try { return await SecureStore.getItemAsync(KEY, options); } catch { return null; }
}

export async function saveReaderToken(token: string): Promise<void> {
  if (Platform.OS === "web") return;
  await SecureStore.setItemAsync(KEY, token, options);
}

export async function clearReaderToken(): Promise<void> {
  if (Platform.OS === "web") return;
  try { await SecureStore.deleteItemAsync(KEY, options); } catch { /* best effort */ }
}
