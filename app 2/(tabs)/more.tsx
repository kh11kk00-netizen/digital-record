import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Modal, Platform, Pressable, Share, Switch, View } from "react-native";
import { useTranslation } from "react-i18next";
import { TypeGlyph } from "@/components/RecordIcon";
import { Card, Chevron, Header, Row, Screen, SectionHeader, Txt, type FeatherName } from "@/components/ui";
import { LANGUAGES, setLanguage, type LanguageCode } from "@/i18n";
import { readTextFile, writeTempText } from "@/lib/files";
import { ensurePermission } from "@/lib/notifications";
import type { RecordType } from "@/lib/types";
import { useRecords } from "@/store/records";
import { colors, radius, space } from "@/theme";

const SERVICES: { key: string; type: RecordType; filter: string }[] = [
  { key: "purchases", type: "purchase", filter: "purchase" },
  { key: "warranties", type: "warranty", filter: "warranty" },
  { key: "maintenance", type: "maintenance", filter: "maintenance" },
  { key: "vehicles", type: "vehicle", filter: "vehicle" },
  { key: "home", type: "home", filter: "home" },
  { key: "subscriptions", type: "subscription", filter: "subscription" },
  { key: "documents", type: "document", filter: "document" },
  { key: "other", type: "other", filter: "other" },
];

function SettingRow({ icon, label, value, onPress, danger }: { icon: FeatherName; label: string; value?: string; onPress?: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ paddingVertical: 14, opacity: pressed ? 0.6 : 1 }]}>
      <Row gap={space.md}>
        <Feather name={icon} size={19} color={danger ? colors.danger : colors.navy} />
        <Txt variant="body" weight="600" color={danger ? colors.danger : colors.ink} style={{ flex: 1 }}>
          {label}
        </Txt>
        {value ? (
          <Txt variant="small" color={colors.muted}>
            {value}
          </Txt>
        ) : null}
        {onPress && !danger ? <Chevron /> : null}
      </Row>
    </Pressable>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row style={{ paddingVertical: 10, justifyContent: "space-between" }}>
      <Txt variant="body" style={{ flex: 1 }}>
        {label}
      </Txt>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.white} />
    </Row>
  );
}

const Divider = () => <View style={{ height: 1, backgroundColor: colors.border }} />;

export default function More() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ restore?: string }>();
  const { records, prefs, setPrefs, exportBackup, importBackup, resetAll } = useRecords();
  const [langOpen, setLangOpen] = useState(false);

  const current = LANGUAGES.find((l) => l.code === i18n.language)?.label ?? i18n.language;

  const chooseLanguage = async (code: LanguageCode) => {
    setLangOpen(false);
    const restart = await setLanguage(code);
    if (restart) Alert.alert(t("settings.restartTitle"), t("settings.restartBody"));
  };

  const toggle = async (key: "warranty" | "returns" | "services", v: boolean) => {
    if (v) await ensurePermission();
    setPrefs({ [key]: v });
  };

  const doExport = async () => {
    const json = exportBackup();
    const name = `digital-record-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const uri = writeTempText(name, json);
    try {
      if (uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: t("settings.backup") });
      } else {
        await Share.share({ message: json });
      }
    } catch {
      Alert.alert(t("common.error"), t("settings.backupFailed"));
    }
  };

  const doImport = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain", "*/*"], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const text = await readTextFile(res.assets[0].uri);
      const n = importBackup(text);
      Alert.alert(t("settings.restoreDone"), t("settings.restoreCount", { n }));
    } catch {
      Alert.alert(t("common.error"), t("settings.restoreFailed"));
    }
  };

  useEffect(() => {
    if (params.restore === "1") {
      const id = setTimeout(doImport, 500);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.restore]);

  const confirmReset = () =>
    Alert.alert(t("settings.resetTitle"), t("settings.resetBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("settings.resetConfirm"), style: "destructive", onPress: () => void resetAll() },
    ]);

  return (
    <Screen>
      <Header title={t("more.title")} subtitle={t("more.subtitle")} />

      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: space.sm }}>
        {SERVICES.map((s) => (
          <Pressable key={s.key} onPress={() => router.push({ pathname: "/(tabs)/records", params: { filter: s.filter } })} style={{ width: "31.5%" }}>
            <Card style={{ alignItems: "center", paddingHorizontal: 6, paddingVertical: space.md, gap: 6, minHeight: 112 }}>
              <TypeGlyph type={s.type} size={24} />
              <Txt variant="small" weight="700" center>
                {t(`more.services.${s.key}`)}
              </Txt>
              <Txt variant="tiny" color={colors.muted} center numberOfLines={2}>
                {t(`more.servicesHint.${s.key}`)}
              </Txt>
            </Card>
          </Pressable>
        ))}
        <Pressable onPress={() => router.push("/assistant")} style={{ width: "31.5%" }}>
          <Card style={{ alignItems: "center", paddingHorizontal: 6, paddingVertical: space.md, gap: 6, minHeight: 112, backgroundColor: colors.navy, borderColor: colors.navy }}>
            <MaterialCommunityIcons name="robot-happy-outline" size={26} color={colors.white} />
            <Txt variant="small" weight="700" center color={colors.white}>
              {t("assistant.short")}
            </Txt>
            <Txt variant="tiny" color="#C9D5E8" center numberOfLines={2}>
              {t("more.assistantHint")}
            </Txt>
          </Card>
        </Pressable>
      </View>

      <SectionHeader title={t("settings.title")} />
      <Card style={{ paddingVertical: 4 }}>
        <SettingRow icon="globe" label={t("settings.language")} value={current} onPress={() => setLangOpen(true)} />
        <Divider />
        <SettingRow icon="download" label={t("settings.backup")} value={String(records.length)} onPress={doExport} />
        <Divider />
        <SettingRow icon="upload" label={t("settings.restore")} onPress={doImport} />
      </Card>

      <SectionHeader title={t("settings.reminders")} />
      <Card style={{ paddingVertical: 6 }}>
        <ToggleRow label={t("settings.remWarranty")} value={prefs.warranty} onChange={(v) => void toggle("warranty", v)} />
        <Divider />
        <ToggleRow label={t("settings.remReturns")} value={prefs.returns} onChange={(v) => void toggle("returns", v)} />
        <Divider />
        <ToggleRow label={t("settings.remServices")} value={prefs.services} onChange={(v) => void toggle("services", v)} />
        <Divider />
        <Row style={{ paddingVertical: 10, justifyContent: "space-between" }}>
          <Txt variant="body" style={{ flex: 1 }}>
            {t("settings.remHour")}
          </Txt>
          <Row gap={6}>
            {[8, 9, 12, 18, 20].map((h) => (
              <Pressable key={h} onPress={() => setPrefs({ hour: h })} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, backgroundColor: prefs.hour === h ? colors.navy : colors.neutralSoft }}>
                <Txt variant="tiny" weight="700" color={prefs.hour === h ? colors.white : colors.ink} style={{ writingDirection: "ltr" }}>
                  {`${h}:00`}
                </Txt>
              </Pressable>
            ))}
          </Row>
        </Row>
      </Card>

      <SectionHeader title={t("settings.privacyTitle")} />
      <Card style={{ gap: space.sm }}>
        <Row gap={space.sm}>
          <Feather name="lock" size={18} color={colors.success} />
          <Txt variant="small" style={{ flex: 1 }}>
            {t("settings.privacyBody")}
          </Txt>
        </Row>
      </Card>

      <Card style={{ marginTop: space.lg, paddingVertical: 4 }}>
        <SettingRow icon="trash-2" label={t("settings.reset")} onPress={confirmReset} danger />
      </Card>

      <Txt variant="tiny" color={colors.muted} center style={{ marginTop: space.lg }}>
        {`${t("app.name")} · DIGITAL RECORD · v${Constants.expoConfig?.version ?? "1.0.0"}${Platform.OS === "web" ? " (web)" : ""}`}
      </Txt>

      <Modal visible={langOpen} transparent animationType="fade" onRequestClose={() => setLangOpen(false)}>
        <Pressable onPress={() => setLangOpen(false)} style={{ flex: 1, backgroundColor: "rgba(11,31,58,0.45)", justifyContent: "flex-end" }}>
          <Pressable style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: space.xl, paddingBottom: 40 }}>
            <Txt variant="h2" style={{ marginBottom: space.md }}>
              {t("settings.language")}
            </Txt>
            {LANGUAGES.map((l) => (
              <Pressable key={l.code} onPress={() => void chooseLanguage(l.code)} style={{ paddingVertical: 14 }}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Txt variant="body" weight={l.code === i18n.language ? "700" : "400"}>
                    {l.label}
                  </Txt>
                  {l.code === i18n.language ? <Feather name="check" size={18} color={colors.primary} /> : null}
                </Row>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
