import { router } from "expo-router";

import { failureMessage } from "../../src/api/http";
import { createPet, uploadPetPhoto, type LocalFile, type PetInput } from "../../src/api/pets";
import { apiUrl } from "../../src/config";
import { emptyForm } from "../../src/pets/form";
import { PetFormView } from "../../src/pets/PetFormView";
import { filePart } from "../../src/pets/pickPhoto";
import { useSession } from "../../src/session/SessionContext";

/** Creates a pet, and sends its photo when the owner chose one. */
export default function NewPet() {
  const { idToken } = useSession();

  async function save(input: PetInput, photo: LocalFile | null): Promise<string | null> {
    const token = await idToken();
    if (token === null) {
      return "Não foi possível confirmar a sua sessão. Tente de novo.";
    }
    const created = await createPet(apiUrl, token, input);
    if (!created.ok) {
      return failureMessage(created);
    }
    if (photo !== null) {
      const uploaded = await uploadPetPhoto(apiUrl, token, created.value.id, filePart(photo));
      if (!uploaded.ok) {
        // The pet exists, so this form must not create it again. The edit
        // screen says that the photo was not sent.
        router.replace({ pathname: "/pets/[id]", params: { id: created.value.id, photoFailed: "1" } });
        return null;
      }
    }
    router.back();
    return null;
  }

  return <PetFormView initial={emptyForm} onSubmit={save} />;
}
