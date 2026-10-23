import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Header, Txt } from "@/components/ui";
import { colors, space } from "@/theme";

export default function Privacy() {
  const { t } = useTranslation();
  const router = useRouter();
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentContainerStyle={{ padding: space.lg }}>
      <Header title={t("reader.privacy")} onBack={() => router.back()} />
      <Txt>{t("reader.policy")}</Txt>
    </ScrollView>
  </SafeAreaView>;
}
