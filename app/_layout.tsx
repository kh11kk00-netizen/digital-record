import "@/i18n";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import i18n, { loadSavedLanguage } from "@/i18n";
import { onReminderTap } from "@/lib/notifications";
import { RecordsProvider, useRecords } from "@/store/records";
import { colors } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function Navigator({ langReady }: { langReady: boolean }) {
  const { ready } = useRecords();
  const router = useRouter();

  useEffect(() => {
    if (ready && langReady) SplashScreen.hideAsync().catch(() => {});
  }, [ready, langReady]);

  useEffect(() => onReminderTap((id) => router.push({ pathname: "/record/[id]", params: { id } })), [router]);

  if (!ready || !langReady) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="welcome" options={{ animation: "fade" }} />
      <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
      <Stack.Screen name="record/new" options={{ presentation: "card" }} />
      <Stack.Screen name="record/[id]" />
      <Stack.Screen name="assistant" />
      <Stack.Screen name="privacy" />
    </Stack>
  );
}

export default function RootLayout() {
  const [langReady, setLangReady] = useState(false);

  useEffect(() => {
    loadSavedLanguage()
      .then((needsRestart) => {
        if (needsRestart) Alert.alert(i18n.t("settings.restartTitle"), i18n.t("settings.restartBody"));
      })
      .finally(() => setLangReady(true));
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <RecordsProvider>
          <StatusBar style="dark" />
          <Navigator langReady={langReady} />
        </RecordsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
