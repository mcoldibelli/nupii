// The window of Google on the web (RF-03, ADR 0029, item 11). The tsconfig
// gives "firebase/auth" the types of React Native, which have no window
// functions; the web build uses the browser build of the SDK, which has them.
import * as firebaseAuth from "firebase/auth";
// The "exports" of the package hide this file, so the path is relative.
import type * as BrowserAuth from "../../node_modules/@firebase/auth/dist/auth-public";

const browser = firebaseAuth as unknown as typeof BrowserAuth;

export const signInWithPopup = browser.signInWithPopup;
export const reauthenticateWithPopup = browser.reauthenticateWithPopup;
