import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { I18nManager, Platform } from "react-native";
import ar from "./locales/ar";
import { readerMessages } from "./reader";
import de from "./locales/de";
import en from "./locales/en";
import es from "./locales/es";
import fr from "./locales/fr";
import pt from "./locales/pt";
import tr from "./locales/tr";

export const LANGUAGES = [
  { code: "ar", label: "العربية", rtl: true },
  { code: "en", label: "English", rtl: false },
  { code: "fr", label: "Français", rtl: false },
  { code: "es", label: "Español", rtl: false },
  { code: "de", label: "Deutsch", rtl: false },
  { code: "pt", label: "Português", rtl: false },
  { code: "tr", label: "Türkçe", rtl: false },
] as const;
export type LanguageCode = (typeof LANGUAGES)[number]["code"];

const KEY_LANG = "dr:lang:v1";
const supported = LANGUAGES.map((l) => l.code) as string[];

export function isRtlLanguage(code: string) {
  return LANGUAGES.some((l) => l.code === code && l.rtl);
}

function deviceLanguage(): LanguageCode {
  try {
    for (const l of getLocales()) {
      const code = (l.languageCode ?? "").toLowerCase();
      if (supported.includes(code)) return code as LanguageCode;
    }
  } catch {
    // ignore
  }
  return "en";
}

/** Region currency of the device (SAR, AED, USD, EUR...) used as the default for new records. */
export function deviceCurrency(): string {
  try {
    return getLocales()[0]?.currencyCode ?? "USD";
  } catch {
    return "USD";
  }
}

void i18n.use(initReactI18next).init({
  resources: { ar: { t: { ...ar, reader: readerMessages.ar } }, en: { t: { ...en, reader: readerMessages.en } }, fr: { t: fr }, es: { t: es }, de: { t: de }, pt: { t: pt }, tr: { t: tr } },
  ns: ["t"],
  defaultNS: "t",
  lng: deviceLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

function applyDirection(code: string): boolean {
  const rtl = isRtlLanguage(code);
  if (Platform.OS === "web") {
    if (typeof document !== "undefined") document.documentElement.dir = rtl ? "rtl" : "ltr";
    return false;
  }
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.forceRTL(rtl);
    return true; // native layout direction changes on next launch
  }
  return false;
}

/** Call once at startup. Returns true if the layout direction will flip after restart. */
export async function loadSavedLanguage(): Promise<boolean> {
  try {
    const saved = await AsyncStorage.getItem(KEY_LANG);
    if (saved && supported.includes(saved) && saved !== i18n.language) await i18n.changeLanguage(saved);
  } catch {
    // ignore
  }
  return applyDirection(i18n.language);
}

/** Changes language. Returns true if the app must be restarted to mirror the layout. */
export async function setLanguage(code: LanguageCode): Promise<boolean> {
  await i18n.changeLanguage(code);
  await AsyncStorage.setItem(KEY_LANG, code).catch(() => {});
  return applyDirection(code);
}

export const isRTL = () => (Platform.OS === "web" ? isRtlLanguage(i18n.language) : I18nManager.isRTL);

export default i18n;
