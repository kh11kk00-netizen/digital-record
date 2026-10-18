import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Chip, Header, Row, Txt } from "@/components/ui";
import { isRTL } from "@/i18n";
import { askAssistant } from "@/lib/assistant";
import { uid } from "@/lib/id";
import { useRecords } from "@/store/records";
import { colors, radius, space } from "@/theme";

type Msg = { id: string; from: "me" | "ai"; text: string; recordIds?: string[] };

export default function Assistant() {
  const { t } = useTranslation();
  const router = useRouter();
  const { records } = useRecords();
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>(() => [{ id: "hello", from: "ai", text: t("assistant.greeting") }]);
  const list = useRef<FlatList<Msg>>(null);

  const suggestions = [t("assistant.s1"), t("assistant.s2"), t("assistant.s3"), t("assistant.s4"), t("assistant.s5")];

  const send = (text: string) => {
    const q = text.trim();
    if (!q) return;
    const answer = askAssistant(q, records);
    setMsgs((m) => [...m, { id: uid(), from: "me", text: q }, { id: uid(), from: "ai", text: answer.text, recordIds: answer.recordIds }]);
    setInput("");
    setTimeout(() => list.current?.scrollToEnd({ animated: true }), 80);
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ paddingHorizontal: space.lg }}>
          <Header title={t("assistant.title")} subtitle={t("assistant.subtitle")} onBack={() => router.back()} />
        </View>
        <FlatList
          ref={list}
          data={msgs}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: space.lg, gap: space.md }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = item.from === "me";
            return (
              <View style={{ alignItems: mine ? "flex-end" : "flex-start" }}>
                <Row gap={8} style={{ alignItems: "flex-end", maxWidth: "88%" }}>
                  {!mine ? (
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" }}>
                      <MaterialCommunityIcons name="robot-happy-outline" size={18} color={colors.white} />
                    </View>
                  ) : null}
                  <View style={{ backgroundColor: mine ? colors.navy : colors.surface, borderRadius: radius.lg, padding: space.md, borderWidth: mine ? 0 : 1, borderColor: colors.border, flexShrink: 1 }}>
                    <Txt variant="body" color={mine ? colors.white : colors.ink}>
                      {item.text}
                    </Txt>
                    {item.recordIds?.length ? (
                      <Row gap={6} style={{ flexWrap: "wrap", marginTop: space.sm }}>
                        {item.recordIds.map((rid) => {
                          const r = records.find((x) => x.id === rid);
                          return r ? <Chip key={rid} label={r.title} icon="external-link" onPress={() => router.push({ pathname: "/record/[id]", params: { id: rid } })} /> : null;
                        })}
                      </Row>
                    ) : null}
                  </View>
                </Row>
              </View>
            );
          }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm }} style={{ flexGrow: 0 }}>
          {suggestions.map((s) => (
            <Chip key={s} label={s} onPress={() => send(s)} />
          ))}
        </ScrollView>
        <Row gap={space.sm} style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t("assistant.placeholder")}
            placeholderTextColor={colors.muted}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
            style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: space.lg, height: 48, fontSize: 15, color: colors.ink }}
          />
          <Pressable onPress={() => send(input)} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" }}>
            <Feather name="send" size={18} color={colors.white} style={{ transform: [{ scaleX: isRTL() ? -1 : 1 }] }} />
          </Pressable>
        </Row>
        <Row gap={6} style={{ justifyContent: "center", paddingBottom: space.sm }}>
          <Feather name="lock" size={11} color={colors.muted} />
          <Txt variant="tiny" color={colors.muted} center>
            {t("assistant.privacy")}
          </Txt>
        </Row>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
