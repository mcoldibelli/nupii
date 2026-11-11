import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { getMe, registerMe, type Owner, type OwnerResult } from "./src/api/owner";
import { currentIdToken, signOutAccount, subscribeToAccount } from "./src/auth/firebase";
import { apiUrl, missingConfig } from "./src/config";
import { AuthScreen } from "./src/screens/AuthScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { styles } from "./src/screens/styles";

type State =
  | { kind: "loading" }
  | { kind: "signedOut" }
  // The account is signed in, and the API has no owner for it yet.
  | { kind: "needsProfile" }
  | { kind: "ready"; owner: Owner }
  | { kind: "failed"; message: string };

/** Message for a failure of a call about the owner. */
function failureMessage(result: Extract<OwnerResult, { ok: false }>): string {
  if (result.code === "network") {
    return "Sem conexão com o servidor. Confira a internet e tente de novo.";
  }
  return `O servidor respondeu com um erro (${result.code}). Tente de novo.`;
}

export default function App() {
  const [state, setState] = useState<State>({ kind: "loading" });

  // Reads the owner of the signed-in account from the API.
  const loadOwner = useCallback(async () => {
    setState({ kind: "loading" });
    const idToken = await currentIdToken();
    if (idToken === null) {
      setState({ kind: "signedOut" });
      return;
    }
    const result = await getMe(apiUrl, idToken);
    if (result.ok) {
      setState({ kind: "ready", owner: result.owner });
    } else if (result.code === "owner_not_found") {
      setState({ kind: "needsProfile" });
    } else if (result.code === "unauthenticated") {
      // The API does not accept the session. The owner signs in again.
      await signOutAccount();
    } else {
      setState({ kind: "failed", message: failureMessage(result) });
    }
  }, []);

  useEffect(() => {
    if (missingConfig().length > 0) {
      return;
    }
    return subscribeToAccount((account) => {
      if (account === null) {
        setState({ kind: "signedOut" });
      } else {
        void loadOwner();
      }
    });
  }, [loadOwner]);

  async function register(name: string): Promise<string | null> {
    const idToken = await currentIdToken();
    if (idToken === null) {
      return "A sessão terminou. Entre de novo.";
    }
    const result = await registerMe(apiUrl, idToken, name);
    if (!result.ok) {
      return failureMessage(result);
    }
    setState({ kind: "ready", owner: result.owner });
    return null;
  }

  function signOutNow() {
    void signOutAccount();
  }

  const missing = missingConfig();
  let screen;
  if (missing.length > 0) {
    screen = (
      <View style={styles.screen}>
        <Text testID="status-message" style={styles.text}>
          Defina no arquivo mobile/.env: {missing.join(", ")}.
        </Text>
      </View>
    );
  } else if (state.kind === "signedOut") {
    screen = <AuthScreen />;
  } else if (state.kind === "needsProfile") {
    screen = <ProfileScreen onRegister={register} onSignOut={signOutNow} />;
  } else if (state.kind === "ready") {
    screen = <HomeScreen owner={state.owner} onSignOut={signOutNow} />;
  } else if (state.kind === "failed") {
    screen = (
      <View style={styles.screen}>
        <Text testID="status-message" accessibilityRole="alert" style={styles.text}>
          {state.message}
        </Text>
        <Pressable testID="retry-button" accessibilityRole="button" style={styles.button} onPress={loadOwner}>
          <Text style={styles.buttonText}>Tentar de novo</Text>
        </Pressable>
        <Pressable testID="failed-sign-out-button" accessibilityRole="button" style={styles.link} onPress={signOutNow}>
          <Text style={styles.linkText}>Sair</Text>
        </Pressable>
      </View>
    );
  } else {
    screen = (
      <View style={styles.screen}>
        <Text testID="status-message" style={styles.text}>
          Carregando...
        </Text>
      </View>
    );
  }

  return (
    <>
      {screen}
      <StatusBar style="auto" />
    </>
  );
}
