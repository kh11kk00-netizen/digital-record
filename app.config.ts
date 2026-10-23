import type { ConfigContext, ExpoConfig } from "expo/config";

// Keep the native identifiers and EAS project in app.json as the single source of truth.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "السجل الرقمي",
  slug: config.slug ?? "digital-record",
  ...(process.env.EXPO_OWNER ? { owner: process.env.EXPO_OWNER } : {}),
});
