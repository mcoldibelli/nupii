import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, Pressable, Text, View } from "react-native";

import { missingConfig } from "../src/config";
import { isPublicPath } from "../src/reports/publicPaths";
import { styles } from "../src/screens/styles";
import { SessionProvider, useSession } from "../src/session/SessionContext";

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
      <Stack>
        <Stack.Screen name="found" options={{ title: "Nupii" }} />
        <Stack.Screen name="reports/index" options={{ title: "Mural de perdidos e achados" }} />
        <Stack.Screen name="reports/[id]" options={{ title: "Ocorrência" }} />
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
    <Stack>
      <Stack.Protected guard={state.kind === "ready"}>
        <Stack.Screen name="index" options={{ title: "Meus pets" }} />
        <Stack.Screen name="pets/new" options={{ title: "Novo pet" }} />
        <Stack.Screen name="pets/[id]" options={{ title: "Editar pet" }} />
        <Stack.Screen name="noseprint/[petId]" options={{ title: "Focinho" }} />
        <Stack.Screen name="found-notices" options={{ title: "Avisos de encontro" }} />
        <Stack.Screen name="reports/index" options={{ title: "Mural" }} />
        <Stack.Screen name="reports/[id]" options={{ title: "Ocorrência" }} />
        <Stack.Screen name="reports/lost" options={{ title: "Pet desaparecido" }} />
      </Stack.Protected>
      <Stack.Protected guard={state.kind === "needsProfile"}>
        <Stack.Screen name="complete-profile" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={state.kind === "signedOut"}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
      {/* The public page is for the browser. In the app, a route with no
          guard would be the screen that the app shows after the sign-out. */}
      <Stack.Protected guard={Platform.OS === "web"}>
        <Stack.Screen name="found" options={{ title: "Nupii" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <Screens />
      <StatusBar style="auto" />
    </SessionProvider>
  );
}
