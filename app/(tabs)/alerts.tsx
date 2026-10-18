import { Feather } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Platform, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, Chevron, EmptyState, Header, Row, Screen, SectionHeader, Txt, type FeatherName } from "@/components/ui";
import { formatDate, formatDays } from "@/lib/format";
import { ensurePermission, syncReminders } from "@/lib/notifications";
import { collectDeadlines, type Deadline } from "@/lib/status";
import { useRecords } from "@/store/records";
import { colors, space } from "@/theme";

const ICON: Record<Deadline["kind"], FeatherName> = { warranty: "shield", return: "rotate-ccw", due: "clock", incomplete: "alert-circle" };

export default function Alerts() {
  const { t } = useTranslation();
  const router = useRouter();
  const { records, prefs } = useRecords();
  const [granted, setGranted] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "web") return setGranted(true);
      Notifications.getPermissionsAsync().then((p) => setGranted(p.granted)).catch(() => setGranted(null));
    }, []),
  );

  const deadlines = useMemo(() => collectDeadlines(records, 90), [records]);
  const groups = useMemo(
    () => ({
      urgent: deadlines.filter((d) => d.daysLeft !== null && d.daysLeft <= 7),
      soon: deadlines.filter((d) => d.daysLeft !== null && d.daysLeft > 7 && d.daysLeft <= 30),
      later: deadlines.filter((d) => d.daysLeft !== null && d.daysLeft > 30),
      incomplete: deadlines.filter((d) => d.kind === "incomplete"),
    }),
    [deadlines],
  );

  const enable = async () => {
    const ok = await ensurePermission();
    setGranted(ok);
    if (ok) await syncReminders(records, prefs);
  };

  const message = (d: Deadline) => {
    if (d.kind === "incomplete") return t("alerts.msg.incomplete");
    const days = d.daysLeft ?? 0;
    if (days < 0) return t(`alerts.msg.${d.kind}Passed`, { days: formatDays(days) });
    if (days === 0) return t(`alerts.msg.${d.kind}Today`);
    return t(`alerts.msg.${d.kind}`, { days: formatDays(days) });
  };

  const renderItem = (d: Deadline) => {
    const r = records.find((x) => x.id === d.recordId);
    if (!r) return null;
    const tone = d.kind === "incomplete" ? "warning" : (d.daysLeft ?? 0) < 0 ? "danger" : (d.daysLeft ?? 0) <= 7 ? "warning" : "success";
    return (
      <Card key={d.key} onPress={() => router.push({ pathname: "/record/[id]", params: { id: r.id } })} style={{ marginBottom: space.sm, paddingVertical: space.md }}>
        <Row gap={space.md}>
          <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: tone === "success" ? colors.successSoft : tone === "danger" ? colors.dangerSoft : colors.warningSoft, alignItems: "center", justifyContent: "center" }}>
            <Feather name={ICON[d.kind]} size={19} color={tone === "success" ? colors.success : tone === "danger" ? colors.danger : "#B86E12"} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="h3" numberOfLines={1}>
              {r.title}
            </Txt>
            <Txt variant="small" color={colors.muted}>
              {message(d)}
            </Txt>
            {d.date ? (
              <Txt variant="tiny" color={colors.muted}>
                {formatDate(d.date, "long")}
              </Txt>
            ) : null}
          </View>
          <Badge label={t(`alerts.kind.${d.kind}`)} tone={tone} />
          <Chevron />
        </Row>
      </Card>
    );
  };

  return (
    <Screen>
      <Header title={t("alerts.title")} subtitle={t("alerts.subtitle")} />
      {granted === false ? (
        <Card style={{ marginBottom: space.lg, backgroundColor: colors.primarySoft, borderColor: "#D6E3FF", gap: space.sm }}>
          <Row gap={space.sm}>
            <Feather name="bell-off" size={18} color={colors.navy} />
            <Txt variant="h3" style={{ flex: 1 }}>
              {t("alerts.enableTitle")}
            </Txt>
          </Row>
          <Txt variant="small" color={colors.muted}>
            {t("alerts.enableBody")}
          </Txt>
          <Button label={t("alerts.enable")} variant="navy" icon="bell" onPress={enable} />
        </Card>
      ) : null}

      {deadlines.length === 0 ? <EmptyState icon="bell" title={t("alerts.emptyTitle")} body={t("alerts.emptyBody")} /> : null}
      {groups.urgent.length ? <SectionHeader title={t("alerts.groups.urgent")} /> : null}
      {groups.urgent.map(renderItem)}
      {groups.soon.length ? <SectionHeader title={t("alerts.groups.soon")} /> : null}
      {groups.soon.map(renderItem)}
      {groups.later.length ? <SectionHeader title={t("alerts.groups.later")} /> : null}
      {groups.later.map(renderItem)}
      {groups.incomplete.length ? <SectionHeader title={t("alerts.groups.incomplete")} /> : null}
      {groups.incomplete.map(renderItem)}
    </Screen>
  );
}
