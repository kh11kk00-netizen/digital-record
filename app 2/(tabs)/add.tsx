import { useRouter } from "expo-router";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { RecordIcon } from "@/components/RecordIcon";
import { Button, Card, Chevron, Header, Row, Screen, Txt } from "@/components/ui";
import { RECORD_TYPES } from "@/lib/types";
import { colors, space } from "@/theme";

export default function AddChooser() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen>
      <Header title={t("add.title")} subtitle={t("add.subtitle")} />
      {RECORD_TYPES.map((type) => (
        <Card key={type} onPress={() => router.push({ pathname: "/record/new", params: { type } })} style={{ marginBottom: space.sm, paddingVertical: space.md }}>
          <Row gap={space.md}>
            <RecordIcon type={type} size={42} />
            <View style={{ flex: 1 }}>
              <Txt variant="h3">{t(`types.${type}`)}</Txt>
              <Txt variant="tiny" color={colors.muted}>
                {t(`add.hints.${type}`)}
              </Txt>
            </View>
            <Chevron />
          </Row>
        </Card>
      ))}
      <Button label={t("common.cancel")} variant="ghost" onPress={() => router.navigate("/(tabs)")} style={{ marginTop: space.md }} />
    </Screen>
  );
}
