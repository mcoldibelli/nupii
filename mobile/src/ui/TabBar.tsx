import { router, usePathname, type Href } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSelectedPet } from "../pets/SelectedPetContext";
import { useSession } from "../session/SessionContext";
import { Icon, type IconName } from "./Icon";
import { colors, fonts } from "./theme";

type Tab = { key: string; label: string; icon: IconName; testID: string; selected: (path: string) => boolean; go: () => void };

/**
 * The navigation bar of the canvas (Inicio-Mobile artboard): Início, Mural,
 * the central button that scans a nose, Saúde of the chosen pet, Conta.
 * Only an owner with a session sees it.
 */
export function TabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { state } = useSession();
  const { pet } = useSelectedPet();
  if (state.kind !== "ready") {
    return null;
  }
  const to = (href: Href) => () => router.replace(href);
  const tabs: Tab[] = [
    { key: "home", label: "Início", icon: "home", testID: "tab-home", selected: (path) => path === "/", go: to("/") },
    { key: "board", label: "Mural", icon: "pin", testID: "tab-board", selected: (path) => path.startsWith("/reports"), go: to("/reports") },
    {
      key: "health",
      label: "Saúde",
      icon: "heart",
      testID: "tab-health",
      selected: (path) => path.startsWith("/health"),
      go: pet === null ? to("/pets/new") : to({ pathname: "/health/[petId]", params: { petId: pet.id, petName: pet.name } }),
    },
    { key: "account", label: "Conta", icon: "user", testID: "tab-account", selected: (path) => path === "/profile", go: to("/profile") },
  ];
  const item = (tab: Tab) => {
    const selected = tab.selected(pathname);
    return (
      <Pressable
        key={tab.key}
        testID={tab.testID}
        accessibilityRole="tab"
        accessibilityLabel={tab.label}
        accessibilityState={{ selected }}
        onPress={() => !selected && tab.go()}
        style={{ width: 64, minHeight: 48, alignItems: "center", gap: 4 }}
      >
        <Icon name={tab.icon} size={24} color={selected ? colors.brand : colors.textMuted} strokeWidth={selected ? 2.2 : 1.9} filled={selected && (tab.icon === "home" || tab.icon === "heart")} />
        <Text style={{ fontFamily: selected ? fonts.bodyBold : fonts.bodySemibold, fontSize: 12, color: selected ? colors.primary : colors.textMuted }}>{tab.label}</Text>
      </Pressable>
    );
  };
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: "row", justifyContent: "space-around", alignItems: "flex-start", borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 8) }}
    >
      {item(tabs[0])}
      {item(tabs[1])}
      <Pressable
        testID="tab-scan"
        accessibilityRole="button"
        accessibilityLabel="Escanear focinho"
        onPress={() => router.push("/found")}
        style={{ width: 60, height: 60, marginTop: -26, borderRadius: 35, backgroundColor: colors.brand, borderWidth: 5, borderColor: colors.background, alignItems: "center", justifyContent: "center", boxSizing: "content-box" }}
      >
        <Icon name="scan" size={26} color={colors.onPrimary} strokeWidth={2.1} />
      </Pressable>
      {item(tabs[2])}
      {item(tabs[3])}
    </View>
  );
}
