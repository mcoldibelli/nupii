import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { markWelcomeSeen, welcomeSeen } from "./slides";

type Welcome = { seen: boolean | null; markSeen: () => void };

const WelcomeContext = createContext<Welcome>({ seen: true, markSeen: () => undefined });

/** Keeps if this device already showed the welcome; null while it reads the storage. */
export function WelcomeProvider({ children }: { children: ReactNode }) {
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    void welcomeSeen().then(setSeen);
  }, []);
  const markSeen = useCallback(() => {
    setSeen(true);
    void markWelcomeSeen();
  }, []);
  const value = useMemo(() => ({ seen, markSeen }), [seen, markSeen]);
  return <WelcomeContext.Provider value={value}>{children}</WelcomeContext.Provider>;
}

export function useWelcome(): Welcome {
  return useContext(WelcomeContext);
}
