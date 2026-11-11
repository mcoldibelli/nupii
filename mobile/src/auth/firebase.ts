// The only file that imports the Firebase SDK (ADR 0013).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FirebaseError, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getReactNativePersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { authEmulatorUrl, firebaseConfig } from "../config";

const app = initializeApp(firebaseConfig);
// The session stays in the storage of the device, so it continues after the
// app is closed (RF-02).
const auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
if (authEmulatorUrl !== "") {
  connectAuthEmulator(auth, authEmulatorUrl, { disableWarnings: true });
}

/** The account that is signed in. */
export type Account = { email: string };

/**
 * Calls listener with the account that is signed in, or null, now and each
 * time it changes. Returns the function that stops the calls.
 */
export function subscribeToAccount(listener: (account: Account | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => {
    listener(user === null ? null : { email: user.email ?? "" });
  });
}

/** Returns the ID token of the account that is signed in, or null. The SDK renews the token. */
export async function currentIdToken(): Promise<string | null> {
  return auth.currentUser === null ? null : auth.currentUser.getIdToken();
}

/** Messages for the error codes of Firebase Authentication that the user can fix. */
const messages: Record<string, string> = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/email-already-in-use": "Este e-mail já tem uma conta. Use a opção de entrar.",
  "auth/invalid-email": "Informe um e-mail válido.",
  "auth/weak-password": "A senha é fraca demais. Use uma senha mais longa.",
  "auth/too-many-requests": "Muitas tentativas. Espere um pouco e tente de novo.",
  "auth/network-request-failed": "Sem conexão com o serviço de contas. Confira a internet e tente de novo.",
};

/** Runs a Firebase call and returns null, or the message of the failure. */
async function messageOf(action: () => Promise<unknown>): Promise<string | null> {
  try {
    await action();
    return null;
  } catch (error) {
    const code = error instanceof FirebaseError ? error.code : "";
    return messages[code] ?? "Não foi possível concluir. Tente de novo.";
  }
}

/** Signs in. Returns null, or the message of the failure. */
export function signIn(email: string, password: string): Promise<string | null> {
  return messageOf(() => signInWithEmailAndPassword(auth, email.trim(), password));
}

/** Creates the account and signs in. Returns null, or the message of the failure. */
export function createAccount(email: string, password: string): Promise<string | null> {
  return messageOf(() => createUserWithEmailAndPassword(auth, email.trim(), password));
}

/** Signs out. Returns null, or the message of the failure. */
export function signOutAccount(): Promise<string | null> {
  return messageOf(() => signOut(auth));
}
