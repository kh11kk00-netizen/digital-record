import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { LogoMark } from "@/components/Logo";
import { Button, Row, Txt, type FeatherName } from "@/components/ui";
import { useRecords } from "@/store/records";
import { colors, radius, space } from "@/theme";

const FEATURES: { icon: FeatherName; key: string }[] = [
  { icon: "file-text", key: "invoices" },
  { icon: "shield", key: "protected" },
  { icon: "bell", key: "alerts" },
  { icon: "message-circle", key: "assistant" },
];

/** Layered translucent "records" illustration from the design. */
function Stackart() {
  const layer = (rot: number, op: number, dx: number, dy: number) => (
    <View
      key={rot}
      style={{
        position: "absolute",
        width: 170,
        height: 120,
        borderRadius: 22,
        backgroundColor: `rgba(77,134,240,${op})`,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.18)",
        transform: [{ translateX: dx }, { translateY: dy }, { rotate: `${rot}deg` }],
      }}
    />
  );
  return (
    <View style={{ height: 190, alignItems: "center", justifyContent: "center", marginVertical: space.lg }}>
      {layer(-14, 0.22, -18, 22)}
      {layer(-6, 0.32, -6, 8)}
      {layer(4, 0.45, 8, -8)}
    </View>
  );
}

export default function Welcome() {
  const { t } = useTranslation();
  const router = useRouter();
  const { completeOnboarding } = useRecords();

  const start = () => {
    completeOnboarding();
    router.replace("/(tabs)");
  };
  const restore = () => {
    completeOnboarding();
    router.replace({ pathname: "/(tabs)/more", params: { restore: "1" } });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.navy }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: space.xl, justifyContent: "space-between" }}>
        <View style={{ alignItems: "center", marginTop: space.xxl }}>
          <View style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 28, padding: 6 }}>
            <LogoMark size={84} color={colors.white} page="#9DB8F2" />
          </View>
          <Txt variant="h1" color={colors.white} center style={{ fontSize: 30, lineHeight: 40, marginTop: space.md }}>
            {t("app.name")}
          </Txt>
          <Txt variant="small" color="#AFC0DA" center style={{ letterSpacing: 4, writingDirection: "ltr" }}>
            DIGITAL RECORD
          </Txt>
          <Txt variant="h2" color={colors.white} center style={{ marginTop: space.xl }}>
            {t("app.tagline")}
          </Txt>
          <Txt variant="small" color="#C9D5E8" center style={{ marginTop: space.sm }}>
            {t("app.subtitle")}
          </Txt>
        </View>

        <Stackart />

        <Row style={{ flexWrap: "wrap", justifyContent: "center", marginBottom: space.xl }} gap={8}>
          {FEATURES.map((f) => (
            <Row key={f.key} gap={6} style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Feather name={f.icon} size={14} color="#9DB8F2" />
              <Txt variant="tiny" color={colors.white}>
                {t(`welcome.f.${f.key}`)}
              </Txt>
            </Row>
          ))}
        </Row>

        <View style={{ gap: space.md }}>
          <Button label={t("welcome.start")} variant="white" icon={undefined} onPress={start} />
          <Pressable onPress={restore} hitSlop={10} style={{ alignItems: "center", paddingVertical: space.sm }}>
            <Txt variant="small" color="#C9D5E8" center>
              {t("welcome.haveBackup")} <Txt variant="small" color={colors.white} weight="700">{t("welcome.restore")}</Txt>
            </Txt>
          </Pressable>
          <Txt variant="tiny" color="#8FA3C2" center>
            {t("welcome.privacy")}
          </Txt>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
