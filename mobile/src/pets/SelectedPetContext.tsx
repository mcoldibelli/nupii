import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/** The pet that the home and the health tab show. */
export type SelectedPet = { id: string; name: string };

type Selection = { pet: SelectedPet | null; savedId: string | null; select: (pet: SelectedPet) => void };

const SelectedPetContext = createContext<Selection>({ pet: null, savedId: null, select: () => undefined });

const KEY = "nupii.selected-pet";

/** Keeps the pet chosen in the pet switcher, also after the app closes. */
export function SelectedPetProvider({ children }: { children: ReactNode }) {
  const [pet, setPet] = useState<SelectedPet | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(setSavedId)
      .catch(() => undefined);
  }, []);
  const select = useCallback((next: SelectedPet) => {
    setPet(next);
    setSavedId(next.id);
    AsyncStorage.setItem(KEY, next.id).catch(() => undefined);
  }, []);
  const value = useMemo(() => ({ pet, savedId, select }), [pet, savedId, select]);
  return <SelectedPetContext.Provider value={value}>{children}</SelectedPetContext.Provider>;
}

export function useSelectedPet(): Selection {
  return useContext(SelectedPetContext);
}
