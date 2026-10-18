import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { LogoMark } from "@/components/Logo";
import { TypeGlyph } from "@/components/RecordIcon";
import { Badge, Card, EmptyState, RecordRow, Row, Screen, SearchBar, SectionHeader, Txt } from "@/components/ui";
import { formatDate, formatDays, formatMoney, formatNumber } from "@/lib/format";
import { collectDeadlines, insight, isUnderWarranty } from "@/lib/status";
import type { RecordType } from "@/lib/types";
import { useRecords } from "@/store/records";
import { colors, radius, space } from "@/theme";

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const { records } = useRecords();

  const stats = useMemo(() => {
    const purchases = records.filter((r) => r.type === "purchase" || r.type === "home").length;
    const warranties = records.filter(isUnderWarranty).length;
    const maintenance = records.filter((r) => r.type === "maintenance" || r.type === "vehicle").length;
    const documents = records.filter((r) => r.type === "document").length;
    // Protected value: sum of prices still covered by warranty, grouped by currency
    const pv = new Map<string, number>();
    for (const r of records) if (r.price !== null && isUnderWarranty(r)) pv.set(r.currency ?? "", (pv.get(r.currency ?? "") ?? 0) + r.price);
    const protectedValue = Array.from(pv.entries()).map(([c, v]) => formatMoney(v, c || null)).join(" + ");
    return { purchases, warranties, maintenance, documents, protectedValue };
  }, [records]);

  const upcoming = useMemo(() => collectDeadlines(records, 30).filter((d) => d.kind !== "incomplete" && (d.daysLeft ?? -1) >= 0).slice(0, 8), [records]);
  const latest = records.slice(0, 4);

  const tiles: { key: string; type: RecordType; filter: string; count: number }[] = [
    { key: "purchases", type: "purchase", filter: "purchase", count: stats.purchases },
    { key: "warranties", type: "warranty", filter: "warranty", count: stats.warranties },
    { key: "maintenance", type: "maintenance", filter: "maintenance", count: stats.maintenance },
    { key: "documents", type: "document", filter: "document", count: stats.documents },
  ];

  const openRecords = (filter?: string) => router.push({ pathname: "/(tabs)/records", params: filter ? { filter } : {} });

  return (
    <Screen>
      <Row style={{ justifyContent: "space-between", marginTop: space.sm }}>
        <View style={{ flex: 1 }}>
          <Txt variant="h1">{t("home.hello")}</Txt>
          <Txt variant="small" color={colors.muted}>
            {t("home.welcome")}
          </Txt>
        </View>
        <LogoMark size={44} />
      </Row>

      <Pressable onPress={() => router.push({ pathname: "/(tabs)/records", params: { focus: "1" } })} style={{ marginTop: space.lg }}>
        <View pointerEvents="none">
          <SearchBar placeholder={t("home.search")} editable={false} />
        </View>
      </Pressable>

      {/* Total card */}
      <Pressable onPress={() => openRecords()}>
        <View style={{ marginTop: space.lg, backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: "#D6E3FF" }}>
          <Row style={{ justifyContent: "space-between" }}>
            <View>
              <Txt variant="small" color={colors.navy}>
                {t("home.total")}
              </Txt>
              <Txt variant="h1" color={colors.navy} style={{ fontSize: 30, lineHeight: 38 }}>
                {formatNumber(records.length)}
              </Txt>
            </View>
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" }}>
              <Feather name="file-text" size={22} color={colors.navy} />
            </View>
          </Row>
          {stats.protectedValue ? (
            <Row gap={6} style={{ marginTop: space.sm }}>
              <Feather name="shield" size={13} color={colors.success} />
              <Txt variant="tiny" color={colors.navy}>
                {t("home.protectedValue", { v: stats.protectedValue })}
              </Txt>
            </Row>
          ) : null}
        </View>
      </Pressable>

      {/* Quick tiles */}
      <Row gap={space.sm} style={{ marginTop: space.lg }}>
        {tiles.map((tile) => (
          <Pressable key={tile.key} onPress={() => openRecords(tile.filter)} style={{ flex: 1 }}>
            <Card style={{ alignItems: "center", paddingHorizontal: 4, paddingVertical: space.md, gap: 6 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
                <TypeGlyph type={tile.type} size={19} />
              </View>
              <Txt variant="tiny" weight="600" center numberOfLines={1}>
                {t(`home.tiles.${tile.key}`)}
              </Txt>
              <Txt variant="tiny" color={colors.muted} center>
                {formatNumber(tile.count)}
              </Txt>
            </Card>
          </Pressable>
        ))}
      </Row>

      {/* Smart timeline (next 30 days) */}
      {upcoming.length ? (
        <>
          <SectionHeader title={t("home.upcoming")} action={t("common.viewAll")} onAction={() => router.push("/(tabs)/alerts")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingBottom: 4 }}>
            {upcoming.map((d) => {
              const r = records.find((x) => x.id === d.recordId);
              if (!r) return null;
              const urgent = (d.daysLeft ?? 99) <= 7;
              return (
                <Pressable key={d.key} onPress={() => router.push({ pathname: "/record/[id]", params: { id: r.id } })}>
                  <View style={{ width: 160, backgroundColor: urgent ? colors.warningSoft : colors.surface, borderRadius: radius.md, padding: space.md, borderWidth: 1, borderColor: urgent ? "#F6D7AE" : colors.border, gap: 4 }}>
                    <Row gap={6}>
                      <Feather name={d.kind === "warranty" ? "shield" : d.kind === "return" ? "rotate-ccw" : "clock"} size={13} color={urgent ? "#B86E12" : colors.primary} />
                      <Txt variant="tiny" color={colors.muted}>
                        {t(`alerts.kind.${d.kind}`)}
                      </Txt>
                    </Row>
                    <Txt variant="small" weight="700" numberOfLines={1}>
                      {r.title}
                    </Txt>
                    <Txt variant="tiny" color={urgent ? "#B86E12" : colors.success} weight="700">
                      {d.daysLeft === 0 ? t("common.today") : t("common.inDays", { days: formatDays(d.daysLeft ?? 0) })}
                    </Txt>
                    <Txt variant="tiny" color={colors.muted}>
                      {formatDate(d.date)}
                    </Txt>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      {/* Assistant banner */}
      <Pressable onPress={() => router.push("/assistant")} style={{ marginTop: space.xl }}>
        <Row style={{ backgroundColor: colors.navy, borderRadius: radius.lg, padding: space.lg }} gap={space.md}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name="robot-happy-outline" size={26} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="h3" color={colors.white}>
              {t("assistant.title")}
            </Txt>
            <Txt variant="tiny" color="#C9D5E8">
              {t("home.assistantHint")}
            </Txt>
          </View>
          <Feather name="send" size={18} color={colors.white} />
        </Row>
      </Pressable>

      <SectionHeader title={t("home.latest")} action={records.length ? t("common.viewAll") : undefined} onAction={() => openRecords()} />
      {latest.length ? (
        latest.map((r) => <RecordRow key={r.id} record={r} onPress={() => router.push({ pathname: "/record/[id]", params: { id: r.id } })} />)
      ) : (
        <EmptyState icon="file-plus" title={t("home.emptyTitle")} body={t("home.emptyBody")} action={t("home.addInvoice")} onAction={() => router.push({ pathname: "/record/new", params: { type: "purchase" } })} />
      )}

      {records.some((r) => insight(r).status === "incomplete") ? (
        <Card onPress={() => router.push("/(tabs)/alerts")} style={{ marginTop: space.sm, backgroundColor: colors.warningSoft, borderColor: "#F6D7AE" }}>
          <Row gap={space.sm}>
            <Feather name="alert-circle" size={18} color="#B86E12" />
            <Txt variant="small" style={{ flex: 1 }}>
              {t("home.incompleteHint")}
            </Txt>
            <Badge label={formatNumber(records.filter((r) => insight(r).status === "incomplete").length)} tone="warning" />
          </Row>
        </Card>
      ) : null}
    </Screen>
  );
}
