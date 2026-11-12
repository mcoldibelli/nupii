import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { failureMessage, SESSION_FAILURE } from "../api/http";
import { deleteMe, getMe, registerMe, updateMe, type Owner } from "../api/owner";
import { confirmPassword, createAccount, currentIdToken, signOutAccount, subscribeToAccount } from "../auth/firebase";
import { apiUrl, missingConfig } from "../config";
import { deleteAccountFlow, renameFailure } from "./account";

export type SessionState =
  | { kind: "loading" }
  | { kind: "signedOut" }
  // The account is signed in, and the API has no owner for it yet.
  | { kind: "needsProfile" }
  | { kind: "ready"; owner: Owner }
  | { kind: "failed"; message: string };

type Session = {
  state: SessionState;
  /** Reads the owner of the signed-in account again. */
  reload: () => Promise<void>;
  /**
   * Creates the account and registers the owner with the name and the
   * acceptance of the terms, in one step (Cadastro-Mobile artboard).
   * Returns null, or the message of the failure.
   */
  signUp: (email: string, password: string, name: string) => Promise<string | null>;
  /** Registers the owner. Returns null, or the message of the failure. */
  register: (name: string) => Promise<string | null>;
  /** Changes the name of the owner (RF-06). Returns null, or the message of the failure. */
  rename: (name: string) => Promise<string | null>;
  /** Checks the password and deletes the account (RF-08). Returns null, or the message of the failure. */
  deleteAccount: (password: string) => Promise<string | null>;
  signOut: () => void;
  /** Returns the ID token for a call of the API, or null when it cannot get one. */
  idToken: () => Promise<string | null>;
};

const SessionContext = createContext<Session | null>(null);

/** Returns the session. The component must be inside SessionProvider. */
export function useSession(): Session {
  const session = useContext(SessionContext);
  if (session === null) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return session;
}

/** Keeps the account and the owner for all the screens. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ kind: "loading" });
  // The name of a sign-up in progress: the new account has no owner yet,
  // and the session registers it with this name.
  const pendingName = useRef<string | null>(null);

  const idToken = useCallback(async (): Promise<string | null> => {
    try {
      return await currentIdToken();
    } catch {
      // The renewal of the token failed, for example without network.
      return null;
    }
  }, []);

  const reload = useCallback(async () => {
    setState({ kind: "loading" });
    let token: string | null;
    try {
      token = await currentIdToken();
    } catch {
      setState({ kind: "failed", message: SESSION_FAILURE });
      return;
    }
    if (token === null) {
      setState({ kind: "signedOut" });
      return;
    }
    const result = await getMe(apiUrl, token);
    if (result.ok) {
      setState({ kind: "ready", owner: result.value });
    } else if (result.code === "owner_not_found" && pendingName.current !== null) {
      const name = pendingName.current;
      pendingName.current = null;
      const registered = await registerMe(apiUrl, token, name);
      setState(registered.ok ? { kind: "ready", owner: registered.value } : { kind: "needsProfile" });
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
        void reload();
      }
    });
  }, [reload]);

  const register = useCallback(
    async (name: string): Promise<string | null> => {
      const token = await idToken();
      if (token === null) {
        return SESSION_FAILURE;
      }
      const result = await registerMe(apiUrl, token, name);
      if (!result.ok) {
        return failureMessage(result);
      }
      setState({ kind: "ready", owner: result.value });
      return null;
    },
    [idToken],
  );

  const rename = useCallback(
    async (name: string): Promise<string | null> => {
      const token = await idToken();
      if (token === null) {
        return SESSION_FAILURE;
      }
      const result = await updateMe(apiUrl, token, name);
      if (!result.ok) {
        return renameFailure(result);
      }
      setState({ kind: "ready", owner: result.value });
      return null;
    },
    [idToken],
  );

  const deleteAccount = useCallback(
    (password: string) =>
      deleteAccountFlow(
        { confirm: confirmPassword, idToken, remove: (token) => deleteMe(apiUrl, token), signOut: signOutAccount },
        password,
      ),
    [idToken],
  );

  const signUp = useCallback(async (email: string, password: string, name: string): Promise<string | null> => {
    pendingName.current = name;
    const failure = await createAccount(email, password);
    if (failure !== null) {
      pendingName.current = null;
    }
    return failure;
  }, []);

  const signOut = useCallback(() => {
    void signOutAccount();
  }, []);

  const session = useMemo(
    () => ({ state, reload, signUp, register, rename, deleteAccount, signOut, idToken }),
    [state, reload, signUp, register, rename, deleteAccount, signOut, idToken],
  );
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
