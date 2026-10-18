import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useMemo } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { collectDeadlines } from "@/lib/status";
import { useRecords } from "@/store/records";
import { colors, shadow } from "@/theme";

export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { records } = useRecords();
  const urgent = useMemo(() => collectDeadlines(records, 30).filter((d) => d.kind !== "incomplete" && (d.daysLeft ?? 99) <= 30).length, [records]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarStyle: {
          height: 64 + Math.max(insets.bottom, 8),
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.home"), tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} /> }} />
      <Tabs.Screen name="records" options={{ title: t("tabs.records"), tabBarIcon: ({ color }) => <Feather name="layers" size={22} color={color} /> }} />
      <Tabs.Screen
        name="add"
        options={{
          title: "",
          tabBarAccessibilityLabel: t("tabs.add"),
          tabBarIcon: () => (
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: colors.navy,
                alignItems: "center",
                justifyContent: "center",
                marginTop: Platform.OS === "ios" ? 14 : 4,
                borderWidth: 4,
                borderColor: colors.surface,
                ...shadow,
                shadowOpacity: 0.2,
              }}
            >
              <Feather name="plus" size={26} color={colors.white} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: t("tabs.alerts"),
          tabBarBadge: urgent > 0 ? urgent : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.warning, color: colors.white, fontSize: 10 },
          tabBarIcon: ({ color }) => <Feather name="bell" size={22} color={color} />,
        }}
      />
      <Tabs.Screen name="more" options={{ title: t("tabs.more"), tabBarIcon: ({ color }) => <Feather name="more-horizontal" size={22} color={color} /> }} />
    </Tabs>
  );
}
