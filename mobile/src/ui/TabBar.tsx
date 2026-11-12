import { router, usePathname, type Href } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "./Icon";
import { colors, fonts } from "./theme";

const tabs: { href: Href; path: string; label: string; icon: IconName; testID: string }[] = [
  { href: "/", path: "/", label: "Início", icon: "home", testID: "tab-home" },
  { href: "/reports", path: "/reports", label: "Mural", icon: "pin", testID: "tab-board" },
  { href: "/notifications", path: "/notifications", label: "Avisos", icon: "bell", testID: "tab-notifications" },
  { href: "/profile", path: "/profile", label: "Conta", icon: "user", testID: "tab-account" },
];

/** The navigation bar at the bottom of the main screens, as in the canvas. */
export function TabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        justifyContent: "space-around",
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.background,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 8),
      }}
    >
      {tabs.map((tab) => {
        const selected = pathname === tab.path;
        return (
          <Pressable
            key={tab.path}
            testID={tab.testID}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) {
                router.replace(tab.href);
              }
            }}
            style={{ minWidth: 64, minHeight: 48, alignItems: "center", gap: 4 }}
          >
            <Icon name={tab.icon} size={24} color={selected ? colors.brand : colors.textMuted} strokeWidth={selected ? 2.2 : 1.9} />
            <Text style={{ fontFamily: selected ? fonts.bodyBold : fonts.bodySemibold, fontSize: 12, color: selected ? colors.primary : colors.textMuted }}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
