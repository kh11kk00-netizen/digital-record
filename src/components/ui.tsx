import { Feather } from "@expo/vector-icons";
import type { ComponentProps, ReactNode, Ref } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { isRTL } from "@/i18n";
import { formatDate, formatMoney } from "@/lib/format";
import { insight, type Tone } from "@/lib/status";
import type { DigitalRecord } from "@/lib/types";
import { colors, radius, shadow, space } from "@/theme";
import { RecordIcon } from "./RecordIcon";

export type FeatherName = ComponentProps<typeof Feather>["name"];

/* ---------- Text ---------- */
type TxtProps = TextProps & {
  variant?: "h1" | "h2" | "h3" | "body" | "small" | "tiny";
  color?: string;
  weight?: TextStyle["fontWeight"];
  center?: boolean;
};
const variants: Record<NonNullable<TxtProps["variant"]>, TextStyle> = {
  h1: { fontSize: 24, fontWeight: "800", lineHeight: 34 },
  h2: { fontSize: 18, fontWeight: "700", lineHeight: 26 },
  h3: { fontSize: 15, fontWeight: "700", lineHeight: 22 },
  body: { fontSize: 14, lineHeight: 21 },
  small: { fontSize: 12, lineHeight: 18 },
  tiny: { fontSize: 11, lineHeight: 15 },
};
export function Txt({ variant = "body", color = colors.ink, weight, center, style, ...rest }: TxtProps) {
  return (
    <Text
      {...rest}
      style={[variants[variant], { color, textAlign: center ? "center" : "left", writingDirection: isRTL() ? "rtl" : "ltr" }, weight ? { fontWeight: weight } : null, style]}
    />
  );
}

/* ---------- Layout ---------- */
export function Screen({ children, scroll = true, edges = ["top"], bg = colors.background, padded = true }: { children: ReactNode; scroll?: boolean; edges?: Edge[]; bg?: string; padded?: boolean }) {
  const content = padded ? { paddingHorizontal: space.lg, paddingBottom: 120, paddingTop: space.sm } : undefined;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, content]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Row({ children, style, gap = space.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap }, style]}>{children}</View>;
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chevron({ color = colors.muted, size = 18 }: { color?: string; size?: number }) {
  return <Feather name={isRTL() ? "chevron-left" : "chevron-right"} size={size} color={color} />;
}
export function BackIcon({ color = colors.ink }: { color?: string }) {
  return <Feather name={isRTL() ? "chevron-right" : "chevron-left"} size={24} color={color} />;
}

export function Header({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <View style={{ marginBottom: space.lg, marginTop: space.sm }}>
      <Row style={{ justifyContent: "space-between", minHeight: 40 }}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} style={styles.iconBtn} accessibilityRole="button">
            <BackIcon />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <Txt variant="h2" center style={{ flex: 1 }} numberOfLines={1}>
          {title}
        </Txt>
        <View style={{ width: 40, alignItems: "flex-end" }}>{right}</View>
      </Row>
      {subtitle ? (
        <Txt variant="small" color={colors.muted} center style={{ marginTop: 2 }}>
          {subtitle}
        </Txt>
      ) : null}
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <Row style={{ justifyContent: "space-between", marginTop: space.xl, marginBottom: space.md }}>
      <Txt variant="h3">{title}</Txt>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Txt variant="small" color={colors.primary} weight="600">
            {action}
          </Txt>
        </Pressable>
      ) : null}
    </Row>
  );
}

/* ---------- Controls ---------- */
export function Button({
  label,
  onPress,
  variant = "navy",
  icon,
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: "navy" | "primary" | "light" | "ghost" | "danger" | "white";
  icon?: FeatherName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = {
    navy: { bg: colors.navy, fg: colors.white, border: colors.navy },
    primary: { bg: colors.primary, fg: colors.white, border: colors.primary },
    light: { bg: colors.primarySoft, fg: colors.navy, border: colors.primarySoft },
    ghost: { bg: "transparent", fg: colors.navy, border: colors.border },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
    white: { bg: colors.white, fg: colors.navy, border: colors.white },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Row gap={8} style={{ justifyContent: "center" }}>
          {icon ? <Feather name={icon} size={18} color={palette.fg} /> : null}
          <Txt variant="h3" color={palette.fg} center>
            {label}
          </Txt>
        </Row>
      )}
    </Pressable>
  );
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: FeatherName }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: colors.navy, borderColor: colors.navy }]}>
      <Row gap={6}>
        {icon ? <Feather name={icon} size={14} color={active ? colors.white : colors.navy} /> : null}
        <Txt variant="small" weight="600" color={active ? colors.white : colors.ink}>
          {label}
        </Txt>
      </Row>
    </Pressable>
  );
}

export function SearchBar({ value, onChangeText, placeholder, onFocus, editable = true, inputRef }: { value?: string; onChangeText?: (v: string) => void; placeholder: string; onFocus?: () => void; editable?: boolean; inputRef?: Ref<TextInput> }) {
  return (
    <Row style={styles.search} gap={10}>
      <Feather name="search" size={18} color={colors.muted} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        onFocus={onFocus}
        editable={editable}
        style={styles.searchInput}
        returnKeyType="search"
      />
      {value ? (
        <Pressable onPress={() => onChangeText?.("")} hitSlop={10}>
          <Feather name="x-circle" size={16} color={colors.muted} />
        </Pressable>
      ) : null}
    </Row>
  );
}

export function Field({ label, hint, error, ...input }: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Txt variant="small" weight="700" style={{ marginBottom: 6 }}>
        {label}
      </Txt>
      <TextInput
        placeholderTextColor={colors.muted}
        {...input}
        style={[styles.input, error ? { borderColor: colors.danger } : null, input.multiline ? { minHeight: 90, textAlignVertical: "top" } : null]}
      />
      {error ? (
        <Txt variant="tiny" color={colors.danger} style={{ marginTop: 4 }}>
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="tiny" color={colors.muted} style={{ marginTop: 4 }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

/* ---------- Status ---------- */
const toneColors: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: "#B86E12" },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  neutral: { bg: colors.neutralSoft, fg: colors.muted },
  info: { bg: colors.primarySoft, fg: colors.primary },
};
export function Badge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const c = toneColors[tone];
  return (
    <View style={{ backgroundColor: c.bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, alignSelf: "flex-start" }}>
      <Txt variant="tiny" weight="700" color={c.fg}>
        {label}
      </Txt>
    </View>
  );
}

export function Progress({ value, tone = "success" }: { value: number; tone?: Tone }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height: 8, borderRadius: 8, backgroundColor: colors.neutralSoft, overflow: "hidden" }}>
      <View style={{ width: `${pct * 100}%`, height: "100%", borderRadius: 8, backgroundColor: toneColors[tone].fg }} />
    </View>
  );
}

export function useStatusLabel() {
  const { t } = useTranslation();
  return (r: DigitalRecord) => t(`status.${insight(r).status}`);
}

/* ---------- Record row (lists) ---------- */
export function RecordRow({ record, onPress }: { record: DigitalRecord; onPress: () => void }) {
  const { t } = useTranslation();
  const i = insight(record);
  const date = record.purchaseDate ?? i.nextDue ?? record.createdAt.slice(0, 10);
  return (
    <Card onPress={onPress} style={{ marginBottom: space.md, paddingVertical: space.md }}>
      <Row gap={space.md}>
        {record.imageUri ? (
          <Image source={{ uri: record.imageUri }} style={styles.thumb} />
        ) : (
          <RecordIcon type={record.type} size={52} />
        )}
        <View style={{ flex: 1, gap: 3 }}>
          <Row gap={6}>
            <Txt variant="h3" numberOfLines={1} style={{ flexShrink: 1 }}>
              {record.title}
            </Txt>
            {record.favorite ? <Feather name="star" size={13} color={colors.warning} /> : null}
          </Row>
          <Txt variant="tiny" color={colors.muted} numberOfLines={1}>
            {t(`types.${record.type}`)}
            {record.price !== null ? `  ·  ${formatMoney(record.price, record.currency)}` : ""}
          </Txt>
          <Row gap={8} style={{ marginTop: 2 }}>
            {i.status !== "none" ? <Badge label={t(`status.${i.status}`)} tone={i.tone} /> : null}
            <Row gap={4}>
              <Feather name="calendar" size={11} color={colors.muted} />
              <Txt variant="tiny" color={colors.muted}>
                {formatDate(i.warrantyEnd ?? date)}
              </Txt>
            </Row>
          </Row>
        </View>
        <Chevron />
      </Row>
    </Card>
  );
}

export function EmptyState({ icon = "inbox", title, body, action, onAction }: { icon?: FeatherName; title: string; body?: string; action?: string; onAction?: () => void }) {
  return (
    <Card style={{ alignItems: "center", paddingVertical: space.xxl, gap: space.sm }}>
      <View style={[styles.emptyIcon]}>
        <Feather name={icon} size={26} color={colors.primary} />
      </View>
      <Txt variant="h3" center>
        {title}
      </Txt>
      {body ? (
        <Txt variant="small" color={colors.muted} center style={{ maxWidth: 280 }}>
          {body}
        </Txt>
      ) : null}
      {action ? <Button label={action} onPress={onAction} variant="primary" icon="plus" style={{ marginTop: space.sm, alignSelf: "stretch" }} /> : null}
    </Card>
  );
}

export const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: colors.border, ...shadow },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btn: { minHeight: 52, borderRadius: radius.md, paddingHorizontal: space.lg, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  search: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: space.md, height: 48 },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink, paddingVertical: 0 },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 15, color: colors.ink },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.neutralSoft },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: 4 },
});
