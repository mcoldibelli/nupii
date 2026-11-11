import { router } from "expo-router";

import { type LocalFile, type PetInput } from "../../src/api/pets";
import { apiUrl } from "../../src/config";
import { emptyForm } from "../../src/pets/form";
import { PetFormView } from "../../src/pets/PetFormView";
import { filePart } from "../../src/pets/pickPhoto";
import { savePet } from "../../src/pets/save";
import { useSession } from "../../src/session/SessionContext";

/** Creates a pet, and sends its photo when the owner chose one. */
export default function NewPet() {
  const { idToken } = useSession();

  async function save(input: PetInput, photo: LocalFile | null): Promise<string | null> {
    const outcome = await savePet({ baseUrl: apiUrl, idToken }, null, input, photo && filePart(photo));
    switch (outcome.kind) {
      case "saved":
        router.back();
        return null;
      case "photoFailed":
        // The pet exists, so this form must not create it again. The edit
        // screen says that the photo was not sent.
        router.replace({ pathname: "/pets/[id]", params: { id: outcome.petId, photoFailed: "1" } });
        return null;
      case "failed":
        return outcome.message;
    }
  }

  return <PetFormView initial={emptyForm} onSubmit={save} />;
}
