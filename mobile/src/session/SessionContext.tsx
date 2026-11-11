import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { failureMessage } from "../api/http";
import { getMe, registerMe, type Owner } from "../api/owner";
import { currentIdToken, signOutAccount, subscribeToAccount } from "../auth/firebase";
import { apiUrl, missingConfig } from "../config";

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
  /** Registers the owner. Returns null, or the message of the failure. */
  register: (name: string) => Promise<string | null>;
  signOut: () => void;
  /** Returns the ID token for a call of the API, or null when it cannot get one. */
  idToken: () => Promise<string | null>;
};

/** Message for a failure of the renewal of the session. */
const SESSION_FAILURE = "Não foi possível confirmar a sua sessão. Confira a internet e tente de novo.";

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

  const signOut = useCallback(() => {
    void signOutAccount();
  }, []);

  const session = useMemo(() => ({ state, reload, register, signOut, idToken }), [state, reload, register, signOut, idToken]);
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
