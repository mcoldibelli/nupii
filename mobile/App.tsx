import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { getHealth, type HealthResult } from "./src/api/health";

// Expo puts the variables that start with EXPO_PUBLIC_ in the app bundle.
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";

function message(result: HealthResult | null): string {
  if (apiUrl === "") {
    return "Defina EXPO_PUBLIC_API_URL no arquivo mobile/.env.";
  }
  if (result === null) {
    return "Consultando a API...";
  }
  if (result.ok) {
    return `API: ${result.status}`;
  }
  return `API indisponível (${result.code})`;
}

export default function App() {
  const [result, setResult] = useState<HealthResult | null>(null);

  useEffect(() => {
    if (apiUrl === "") {
      return;
    }
    let mounted = true;
    getHealth(apiUrl).then((next) => {
      if (mounted) {
        setResult(next);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nupii</Text>
      <Text testID="health-message">{message(result)}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    marginBottom: 12,
  },
});
