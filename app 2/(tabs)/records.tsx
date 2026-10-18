import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Chip, EmptyState, Header, RecordRow, SearchBar } from "@/components/ui";
import { insight, isUnderWarranty } from "@/lib/status";
import type { DigitalRecord } from "@/lib/types";
import { useRecords } from "@/store/records";
import { colors, space } from "@/theme";

const FILTERS = ["all", "purchase", "warranty", "maintenance", "document", "vehicle", "subscription", "home", "favorites"] as const;
type Filter = (typeof FILTERS)[number];

function normalize(v: string) {
  return v.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").trim();
}

function matches(r: DigitalRecord, f: Filter) {
  switch (f) {
    case "all":
      return true;
    case "favorites":
      return r.favorite;
    case "warranty":
      return r.type === "warranty" || isUnderWarranty(r);
    case "maintenance":
      return r.type === "maintenance";
    case "purchase":
      return r.type === "purchase";
    default:
      return r.type === f;
  }
}

export default function Records() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string; focus?: string }>();
  const { records } = useRecords();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortSoonest, setSortSoonest] = useState(false);

  useEffect(() => {
    if (params.filter && (FILTERS as readonly string[]).includes(params.filter)) setFilter(params.filter as Filter);
  }, [params.filter]);

  const data = useMemo(() => {
    const q = normalize(query);
    const list = records.filter((r) => {
      if (!matches(r, filter)) return false;
      if (!q) return true;
      return normalize([r.title, r.brand, r.merchant, r.invoiceNumber, r.detail, t(`types.${r.type}`), ...r.notes.map((n) => n.text)].filter(Boolean).join(" ")).includes(q);
    });
    if (sortSoonest) {
      const key = (r: DigitalRecord) => {
        const i = insight(r);
        const v = i.warrantyDaysLeft ?? i.dueDaysLeft;
        return v === null || v < 0 ? 99999 : v;
      };
      return [...list].sort((a, b) => key(a) - key(b));
    }
    return list;
  }, [records, query, filter, sortSoonest, t]);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={data}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <Header title={t("records.title")} />
            <View>
              <SearchBarAuto autoFocus={params.focus === "1"} value={query} onChangeText={setQuery} placeholder={t("records.search")} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: space.md }}>
              <Chip label={t("records.soonest")} icon="clock" active={sortSoonest} onPress={() => setSortSoonest((v) => !v)} />
              {FILTERS.map((f) => (
                <Chip key={f} label={t(`records.filters.${f}`)} active={filter === f} onPress={() => setFilter(f)} />
              ))}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => <RecordRow record={item} onPress={() => router.push({ pathname: "/record/[id]", params: { id: item.id } })} />}
        ListEmptyComponent={
          records.length ? (
            <EmptyState icon="search" title={t("records.noResults")} body={t("records.noResultsBody")} />
          ) : (
            <EmptyState icon="file-plus" title={t("home.emptyTitle")} body={t("home.emptyBody")} action={t("home.addInvoice")} onAction={() => router.push("/(tabs)/add")} />
          )
        }
      />
    </SafeAreaView>
  );
}

function SearchBarAuto(props: { autoFocus?: boolean; value: string; onChangeText: (v: string) => void; placeholder: string }) {
  // Thin wrapper so the home search can jump straight into typing.
  const inputRef = useRef<TextInput>(null);
  useEffect(() => {
    if (props.autoFocus) {
      const id = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(id);
    }
  }, [props.autoFocus]);
  return <SearchBar value={props.value} onChangeText={props.onChangeText} placeholder={props.placeholder} inputRef={inputRef} />;
}
