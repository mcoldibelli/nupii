// Expo puts the variables that start with EXPO_PUBLIC_ in the app bundle.
// None of them is a secret.

/** Address of the API. */
export const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";

/** Address of the public web, for the link of the health card (ADR 0027). */
export const webUrl = process.env.EXPO_PUBLIC_WEB_URL ?? "";

/** Configuration of the Firebase project of the app. */
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
};

/** Address of the Authentication emulator, or empty to use the real project. */
export const authEmulatorUrl = process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL ?? "";

/** Names of the required variables that have no value. */
export function missingConfig(): string[] {
  const required: Record<string, string> = {
    EXPO_PUBLIC_API_URL: apiUrl,
    EXPO_PUBLIC_WEB_URL: webUrl,
    EXPO_PUBLIC_FIREBASE_API_KEY: firebaseConfig.apiKey,
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
  };
  return Object.keys(required).filter((name) => required[name] === "");
}
