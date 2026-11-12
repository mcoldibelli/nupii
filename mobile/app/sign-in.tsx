import { useLocalSearchParams } from "expo-router";

import { AuthScreen } from "../src/screens/AuthScreen";

/** Sign-in. The welcome opens it in the mode to create an account with ?mode=create. */
export default function SignIn() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return <AuthScreen startCreating={mode === "create"} />;
}
