// The only file that imports the Firebase SDK (ADR 0013).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FirebaseError, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAuth,
  GoogleAuthProvider,
  getReactNativePersistence,
  initializeAuth,
  linkWithCredential,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type Auth,
  type AuthCredential,
} from "firebase/auth";

import { Platform } from "react-native";

import { authEmulatorUrl, firebaseConfig } from "../config";
import { authMessage, googleMessage, resetMessage } from "./messages";
import { reauthenticateWithPopup, signInWithPopup } from "./popup";

let instance: Auth | null = null;

/**
 * Returns the Firebase Authentication of the app. The first call creates
 * it, so the import of this file does not fail when the configuration is
 * missing: the app shows a message for that.
 */
function auth(): Auth {
  if (instance === null) {
    const app = initializeApp(firebaseConfig);
    // The session stays in the storage of the device, so it continues
    // after the app is closed (RF-02). In the browser, the SDK keeps the
    // session by itself, and the storage of React Native does not exist.
    instance =
      Platform.OS === "web"
        ? getAuth(app)
        : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    if (authEmulatorUrl !== "") {
      connectAuthEmulator(instance, authEmulatorUrl, { disableWarnings: true });
    }
  }
  return instance;
}

/** The account that is signed in. */
export type Account = { email: string };

/**
 * Calls listener with the account that is signed in, or null, now and each
 * time it changes. Returns the function that stops the calls.
 */
export function subscribeToAccount(listener: (account: Account | null) => void): () => void {
  return onAuthStateChanged(auth(), (user) => {
    listener(user === null ? null : { email: user.email ?? "" });
  });
}

/**
 * Returns the ID token of the account that is signed in, or null when no
 * account is signed in. The SDK renews the token. The renewal needs the
 * network: this function throws when the renewal fails.
 */
export async function currentIdToken(): Promise<string | null> {
  const user = auth().currentUser;
  return user === null ? null : user.getIdToken();
}

/** Runs a Firebase call and returns null, or the message of the failure. */
async function messageOf(action: () => Promise<unknown>): Promise<string | null> {
  try {
    await action();
    return null;
  } catch (error) {
    return authMessage(error instanceof FirebaseError ? error.code : "");
  }
}

/** The Google credential of an e-mail that already has a password (ADR 0029, item 12). */
let pendingGoogle: AuthCredential | null = null;

/**
 * Signs in. Returns null, or the message of the failure. After a login with
 * Google refused for an e-mail with a password, this login links Google to
 * the account (ADR 0029, item 12).
 */
export function signIn(email: string, password: string): Promise<string | null> {
  return messageOf(async () => {
    const { user } = await signInWithEmailAndPassword(auth(), email.trim(), password);
    if (pendingGoogle !== null) {
      const credential = pendingGoogle;
      pendingGoogle = null;
      await linkWithCredential(user, credential);
    }
  });
}

/**
 * Signs in with Google in a window of the browser (RF-03, ADR 0029, item 11).
 * Returns the message of the failure, or null; and the e-mail of the account
 * when that e-mail already has a password, for the login that links Google.
 */
export async function signInWithGoogle(): Promise<{ message: string | null; email?: string }> {
  try {
    await signInWithPopup(auth(), new GoogleAuthProvider());
    return { message: null };
  } catch (error) {
    if (!(error instanceof FirebaseError)) {
      return { message: authMessage("") };
    }
    if (error.code === "auth/account-exists-with-different-credential") {
      pendingGoogle = GoogleAuthProvider.credentialFromError(error);
      const email = error.customData?.email;
      return { message: googleMessage(error.code), email: typeof email === "string" ? email : undefined };
    }
    return { message: googleMessage(error.code) };
  }
}

/** True when the account that is signed in has a password, and not only Google. */
export function hasPassword(): boolean {
  return auth().currentUser?.providerData.some((provider) => provider.providerId === "password") ?? false;
}

/** Creates the account and signs in. Returns null, or the message of the failure. */
export function createAccount(email: string, password: string): Promise<string | null> {
  return messageOf(() => createUserWithEmailAndPassword(auth(), email.trim(), password));
}

/** Signs out. Returns null, or the message of the failure. */
export function signOutAccount(): Promise<string | null> {
  return messageOf(() => signOut(auth()));
}

/**
 * Sends the e-mail with the link to reset the password (RF-05). An e-mail
 * with no account gets the same answer, so the screen does not tell which
 * e-mails have an account.
 */
export async function sendPasswordReset(email: string): Promise<string | null> {
  try {
    await sendPasswordResetEmail(auth(), email.trim());
    return null;
  } catch (error) {
    return resetMessage(error instanceof FirebaseError ? error.code : "");
  }
}

/**
 * Signs in again with the password of the account. Firebase asks for it
 * before a sensitive change. An account with only Google signs in again in
 * the window of Google, and the password is not used (ADR 0029, item 13).
 */
async function reauthenticate(password: string): Promise<void> {
  const user = auth().currentUser;
  if (user === null || user.email === null) {
    throw new FirebaseError("auth/no-current-user", "no account is signed in");
  }
  if (!hasPassword()) {
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
    return;
  }
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
}

/** Changes the password (RF-07). Returns null, or the message of the failure. */
export function changePassword(current: string, next: string): Promise<string | null> {
  return messageOf(async () => {
    await reauthenticate(current);
    const user = auth().currentUser;
    if (user !== null) {
      await updatePassword(user, next);
    }
  });
}

/** Checks the password of the account before the delete of the account (RF-08). */
export function confirmPassword(password: string): Promise<string | null> {
  return messageOf(() => reauthenticate(password));
}
