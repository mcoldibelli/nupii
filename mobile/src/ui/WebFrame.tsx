import { router, usePathname, type Href } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useSelectedPet } from "../pets/SelectedPetContext";
import { useSession } from "../session/SessionContext";
import { Icon, LogoMark, type IconName } from "./Icon";
import { colors, fonts, radius, space } from "./theme";
import { useWide } from "./useWide";

/** The logo and the name, as the header of the web artboards. */
export function Brand({ href = "/" }: { href?: Href }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel="Nupii, início" style={local.brand} onPress={() => router.push(href)}>
      <LogoMark size={28} />
      <Text style={local.brandText}>nupii</Text>
    </Pressable>
  );
}

/** The sidebar of the logged-in web artboards (Inicio-Web, Mural-Web, Saude-Web). */
function Sidebar() {
  const pathname = usePathname();
  const { state, signOut } = useSession();
  const { pet } = useSelectedPet();
  const owner = state.kind === "ready" ? state.owner : null;
  const adding = pathname === "/pets/new" || pathname.startsWith("/noseprint");
  const items: { label: string; icon: IconName; href: Href; selected: boolean }[] = [
    { label: "Início", icon: "home", href: "/", selected: pathname === "/" },
    { label: "Mural", icon: "pin", href: "/reports", selected: pathname.startsWith("/reports") },
    {
      label: "Saúde",
      icon: "heart",
      href: pet ? { pathname: "/health/[petId]", params: { petId: pet.id, petName: pet.name } } : "/pets/new",
      selected: pathname.startsWith("/health"),
    },
  ];
  return (
    <View style={local.sidebar}>
      <Brand />
      <View style={{ gap: 4 }} accessibilityRole="tablist">
        {items.map((item) => (
          <Pressable key={item.label} accessibilityRole="tab" accessibilityState={{ selected: item.selected }} style={[local.nav, item.selected && local.navSelected]} onPress={() => router.replace(item.href)}>
            <Icon name={item.icon} size={20} color={item.selected ? colors.brand : colors.textSecondary} filled={item.selected && item.icon !== "pin"} />
            <Text style={[local.navText, item.selected && { color: colors.ink }]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ gap: 6 }}>
        <Text style={local.overline}>MEU PET</Text>
        {pet && (
          <Pressable accessibilityRole="link" style={local.pet} onPress={() => router.push({ pathname: "/pets/[id]", params: { id: pet.id } })}>
            <View style={local.petInitial}>
              <Text style={local.petInitialText}>{pet.name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <Text style={local.petName} numberOfLines={1}>
              {pet.name}
            </Text>
          </Pressable>
        )}
        {/* AddPet-Web: the item shows the registration in progress (#233). */}
        <Pressable accessibilityRole="link" accessibilityState={{ selected: adding }} style={[local.nav, adding && local.navSelected]} onPress={() => router.push("/pets/new")}>
          <Icon name="plus" size={18} color={adding ? colors.brand : colors.textSecondary} />
          <Text style={[local.navText, adding && { color: colors.ink }]}>{adding ? "Adicionando cachorro" : "Adicionar pet"}</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1 }} />
      <Pressable accessibilityRole="button" style={local.scan} onPress={() => router.push("/found")}>
        <Icon name="scan" size={20} color={colors.onPrimary} />
        <Text style={local.scanText}>Escanear um focinho</Text>
      </Pressable>
      {owner && (
        <Pressable accessibilityRole="link" style={local.owner} onPress={() => router.push("/profile")}>
          <View style={local.avatar}>
            <Text style={local.avatarText}>{owner.name.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={local.petName} numberOfLines={1}>
              {owner.name}
            </Text>
            <Text style={local.muted}>Minha conta</Text>
          </View>
        </Pressable>
      )}
      <Pressable accessibilityRole="button" style={local.signOut} onPress={signOut}>
        <Text style={local.signOutText}>Sair da conta</Text>
      </Pressable>
    </View>
  );
}

/** The top header of the public web artboards for a visitor (Landing-Web, Mural-Web-Publico, Achei-Web). */
function VisitorHeader() {
  const links: { label: string; href: Href }[] = [
    { label: "Mural", href: "/reports" },
    { label: "Achei um cachorro", href: "/found" },
  ];
  return (
    <View style={local.header}>
      <View style={local.headerInner}>
        <Brand href="/landing" />
        <View style={{ flexDirection: "row", gap: 6, flex: 1 }}>
          {links.map((link) => (
            <Pressable key={link.label} accessibilityRole="link" style={local.headerLink} onPress={() => router.push(link.href)}>
              <Text style={local.headerLinkText}>{link.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable accessibilityRole="link" style={local.enter} onPress={() => router.push("/sign-in")}>
          <Text style={local.headerLinkText}>Entrar</Text>
        </Pressable>
        <Pressable accessibilityRole="link" style={local.create} onPress={() => router.push({ pathname: "/sign-in", params: { mode: "create" } })}>
          <Text style={[local.headerLinkText, { color: colors.onDark }]}>Criar conta</Text>
        </Pressable>
      </View>
    </View>
  );
}

const authPaths = ["/sign-in", "/forgot-password", "/reset-password"];

/**
 * The frame of the web layout (#231): on a wide screen, the sidebar for an
 * owner with a session, or the top header for a visitor, around the screen.
 * On a phone it changes nothing.
 */
export function WebFrame({ children }: { children: ReactNode }) {
  const wide = useWide();
  const { state } = useSession();
  const pathname = usePathname();
  // The sign-in and the reset of the password have their own split page (Login-Web, Cadastro-Web, #232).
  if (!wide || authPaths.includes(pathname)) {
    return <>{children}</>;
  }
  if (state.kind === "ready") {
    return (
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.background }}>
        {/* "noprint": the printed card has no sidebar (Baixar carteirinha, #233). */}
        <ScrollView nativeID="noprint-sidebar" style={{ flexGrow: 0 }} contentContainerStyle={{ flexGrow: 1 }}>
          <Sidebar />
        </ScrollView>
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <VisitorHeader />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

const local = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  brandText: { fontFamily: fonts.title, fontSize: 26, letterSpacing: -0.5, color: colors.ink },
  sidebar: { width: 248, minHeight: "100%", padding: space.lg, gap: space.xl, borderRightWidth: 1, borderRightColor: colors.border },
  nav: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingHorizontal: 12, borderRadius: 14 },
  navSelected: { backgroundColor: colors.surface },
  navText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.textSecondary },
  overline: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.6, color: colors.textMuted, paddingHorizontal: 12 },
  pet: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border },
  petInitial: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  petInitialText: { fontFamily: fonts.title, fontSize: 15, color: colors.primary },
  petName: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  scan: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48, borderRadius: radius.pill, backgroundColor: colors.primary },
  scanText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },
  owner: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.dark, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.onDark },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  signOut: { minHeight: 44, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  signOutText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  header: { borderBottomWidth: 1, borderBottomColor: colors.border },
  headerInner: { width: "100%", maxWidth: 1280, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: space.lg, paddingHorizontal: 48, paddingVertical: 14 },
  headerLink: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.surface, justifyContent: "center" },
  headerLinkText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  enter: { minHeight: 40, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.borderStrong, justifyContent: "center" },
  create: { minHeight: 40, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.dark, justifyContent: "center" },
});
