import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { View } from "react-native";
import type { RecordType } from "@/lib/types";
import { colors, radius } from "@/theme";

type FeatherName = ComponentProps<typeof Feather>["name"];

const FEATHER: Record<Exclude<RecordType, "vehicle">, FeatherName> = {
  purchase: "file-text",
  warranty: "shield",
  maintenance: "tool",
  home: "home",
  subscription: "calendar",
  document: "file",
  other: "grid",
};

export function TypeGlyph({ type, size = 20, color = colors.navy }: { type: RecordType; size?: number; color?: string }) {
  if (type === "vehicle") return <MaterialCommunityIcons name="car-outline" size={size + 2} color={color} />;
  return <Feather name={FEATHER[type]} size={size} color={color} />;
}

export function RecordIcon({ type, size = 44, bg = colors.primarySoft, color = colors.navy }: { type: RecordType; size?: number; bg?: string; color?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: radius.md, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <TypeGlyph type={type} size={Math.round(size * 0.45)} color={color} />
    </View>
  );
}
