import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Image, Modal, Pressable, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { RecordIcon } from "@/components/RecordIcon";
import { Badge, Button, Card, Chevron, EmptyState, Header, Progress, Row, Screen, Txt, styles as ui, type FeatherName } from "@/components/ui";
import { shareClaim, shareInvoiceImage } from "@/lib/claim";
import { addMonths } from "@/lib/dates";
import { formatDate, formatDays, formatMoney, formatMonths } from "@/lib/format";
import { insight } from "@/lib/status";
import { DUE_LIKE } from "@/lib/types";
import { useRecords } from "@/store/records";
import { colors, radius, space } from "@/theme";

type Tab = "primary" | "invoice" | "data";

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <Row style={{ justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Txt variant="small" color={colors.muted}>
        {label}
      </Txt>
      <Txt variant="small" weight="600" style={{ flexShrink: 1, marginStart: space.md }} numberOfLines={2}>
        {value}
      </Txt>
    </Row>
  );
}

function Action({ icon, label, onPress, tint = colors.navy }: { icon: FeatherName; label: string; onPress: () => void; tint?: string }) {
  return (
    <Card onPress={onPress} style={{ marginBottom: space.sm, paddingVertical: 14 }}>
      <Row gap={space.md}>
        <Feather name={icon} size={18} color={tint} />
        <Txt variant="body" weight="600" color={tint} style={{ flex: 1 }}>
          {label}
        </Txt>
        <Chevron />
      </Row>
    </Card>
  );
}

export default function RecordDetails() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getRecord, deleteRecord, addNote, toggleFavorite, updateRecord } = useRecords();
  const record = id ? getRecord(id) : undefined;
  const [tab, setTab] = useState<Tab>("primary");
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [viewer, setViewer] = useState(false);

  if (!record) {
    return (
      <Screen>
        <Header title={t("details.title")} onBack={() => router.back()} />
        <EmptyState icon="file" title={t("details.missing")} />
      </Screen>
    );
  }

  const i = insight(record);
  const dueLike = DUE_LIKE.includes(record.type);

  const remove = () =>
    Alert.alert(t("details.deleteTitle"), t("details.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          deleteRecord(record.id);
          router.back();
        },
      },
    ]);

  const markDone = () => {
    if (!record.dueDate) return;
    if (record.repeatEveryMonths) {
      const next = addMonths(i.nextDue ?? record.dueDate, record.repeatEveryMonths);
      updateRecord(record.id, { dueDate: next });
      addNote(record.id, t("details.doneNote", { date: formatDate(i.nextDue ?? record.dueDate) }));
    } else {
      addNote(record.id, t("details.doneNote", { date: formatDate(record.dueDate) }));
      updateRecord(record.id, { dueDate: null });
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "primary", label: dueLike ? t("details.tabSchedule") : t("details.tabWarranty") },
    { key: "invoice", label: record.type === "document" ? t("details.tabDocument") : t("details.tabInvoice") },
    { key: "data", label: t("details.tabData") },
  ];

  return (
    <Screen>
      <Header
        title={t("details.title")}
        onBack={() => router.back()}
        right={
          <Pressable onPress={() => toggleFavorite(record.id)} hitSlop={10} style={ui.iconBtn}>
            <Feather name="star" size={18} color={record.favorite ? colors.warning : colors.muted} />
          </Pressable>
        }
      />

      {/* Hero */}
      <Card>
        <Row gap={space.lg} style={{ alignItems: "flex-start" }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Txt variant="h2">{record.title}</Txt>
            {record.brand ? (
              <Txt variant="small" color={colors.muted}>
                {record.brand}
              </Txt>
            ) : null}
            {record.price !== null ? <Txt variant="h3">{formatMoney(record.price, record.currency)}</Txt> : null}
            <Row gap={6} style={{ marginTop: 4 }}>
              {i.status !== "none" ? <Badge label={t(`status.${i.status}`)} tone={i.tone} /> : null}
              <Badge label={t(`types.${record.type}`)} tone="info" />
            </Row>
          </View>
          {record.imageUri ? (
            <Pressable onPress={() => setViewer(true)}>
              <Image source={{ uri: record.imageUri }} style={{ width: 92, height: 92, borderRadius: radius.md, backgroundColor: colors.neutralSoft }} />
            </Pressable>
          ) : (
            <RecordIcon type={record.type} size={92} />
          )}
        </Row>
      </Card>

      {/* Tabs */}
      <Row style={{ marginTop: space.lg, borderBottomWidth: 1, borderBottomColor: colors.border }} gap={0}>
        {tabs.map((tb) => (
          <Pressable key={tb.key} onPress={() => setTab(tb.key)} style={{ flex: 1, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: tab === tb.key ? colors.primary : "transparent" }}>
            <Txt variant="small" weight="700" center color={tab === tb.key ? colors.primary : colors.muted}>
              {tb.label}
            </Txt>
          </Pressable>
        ))}
      </Row>

      <View style={{ marginTop: space.lg }}>
        {tab === "primary" && !dueLike ? (
          i.warrantyEnd ? (
            <Card style={{ gap: space.sm }}>
              <Txt variant="small" color={colors.muted}>
                {t("details.warrantyEnds")}
              </Txt>
              <Txt variant="h1">{formatDate(i.warrantyEnd, "long")}</Txt>
              <Progress value={1 - (i.warrantyProgress ?? 0)} tone={i.tone === "danger" ? "danger" : i.tone === "warning" ? "warning" : "success"} />
              <Txt variant="small" weight="700" color={i.tone === "danger" ? colors.danger : i.tone === "warning" ? "#B86E12" : colors.success}>
                {(i.warrantyDaysLeft ?? 0) >= 0 ? t("details.leftDays", { days: formatDays(i.warrantyDaysLeft ?? 0) }) : t("details.endedAgo", { days: formatDays(i.warrantyDaysLeft ?? 0) })}
              </Txt>
              {i.returnEnd ? (
                <Row gap={6} style={{ marginTop: space.sm }}>
                  <Feather name="rotate-ccw" size={14} color={colors.muted} />
                  <Txt variant="tiny" color={colors.muted}>
                    {(i.returnDaysLeft ?? -1) >= 0
                      ? t("details.returnUntil", { date: formatDate(i.returnEnd), days: formatDays(i.returnDaysLeft ?? 0) })
                      : t("details.returnClosed", { date: formatDate(i.returnEnd) })}
                  </Txt>
                </Row>
              ) : null}
            </Card>
          ) : (
            <EmptyState icon="shield" title={t("details.noWarranty")} body={t("details.noWarrantyBody")} action={t("details.addWarranty")} onAction={() => router.push({ pathname: "/record/new", params: { id: record.id } })} />
          )
        ) : null}

        {tab === "primary" && dueLike ? (
          i.nextDue ? (
            <Card style={{ gap: space.sm }}>
              <Txt variant="small" color={colors.muted}>
                {t(`form.dueLabel.${record.type}`)}
              </Txt>
              <Txt variant="h1">{formatDate(i.nextDue, "long")}</Txt>
              <Txt variant="small" weight="700" color={i.tone === "danger" ? colors.danger : i.tone === "warning" ? "#B86E12" : colors.success}>
                {(i.dueDaysLeft ?? 0) >= 0 ? t("details.leftDays", { days: formatDays(i.dueDaysLeft ?? 0) }) : t("details.overdueBy", { days: formatDays(i.dueDaysLeft ?? 0) })}
              </Txt>
              {record.repeatEveryMonths ? (
                <Txt variant="tiny" color={colors.muted}>
                  {t("form.everyMonths", { n: formatMonths(record.repeatEveryMonths) })}
                </Txt>
              ) : null}
              <Button label={record.repeatEveryMonths ? t("details.doneNext") : t("details.done")} variant="light" icon="check-circle" onPress={markDone} style={{ marginTop: space.sm }} />
            </Card>
          ) : (
            <EmptyState icon="calendar" title={t("details.noDue")} action={t("details.setDue")} onAction={() => router.push({ pathname: "/record/new", params: { id: record.id } })} />
          )
        ) : null}

        {tab === "invoice" ? (
          <Card style={{ gap: space.sm }}>
            {record.imageUri ? (
              <Pressable onPress={() => setViewer(true)}>
                <Image source={{ uri: record.imageUri }} style={{ width: "100%", height: 260, borderRadius: radius.md, backgroundColor: colors.neutralSoft }} resizeMode="contain" />
              </Pressable>
            ) : (
              <Txt variant="small" color={colors.muted} center style={{ paddingVertical: space.lg }}>
                {t("details.noImage")}
              </Txt>
            )}
            <InfoRow label={t("fields.merchant")} value={record.merchant} />
            <InfoRow label={record.type === "document" ? t("fields.documentNumber") : t("fields.invoiceNumber")} value={record.invoiceNumber} />
            <InfoRow label={t("fields.purchaseDate")} value={record.purchaseDate ? formatDate(record.purchaseDate, "long") : null} />
            {record.imageUri ? <Button label={t("claim.shareImage")} variant="ghost" icon="image" onPress={() => void shareInvoiceImage(record)} /> : null}
          </Card>
        ) : null}

        {tab === "data" ? (
          <Card>
            <InfoRow label={t("fields.type")} value={t(`types.${record.type}`)} />
            <InfoRow label={t("fields.title")} value={record.title} />
            <InfoRow label={t("fields.brand")} value={record.brand} />
            <InfoRow label={t("fields.merchant")} value={record.merchant} />
            <InfoRow label={t("fields.purchaseDate")} value={record.purchaseDate ? formatDate(record.purchaseDate, "long") : null} />
            <InfoRow label={t("fields.price")} value={record.price !== null ? formatMoney(record.price, record.currency) : null} />
            <InfoRow label={t("fields.warrantyMonths")} value={record.warrantyMonths ? formatMonths(record.warrantyMonths) : null} />
            <InfoRow label={t("details.warrantyEnds")} value={i.warrantyEnd ? formatDate(i.warrantyEnd, "long") : null} />
            <InfoRow label={t("fields.detail")} value={record.detail} />
            <InfoRow label={t("details.created")} value={formatDate(record.createdAt.slice(0, 10), "long")} />
            {record.notes.length ? (
              <View style={{ marginTop: space.md, gap: space.sm }}>
                <Txt variant="h3">{t("details.notes")}</Txt>
                {record.notes.map((n) => (
                  <View key={n.id} style={{ backgroundColor: colors.neutralSoft, borderRadius: radius.sm, padding: space.md }}>
                    <Txt variant="small">{n.text}</Txt>
                    <Txt variant="tiny" color={colors.muted}>
                      {formatDate(n.createdAt.slice(0, 10))}
                    </Txt>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        ) : null}
      </View>

      {/* Actions */}
      <View style={{ marginTop: space.xl }}>
        <Action icon="file-text" label={t("details.viewInvoice")} onPress={() => setTab("invoice")} />
        <Action icon="edit-3" label={t("details.addNote")} onPress={() => setNoteOpen(true)} />
        {!dueLike ? <Action icon="send" label={t("claim.action")} onPress={() => void shareClaim(record)} tint={colors.primary} /> : null}
        {!dueLike ? <Action icon="tool" label={t("details.logMaintenance")} onPress={() => router.push({ pathname: "/record/new", params: { type: "maintenance", title: record.title } })} /> : null}
        <Action icon="edit-2" label={t("details.edit")} onPress={() => router.push({ pathname: "/record/new", params: { id: record.id } })} />
        <Action icon="trash-2" label={t("common.delete")} onPress={remove} tint={colors.danger} />
      </View>

      {/* Note sheet */}
      <Modal visible={noteOpen} transparent animationType="slide" onRequestClose={() => setNoteOpen(false)}>
        <Pressable onPress={() => setNoteOpen(false)} style={{ flex: 1, backgroundColor: "rgba(11,31,58,0.45)", justifyContent: "flex-end" }}>
          <Pressable style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: space.xl, paddingBottom: 40, gap: space.md }}>
            <Txt variant="h2">{t("details.addNote")}</Txt>
            <TextInput value={note} onChangeText={setNote} placeholder={t("form.notePh")} placeholderTextColor={colors.muted} multiline autoFocus style={[ui.input, { minHeight: 110, textAlignVertical: "top" }]} />
            <Button
              label={t("common.save")}
              variant="navy"
              onPress={() => {
                addNote(record.id, note);
                setNote("");
                setNoteOpen(false);
              }}
              disabled={!note.trim()}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Full-screen invoice viewer */}
      <Modal visible={viewer} animationType="fade" onRequestClose={() => setViewer(false)}>
        <Pressable onPress={() => setViewer(false)} style={{ flex: 1, backgroundColor: "#000", justifyContent: "center" }}>
          {record.imageUri ? <Image source={{ uri: record.imageUri }} style={{ width: "100%", height: "85%" }} resizeMode="contain" /> : null}
          <Txt variant="small" color="#fff" center style={{ marginTop: space.md }}>
            {t("common.tapToClose")}
          </Txt>
        </Pressable>
      </Modal>
    </Screen>
  );
}
