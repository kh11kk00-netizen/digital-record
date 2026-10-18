import type { ExpoConfig } from "expo/config";

/**
 * السجل الرقمي — DIGITAL RECORD
 * غيّر المعرّفين أدناه لمعرّف فريد تملكه قبل أول بناء (مثلاً com.yourname.digitalrecord).
 */
const IOS_BUNDLE_ID = process.env.IOS_BUNDLE_ID ?? "com.digitalrecord.app";
const ANDROID_PACKAGE = process.env.ANDROID_PACKAGE ?? "com.digitalrecord.app";
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? "";
const EXPO_OWNER = process.env.EXPO_OWNER ?? undefined;

const NAVY = "#102B4E";

const config: ExpoConfig = {
  name: "السجل الرقمي",
  slug: "digital-record",
  owner: EXPO_OWNER,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "digitalrecord",
  userInterfaceStyle: "light",
  // Native names & permission texts per language (App Store / Play localized display)
  locales: {
    ar: "./locales/ar.json",
    en: "./locales/en.json",
    fr: "./locales/fr.json",
    es: "./locales/es.json",
    de: "./locales/de.json",
    tr: "./locales/tr.json",
    pt: "./locales/pt.json",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: IOS_BUNDLE_ID,
    buildNumber: "1",
    infoPlist: {
      CFBundleAllowMixedLocalizations: true,
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: "Digital Record uses the camera to photograph invoices for your records.",
      NSPhotoLibraryUsageDescription: "Choose invoice images from your photo library to add them to your records.",
    },
  },
  android: {
    package: ANDROID_PACKAGE,
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: NAVY,
    },
    permissions: ["POST_NOTIFICATIONS", "CAMERA"],
  },
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-localization",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 180,
        resizeMode: "contain",
        backgroundColor: NAVY,
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/images/notification-icon.png",
        color: "#2463EB",
        defaultChannel: "deadlines",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Choose invoice images from your photo library to add them to your records.",
        cameraPermission: "Digital Record uses the camera to photograph invoices for your records.",
      },
    ],
  ],
  extra: {
    // Lets React Native mirror layouts automatically for Arabic (RTL).
    supportsRTL: true,
    router: {},
    ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
  },
  experiments: {
    typedRoutes: false,
  },
};

export default config;
