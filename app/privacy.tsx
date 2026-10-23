import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Card, Header, Screen, Txt } from "@/components/ui";
import { GOOGLE_TERMS_URL, LEGAL_UPDATED, legalContent, SUPPORT_EMAIL } from "@/content/legal";
import { colors, radius, space } from "@/theme";

type Tab = "privacy" | "terms";

export default function PrivacyPolicyScreen() {
  const { i18n } = useTranslation();
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const [tab, setTab] = useState<Tab>(section === "terms" ? "terms" : "privacy");
  const ar = i18n.language.startsWith("ar");
  const copy = legalContent[ar ? "ar" : "en"];
  const textStyle = { textAlign: ar ? "right" as const : "left" as const, writingDirection: ar ? "rtl" as const : "ltr" as const };
  useEffect(() => { setTab(section === "terms" ? "terms" : "privacy"); }, [section]);

  const openEmail = async () => {
    try {
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("DIGITAL RECORD — Support / Privacy")}`);
    } catch { Alert.alert(copy.contact, copy.mailError + "\n" + SUPPORT_EMAIL); }
  };
  const openTerms = async () => {
    try { await Linking.openURL(GOOGLE_TERMS_URL); }
    catch { Alert.alert(copy.googleTerms, GOOGLE_TERMS_URL); }
  };

  return (
    <Screen edges={["top", "bottom"]}>
      <Header title={copy[tab]} onBack={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/more")} />
      <Txt variant="small" color={colors.muted} style={textStyle}>{copy.updated}: {LEGAL_UPDATED}</Txt>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: space.sm, marginVertical: space.lg }}>
        {(["privacy", "terms"] as const).map(value => (
          <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }}
            onPress={() => setTab(value)} style={{ flex: 1, padding: space.md, borderRadius: radius.md, backgroundColor: tab === value ? colors.navy : colors.surface }}>
            <Txt center weight="700" color={tab === value ? colors.white : colors.ink}>{copy[value]}</Txt>
          </Pressable>
        ))}
      </View>
      <View key={`${ar}-${tab}`} style={{ gap: space.md }}>
        {(tab === "privacy" ? copy.privacySections : copy.termsSections).map(section => (
          <Card key={section.title} style={{ gap: space.sm }}>
            <Txt accessibilityRole="header" variant="h3" style={textStyle}>{section.title}</Txt>
            <Txt selectable style={textStyle}>{section.body}</Txt>
          </Card>
        ))}
      </View>
      {tab === "privacy" ? <Button variant="ghost" label={copy.googleTerms} onPress={() => void openTerms()} style={{ marginTop: space.lg }} /> : null}
      <Card style={{ marginTop: space.lg, gap: space.md }}>
        <Txt variant="h3" style={textStyle}>{copy.contact}</Txt>
        <Txt selectable center style={{ writingDirection: "ltr" }}>{SUPPORT_EMAIL}</Txt>
        <Button icon="mail" label={copy.email} onPress={() => void openEmail()} />
      </Card>
    </Screen>
  );
}
