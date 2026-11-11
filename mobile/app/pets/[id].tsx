import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { failureMessage, SESSION_FAILURE } from "../../src/api/http";
import { deletePet, getPet, type LocalFile, type Pet, type PetInput } from "../../src/api/pets";
import { apiUrl } from "../../src/config";
import { formFromPet } from "../../src/pets/form";
import { PetFormView } from "../../src/pets/PetFormView";
import { filePart } from "../../src/pets/pickPhoto";
import { savePet } from "../../src/pets/save";
import { LostReportActions } from "../../src/reports/LostReportActions";
import { styles } from "../../src/screens/styles";
import { useSession } from "../../src/session/SessionContext";

/** Changes or deletes a pet of the owner. */
export default function EditPet() {
  const { id, photoFailed } = useLocalSearchParams<{ id: string; photoFailed?: string }>();
  const { idToken } = useSession();
  const [pet, setPet] = useState<Pet | null>(null);
  // The screen of new pet comes here when it created the pet and could not
  // send the photo.
  const [error, setError] = useState<string | null>(
    photoFailed ? "O pet foi criado, mas a foto não foi enviada. Escolha a foto e salve de novo." : null,
  );

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const token = await idToken();
      if (token === null) {
        setError(SESSION_FAILURE);
        return;
      }
      const result = await getPet(apiUrl, token, id);
      if (!mounted) {
        return;
      }
      if (result.ok) {
        setPet(result.value);
      } else {
        setError(result.code === "pet_not_found" ? "Este pet não existe mais." : failureMessage(result));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, idToken]);

  async function save(input: PetInput, photo: LocalFile | null): Promise<string | null> {
    const outcome = await savePet({ baseUrl: apiUrl, idToken }, id, input, photo && filePart(photo));
    switch (outcome.kind) {
      case "saved":
        router.back();
        return null;
      case "photoFailed":
        return `Os dados foram salvos, mas a foto não foi enviada. ${outcome.message}`;
      case "failed":
        return outcome.message;
    }
  }

  function confirmDelete() {
    Alert.alert("Excluir pet", `Excluir ${pet?.name ?? "este pet"}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          const token = await idToken();
          if (token === null) {
            setError(SESSION_FAILURE);
            return;
          }
          const result = await deletePet(apiUrl, token, id);
          if (result.ok) {
            router.back();
          } else {
            setError(failureMessage(result));
          }
        },
      },
    ]);
  }

  if (pet === null) {
    return (
      <View style={styles.screen}>
        <Text testID="status-message" style={styles.text}>
          {error ?? "Carregando..."}
        </Text>
      </View>
    );
  }
  return (
    <>
      {error !== null && (
        <Text testID="edit-pet-error" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {/* RN-07: só um cachorro tem cadastro biométrico. */}
      {pet.species === "dog" && (
        <Pressable
          testID="noseprint-link"
          accessibilityRole="button"
          style={styles.link}
          onPress={() => router.push({ pathname: "/noseprint/[petId]", params: { petId: id } })}
        >
          <Text style={styles.linkText}>Focinho do pet</Text>
        </Pressable>
      )}
      <Pressable
        testID="health-link"
        accessibilityRole="button"
        style={styles.link}
        onPress={() => router.push({ pathname: "/health/[petId]", params: { petId: id, petName: pet.name } })}
      >
        <Text style={styles.linkText}>Saúde do pet</Text>
      </Pressable>
      <LostReportActions petId={id} petName={pet.name} />
      <PetFormView initial={formFromPet(pet)} photoUrl={pet.photoUrl} onSubmit={save} onDelete={confirmDelete} />
    </>
  );
}
