import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";
import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold } from "@expo-google-fonts/figtree";
import { useFonts } from "expo-font";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, Pressable, Text, View } from "react-native";

import { missingConfig } from "../src/config";
import { isPublicPath } from "../src/reports/publicPaths";
import { styles } from "../src/screens/styles";
import { SessionProvider, useSession } from "../src/session/SessionContext";
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
  const missing = missingConfig();
  // A public page of the web does not wait for the session and does not
  // need it (RNF-04). In the app, the board and the detail need the session.
  const pathname = usePathname();
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
  if (state.kind === "loading") {
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
        <Stack.Screen name="index" options={{ title: "Meus pets" }} />
        <Stack.Screen name="pets/new" options={{ title: "Novo pet" }} />
        <Stack.Screen name="pets/[id]" options={{ title: "Editar pet" }} />
        <Stack.Screen name="noseprint/[petId]" options={{ title: "Focinho" }} />
        <Stack.Screen name="found-notices" options={{ title: "Avisos de encontro" }} />
        <Stack.Screen name="share/[petId]" options={{ title: "Carteirinha" }} />
        <Stack.Screen name="profile" options={{ title: "Meu perfil" }} />
        <Stack.Screen name="notifications" options={{ title: "Notificações" }} />
        <Stack.Screen name="health/[petId]" options={{ title: "Saúde" }} />
        <Stack.Screen name="health/event" options={{ title: "Evento de saúde" }} />
        <Stack.Screen name="reports/index" options={{ title: "Mural" }} />
        <Stack.Screen name="reports/[id]" options={{ title: "Ocorrência" }} />
        <Stack.Screen name="reports/lost" options={{ title: "Pet desaparecido" }} />
      </Stack.Protected>
      <Stack.Protected guard={state.kind === "needsProfile"}>
        <Stack.Screen name="complete-profile" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={state.kind === "signedOut"}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      </Stack.Protected>
      {/* The public pages have their own stack above. They are listed here
          only with a false guard: a route with no guard, or with a true one,
          becomes the screen that the router shows in place of a screen that
          the state of the session does not allow (in the app after the
          sign-out, and on the web at "/" with no session). */}
      <Stack.Protected guard={false}>
        <Stack.Screen name="found" options={{ title: "Nupii" }} />
        <Stack.Screen name="card" options={{ title: "Carteirinha" }} />
        <Stack.Screen name="terms" options={{ title: "Termos de uso" }} />
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
      <Screens />
      <StatusBar style="auto" />
    </SessionProvider>
  );
}
