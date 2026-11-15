// The app has no window of Google: the Android login comes with the Google
// Sign-In package (ADR 0029, item 11). popup.web.ts is the web version.
import { FirebaseError } from "firebase/app";

function unsupported(): Promise<never> {
  return Promise.reject(new FirebaseError("auth/operation-not-supported-in-this-environment", "no Google window in the app"));
}

export const signInWithPopup: typeof import("./popup.web").signInWithPopup = unsupported;
export const reauthenticateWithPopup: typeof import("./popup.web").reauthenticateWithPopup = unsupported;
