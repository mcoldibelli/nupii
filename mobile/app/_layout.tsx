import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";
import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold } from "@expo-google-fonts/figtree";
import { useFonts } from "expo-font";
import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { Platform, Pressable, Text, View } from "react-native";

import { missingConfig } from "../src/config";
import { isPublicPath } from "../src/reports/publicPaths";
import { styles } from "../src/screens/styles";
import { SessionProvider, useSession } from "../src/session/SessionContext";
import { useWelcome, WelcomeProvider } from "../src/welcome/WelcomeContext";
import { SelectedPetProvider } from "../src/pets/SelectedPetContext";
import { colors, fonts } from "../src/ui/theme";

/** The header of the screens: the title font of the canvas, with no line under it (ADR 0030). */
const headerOptions = {
  headerTitleStyle: { fontFamily: fonts.titleBold, fontSize: 18, color: colors.ink },
  headerTintColor: colors.ink,
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.background },
  contentStyle: { backgroundColor: colors.background },
};

/** The screens that the state of the session allows. */
function Screens() {
  const { state, reload, signOut } = useSession();
  const welcome = useWelcome();
  const router = useRouter();
  const pathname = usePathname();
  // When the state of the session changes, the app goes to the first screen
  // of the new state. The router alone would pick any screen that the new
  // state allows (after the sign-out it showed the found page).
  const home =
    state.kind === "ready"
      ? "/"
      : state.kind === "needsProfile"
        ? "/complete-profile"
        : state.kind === "signedOut"
          ? Platform.OS !== "web" && welcome.seen === false
            ? "/welcome"
            : "/sign-in"
          : null;
  // The state of the session for which the app last went to the first screen.
  const lastKind = useRef<string | null>(null);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const welcomeKnown = !(state.kind === "signedOut" && Platform.OS !== "web" && welcome.seen === null);
  useEffect(() => {
    if (home === null || !welcomeKnown || lastKind.current === state.kind) {
      return;
    }
    // The public web pages keep their own address.
    if (Platform.OS === "web" && isPublicPath(pathnameRef.current)) {
      lastKind.current = state.kind;
      return;
    }
    // After this render: the stack registers the screens that the new state
    // allows first, and the router refuses a screen it does not have yet.
    const timer = setTimeout(() => {
      lastKind.current = state.kind;
      router.replace(home);
    }, 0);
    return () => clearTimeout(timer);
  }, [home, state.kind, welcomeKnown, router]);
  const missing = missingConfig();
  // A public page of the web does not wait for the session and does not
  // need it (RNF-04). In the app, the board and the detail need the session.
  const isPublicPage = Platform.OS === "web" && isPublicPath(pathname);

  if (isPublicPage) {
    return (
      <Stack screenOptions={headerOptions}>
        <Stack.Screen name="found" options={{ title: "Nupii" }} />
        <Stack.Screen name="reports/index" options={{ title: "Mural de perdidos e achados" }} />
        <Stack.Screen name="reports/[id]" options={{ title: "Ocorrência" }} />
        <Stack.Screen name="card" options={{ title: "Carteirinha" }} />
        <Stack.Screen name="terms" options={{ title: "Termos de uso" }} />
      </Stack>
    );
  }
  if (missing.length > 0) {
    return (
      <View style={styles.screen}>
        <Text testID="status-message" style={styles.text}>
          Defina no arquivo mobile/.env: {missing.join(", ")}.
        </Text>
      </View>
    );
  }
  // On the first open, the app waits to know if it shows the welcome.
  if (state.kind === "loading" || (state.kind === "signedOut" && Platform.OS !== "web" && welcome.seen === null)) {
    return (
      <View style={styles.screen}>
        <Text testID="status-message" style={styles.text}>
          Carregando...
        </Text>
      </View>
    );
  }
  if (state.kind === "failed") {
    return (
      <View style={styles.screen}>
        <Text testID="status-message" accessibilityRole="alert" style={styles.text}>
          {state.message}
        </Text>
        <Pressable testID="retry-button" accessibilityRole="button" style={styles.button} onPress={reload}>
          <Text style={styles.buttonText}>Tentar de novo</Text>
        </Pressable>
        <Pressable testID="failed-sign-out-button" accessibilityRole="button" style={styles.link} onPress={signOut}>
          <Text style={styles.linkText}>Sair</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Protected guard={state.kind === "ready"}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="pets/new" options={{ headerShown: false }} />
        <Stack.Screen name="pets/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="pets/edit/[id]" options={{ title: "Editar pet" }} />
        <Stack.Screen name="noseprint/[petId]" options={{ headerShown: false }} />
        <Stack.Screen name="found-notices" options={{ title: "Avisos de encontro" }} />
        <Stack.Screen name="share/[petId]" options={{ title: "Carteirinha" }} />
        <Stack.Screen name="profile" options={{ title: "Meu perfil" }} />
        <Stack.Screen name="notifications" options={{ title: "Notificações" }} />
        <Stack.Screen name="health/[petId]" options={{ headerShown: false }} />
        <Stack.Screen name="health/event" options={{ headerShown: false }} />
        <Stack.Screen name="reports/lost" options={{ title: "Pet desaparecido" }} />
      </Stack.Protected>
      <Stack.Protected guard={state.kind === "needsProfile"}>
        <Stack.Screen name="complete-profile" options={{ headerShown: false }} />
      </Stack.Protected>
      {/* The welcome comes before the sign-in only on the first open of the app. */}
      <Stack.Protected guard={state.kind === "signedOut" && Platform.OS !== "web" && welcome.seen === false}>
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={state.kind === "signedOut"}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      </Stack.Protected>
      {/* The board, a report, the found flow and the terms need no account
          (RNF-04): in the app they open with or without a session. They come
          after the groups above, so they are never the fallback screen. */}
      <Stack.Protected guard={state.kind === "ready" || state.kind === "signedOut"}>
        <Stack.Screen name="reports/index" options={{ title: "Mural" }} />
        <Stack.Screen name="reports/[id]" options={{ title: "Ocorrência" }} />
      </Stack.Protected>
      <Stack.Protected guard={Platform.OS !== "web" && (state.kind === "ready" || state.kind === "signedOut")}>
        <Stack.Screen name="found" options={{ title: "Achei um cachorro" }} />
        <Stack.Screen name="terms" options={{ title: "Termos de uso" }} />
      </Stack.Protected>
      {/* The public pages have their own stack above. They are listed here
          only with a false guard: a route with no guard, or with a true one,
          becomes the screen that the router shows in place of a screen that
          the state of the session does not allow (in the app after the
          sign-out, and on the web at "/" with no session). */}
      <Stack.Protected guard={false}>
        <Stack.Screen name="card" options={{ title: "Carteirinha" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // ADR 0030: the fonts of the design canvas. The first screen waits for them.
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });
  // A font that fails to load does not block the app: the system font is used.
  if (!fontsLoaded && fontError === null) {
    return null;
  }
  return (
    <SessionProvider>
      <WelcomeProvider>
        <SelectedPetProvider>
          <Screens />
        </SelectedPetProvider>
      </WelcomeProvider>
      <StatusBar style="auto" />
    </SessionProvider>
  );
}
