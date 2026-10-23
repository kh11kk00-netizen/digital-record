import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Button, Chip, Field, Header, Row, Txt } from "@/components/ui";
import { deviceCurrency } from "@/i18n";
import { coerceDateInput, normalizeDigits } from "@/lib/dates";
import { mergeReviewedExtraction, readerUrl, readInvoice, type Extraction } from "@/lib/invoice-reader";
import { deleteCachedImage, persistImage } from "@/lib/files";
import { formatDays, formatMonths } from "@/lib/format";
import { ensurePermission } from "@/lib/notifications";
import { DUE_LIKE, PURCHASE_LIKE, RECORD_TYPES, type RecordDraft, type RecordType } from "@/lib/types";
import { useRecords } from "@/store/records";
import { colors, radius, space } from "@/theme";

type Form = {
  title: string;
  brand: string;
  merchant: string;
  purchaseDate: string;
  price: string;
  currency: string;
  invoiceNumber: string;
  warrantyMonths: string;
  warrantyEndsOn: string;
  returnPeriodDays: string;
  dueDate: string;
  repeatEveryMonths: string;
  detail: string;
  imageUri: string | null;
};

const s = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export default function NewRecord() {
  const { t } = useTranslation();
  const abort = useRef<AbortController | null>(null);
  const selectedCache = useRef<string | null>(null);
  const scanSnapshot = useRef<Form | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; abort.current?.abort(); deleteCachedImage(selectedCache.current); };
  }, []);
  const [imageData, setImageData] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [reading, setReading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [extracted, setExtracted] = useState<Extraction | null>(null);
  const [readError, setReadError] = useState("");
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; id?: string; title?: string }>();
  const { getRecord, addRecord, updateRecord } = useRecords();
  const existing = params.id ? getRecord(params.id) : undefined;
  const type: RecordType = existing?.type ?? ((RECORD_TYPES as readonly string[]).includes(params.type ?? "") ? (params.type as RecordType) : "purchase");
  const purchaseLike = PURCHASE_LIKE.includes(type);
  const dueLike = DUE_LIKE.includes(type);

  const [form, setForm] = useState<Form>(() => ({
    title: existing?.title ?? s(params.title),
    brand: s(existing?.brand),
    merchant: s(existing?.merchant),
    purchaseDate: s(existing?.purchaseDate),
    price: s(existing?.price),
    currency: existing?.currency ?? deviceCurrency(),
    invoiceNumber: s(existing?.invoiceNumber),
    warrantyMonths: s(existing?.warrantyMonths),
    warrantyEndsOn: s(existing?.warrantyEndsOn),
    returnPeriodDays: s(existing?.returnPeriodDays),
    dueDate: s(existing?.dueDate),
    repeatEveryMonths: s(existing?.repeatEveryMonths),
    detail: s(existing?.detail),
    imageUri: existing?.imageUri ?? null,
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const title = existing ? t("form.editTitle") : t(`form.titles.${type}`);

  const pick = async (source: "camera" | "library") => {
    if (reading || preparing) return;
    setPreparing(true);
    let pickedUri: string | null = null;
    let preparedUri: string | null = null;
    try {
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return Alert.alert(t("form.cameraDenied"));
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.9, allowsEditing: false, base64: false, exif: false };
      const res = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (!res.canceled && res.assets[0]) {
        const asset = res.assets[0];
        pickedUri = asset.uri;
        const context = ImageManipulator.manipulate(asset.uri);
        let rendered;
        let photo;
        try {
          if (Math.max(asset.width, asset.height) > 2400) context.resize(asset.width >= asset.height ? { width: 2400 } : { height: 2400 });
          rendered = await context.renderAsync();
          photo = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: !!readerUrl });
        } finally { rendered?.release(); context.release(); }
        preparedUri = photo.uri;
        if (photo.base64 && photo.base64.length > 8_000_000) throw Error("IMAGE_TOO_LARGE");
        if (!mounted.current) return;
        abort.current?.abort();
        deleteCachedImage(selectedCache.current);
        selectedCache.current = photo.uri;
        scanSnapshot.current = null;
        setExtracted(null); setReadError("");
        setImageData(photo.base64 ?? null);
        setForm((f) => ({ ...f, imageUri: photo.uri }));
        preparedUri = null;
      }
    } catch (error) {
      if (mounted.current) Alert.alert(t("common.error"), t(error instanceof Error && error.message === "IMAGE_TOO_LARGE" ? "reader.tooLarge" : "form.imageFailed"));
    } finally {
      deleteCachedImage(pickedUri); deleteCachedImage(preparedUri);
      if (mounted.current) setPreparing(false);
    }
  };

  const scan = async () => {
    if (!imageData || reading || preparing || abort.current || !accessCode.trim()) return;
    const controller = new AbortController();
    abort.current = controller;
    scanSnapshot.current = { ...form };
    setReading(true); setReadError(""); setExtracted(null);
    const timer = setTimeout(() => controller.abort(), 75000);
    try {
      const result = await readInvoice(imageData, accessCode, controller.signal);
      if (mounted.current && abort.current === controller && !controller.signal.aborted) setExtracted(result);
    } catch (error) {
      if (mounted.current && abort.current === controller) {
        const code = error instanceof Error ? error.message : "";
        const message = code === "UNAUTHORIZED" ? "unauthorized" : ["DAILY_LIMIT", "PROVIDER_LIMIT", "BUSY"].includes(code) ? "limit" : code === "UNREADABLE" ? "unreadable" : code === "IMAGE_TOO_LARGE" ? "tooLarge" : "failed";
        setReadError(t(`reader.${message}`));
      }
    } finally {
      clearTimeout(timer);
      if (mounted.current && abort.current === controller) { setReading(false); abort.current = null; }
    }
  };
  const cancelReading = () => { const controller = abort.current; abort.current = null; controller?.abort(); setReading(false); };
  const requestScan = () => Alert.alert(t("reader.title"), t("reader.consent"), [
    { text: t("common.cancel"), style: "cancel" },
    { text: t("reader.agree"), onPress: () => void scan() },
  ]);
  const usableEntries = extracted ? Object.entries(extracted).filter(([key]) =>
    key === "title" || key === "detail" || (purchaseLike && !["dueDate"].includes(key)) || (dueLike && ["dueDate", "price", "currency", "merchant", "invoiceNumber"].includes(key))
  ) : [];

  const int = (v: string) => {
    const n = parseInt(normalizeDigits(v), 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const save = async () => {
    if (reading || preparing || saving || extracted) return;
    const e: Partial<Record<keyof Form, string>> = {};
    if (!form.title.trim()) e.title = t("form.errRequired");
    const dateOrNull = (k: "purchaseDate" | "warrantyEndsOn" | "dueDate") => {
      if (!form[k].trim()) return null;
      const d = coerceDateInput(form[k]);
      if (!d) e[k] = t("form.errDate");
      return d;
    };
    const purchaseDate = dateOrNull("purchaseDate");
    const warrantyEndsOn = dateOrNull("warrantyEndsOn");
    const dueDate = dateOrNull("dueDate");
    let price: number | null = null;
    if (form.price.trim()) {
      price = Number(normalizeDigits(form.price.replace(/\s/g, "")));
      if (!Number.isFinite(price) || price < 0) e.price = t("form.errNumber");
    }
    const currency = form.currency.trim().toUpperCase();
    if (currency && !/^[A-Z]{3}$/.test(currency)) e.currency = t("form.errCurrency");
    setErrors(e);
    if (Object.keys(e).length) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }

    setSaving(true);
    let imageUri = form.imageUri;
    try {
      if (imageUri && imageUri !== existing?.imageUri) imageUri = persistImage(imageUri);
    } catch {
      setSaving(false);
      Alert.alert(t("common.error"), t("reader.imageSaveFailed"));
      return;
    }
    const draft: RecordDraft = {
      type,
      title: form.title.trim().slice(0, 200),
      brand: form.brand.trim() || null,
      merchant: form.merchant.trim() || null,
      purchaseDate,
      price,
      currency: currency || null,
      invoiceNumber: form.invoiceNumber.trim() || null,
      warrantyMonths: warrantyEndsOn ? null : int(form.warrantyMonths) || null,
      warrantyEndsOn,
      returnPeriodDays: int(form.returnPeriodDays) || null,
      dueDate,
      repeatEveryMonths: int(form.repeatEveryMonths) || null,
      detail: form.detail.trim() || null,
      imageUri,
    };
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (draft.purchaseDate || draft.dueDate || draft.warrantyEndsOn) void ensurePermission().catch(() => false);
    if (existing) {
      updateRecord(existing.id, draft);
      router.back();
    } else {
      const rec = addRecord(draft);
      router.replace({ pathname: "/record/[id]", params: { id: rec.id } });
    }
    setSaving(false);
  };

  const warrantyChips = useMemo(() => [0, 6, 12, 24, 36], []);

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Header title={title} subtitle={t("form.subtitle")} onBack={() => router.back()} />

          {/* Invoice / photo capture */}
          {form.imageUri ? (
            <View style={{ marginBottom: space.lg }}>
              <Image source={{ uri: form.imageUri }} style={{ width: "100%", height: 200, borderRadius: radius.lg, backgroundColor: colors.neutralSoft }} resizeMode="cover" />
              <Row gap={space.sm} style={{ marginTop: space.sm }}>
                <Button label={t("form.retake")} variant="light" icon="camera" disabled={reading || preparing} onPress={() => void pick("camera")} style={{ flex: 1 }} />
                <Button label={t("form.removeImage")} variant="danger" icon="trash-2" disabled={reading || preparing} onPress={() => { cancelReading(); deleteCachedImage(selectedCache.current); selectedCache.current = null; scanSnapshot.current = null; setImageData(null); setExtracted(null); setReadError(""); setForm((f) => ({ ...f, imageUri: null })); }} style={{ flex: 1 }} />
              </Row>
            </View>
          ) : (
            <Pressable onPress={() => void pick("camera")} style={{ borderWidth: 1.5, borderStyle: "dashed", borderColor: "#B7C8EA", borderRadius: radius.lg, backgroundColor: colors.surface, alignItems: "center", paddingVertical: space.xl, marginBottom: space.lg, gap: 6 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
                <Feather name="camera" size={22} color={colors.navy} />
              </View>
              <Txt variant="h3" center>
                {t("form.capture")}
              </Txt>
              <Pressable onPress={() => void pick("library")} hitSlop={8}>
                <Txt variant="small" color={colors.primary} center weight="600">
                  {t("form.orLibrary")}
                </Txt>
              </Pressable>
            </Pressable>
          )}

          <View style={{ marginBottom: space.lg, gap: space.sm }}>
            <Txt variant="h3">{t("reader.title")}</Txt>
            {readerUrl ? <>
              <Txt variant="small">{t("reader.consent")}</Txt>
              <Field label={t("reader.token")} hint={t("reader.tokenHint")} value={accessCode} onChangeText={setAccessCode} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!reading} />
              <Button label={t("reader.read")} loading={reading || preparing} disabled={!imageData || !accessCode.trim() || !!extracted || preparing} onPress={requestScan} />
              {reading ? <Button label={t("reader.cancelled")} variant="light" onPress={cancelReading} /> : null}
              {readError ? <Txt variant="small">{readError}</Txt> : null}
              {extracted ? <View style={{ gap: space.sm }}>
                <Txt variant="h3">{t("reader.review")}</Txt>
                <Txt variant="small">{t("reader.reviewHint")}</Txt>
                {usableEntries.map(([key, value]) => <Txt key={key} variant="small">{(key === "title" ? t(`form.nameLabel.${dueLike ? "due" : "item"}`) : t(`fields.${key}`))}: {value}</Txt>)}
                <Button label={t("reader.apply")} disabled={!usableEntries.length} onPress={() => {
                  const snapshot = scanSnapshot.current;
                  setForm((f) => mergeReviewedExtraction(f, snapshot, Object.fromEntries(usableEntries)));
                  setExtracted(null); setErrors({});
                }} />
                <Button label={t("reader.discard")} variant="light" onPress={() => setExtracted(null)} />
              </View> : null}
            </> : <Txt variant="small">{t("reader.unavailable")}</Txt>}
            <Button label={t("reader.privacy")} variant="ghost" onPress={() => router.push("/privacy")} />
          </View>

          <Field label={t(`form.nameLabel.${dueLike ? "due" : "item"}`)} placeholder={t(`form.namePh.${type}`)} value={form.title} onChangeText={set("title")} error={errors.title} />

          {purchaseLike ? (
            <>
              <Field label={t("fields.brand")} placeholder={t("form.brandPh")} value={form.brand} onChangeText={set("brand")} />
              <Field label={t("fields.merchant")} placeholder={t("form.merchantPh")} value={form.merchant} onChangeText={set("merchant")} />
              <Field label={t("fields.purchaseDate")} placeholder="YYYY-MM-DD" value={form.purchaseDate} onChangeText={set("purchaseDate")} keyboardType="numbers-and-punctuation" error={errors.purchaseDate} hint={t("form.dateHint")} />
              <Row gap={space.sm} style={{ alignItems: "flex-start" }}>
                <View style={{ flex: 2 }}>
                  <Field label={t("fields.price")} placeholder="0.00" value={form.price} onChangeText={set("price")} keyboardType="decimal-pad" error={errors.price} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label={t("fields.currency")} placeholder="SAR" value={form.currency} onChangeText={set("currency")} autoCapitalize="characters" maxLength={3} error={errors.currency} />
                </View>
              </Row>
              <Field label={t("fields.invoiceNumber")} placeholder="INV-0001" value={form.invoiceNumber} onChangeText={set("invoiceNumber")} />

              <Txt variant="small" weight="700" style={{ marginBottom: 6 }}>
                {t("fields.warrantyMonths")}
              </Txt>
              <Row gap={space.sm} style={{ flexWrap: "wrap", marginBottom: space.sm }}>
                {warrantyChips.map((m) => (
                  <Chip key={m} label={m === 0 ? t("form.noWarranty") : formatMonths(m)} active={form.warrantyMonths === (m === 0 ? "" : String(m)) && !form.warrantyEndsOn} onPress={() => setForm((f) => ({ ...f, warrantyMonths: m === 0 ? "" : String(m), warrantyEndsOn: "" }))} />
                ))}
              </Row>
              <Field label={t("fields.warrantyEndsOn")} placeholder="YYYY-MM-DD" value={form.warrantyEndsOn} onChangeText={set("warrantyEndsOn")} keyboardType="numbers-and-punctuation" error={errors.warrantyEndsOn} hint={t("form.warrantyEndHint")} />

              <Txt variant="small" weight="700" style={{ marginBottom: 6 }}>
                {t("fields.returnPeriodDays")}
              </Txt>
              <Row gap={space.sm} style={{ flexWrap: "wrap", marginBottom: space.lg }}>
                {[0, 3, 7, 14, 30].map((d) => (
                  <Chip key={d} label={d === 0 ? t("form.none") : formatDays(d)} active={form.returnPeriodDays === (d === 0 ? "" : String(d))} onPress={() => set("returnPeriodDays")(d === 0 ? "" : String(d))} />
                ))}
              </Row>
            </>
          ) : null}

          {dueLike ? (
            <>
              <Field label={t(`form.dueLabel.${type}`)} placeholder="YYYY-MM-DD" value={form.dueDate} onChangeText={set("dueDate")} keyboardType="numbers-and-punctuation" error={errors.dueDate} hint={t("form.dateHint")} />
              {type !== "document" ? (
                <>
                  <Txt variant="small" weight="700" style={{ marginBottom: 6 }}>
                    {t("fields.repeatEveryMonths")}
                  </Txt>
                  <Row gap={space.sm} style={{ flexWrap: "wrap", marginBottom: space.lg }}>
                    {[0, 1, 3, 6, 12].map((m) => (
                      <Chip key={m} label={m === 0 ? t("form.once") : t("form.everyMonths", { n: formatMonths(m) })} active={form.repeatEveryMonths === (m === 0 ? "" : String(m))} onPress={() => set("repeatEveryMonths")(m === 0 ? "" : String(m))} />
                    ))}
                  </Row>
                  <Row gap={space.sm} style={{ alignItems: "flex-start" }}>
                    <View style={{ flex: 2 }}>
                      <Field label={t("fields.amount")} placeholder="0.00" value={form.price} onChangeText={set("price")} keyboardType="decimal-pad" error={errors.price} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field label={t("fields.currency")} placeholder="SAR" value={form.currency} onChangeText={set("currency")} autoCapitalize="characters" maxLength={3} error={errors.currency} />
                    </View>
                  </Row>
                  <Field label={t("fields.merchant")} placeholder={t("form.providerPh")} value={form.merchant} onChangeText={set("merchant")} />
                </>
              ) : (
                <Field label={t("fields.documentNumber")} placeholder="—" value={form.invoiceNumber} onChangeText={set("invoiceNumber")} />
              )}
              <Field label={t(`form.detailLabel.${type}`)} placeholder={t(`form.detailPh.${type}`)} value={form.detail} onChangeText={set("detail")} />
            </>
          ) : (
            <Field label={t("fields.detail")} placeholder={t("form.notePh")} value={form.detail} onChangeText={set("detail")} multiline />
          )}

          <Button label={existing ? t("common.saveChanges") : t("common.save")} variant="navy" icon="check" disabled={reading || preparing || !!extracted} loading={saving} onPress={() => void save()} style={{ marginTop: space.sm }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
