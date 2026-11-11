import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { getNoseprint, registerNoseprint, type Noseprint } from "../../src/api/biometrics";
import { failureMessage, SESSION_FAILURE } from "../../src/api/http";
import type { LocalFile } from "../../src/api/pets";
import { apiUrl } from "../../src/config";
import { formatDateTime, noseprintFailureMessage, qualityLabel } from "../../src/biometrics/messages";
import { filePart, NOSE_PHOTO_QUALITY, pickPhoto, takePhoto } from "../../src/pets/pickPhoto";
import { styles } from "../../src/screens/styles";
import { useSession } from "../../src/session/SessionContext";

/** Shows the noseprint of a dog and registers a new one from a photo (RF-11). */
export default function NoseprintScreen() {
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const { idToken } = useSession();
  // undefined: not read yet. null: the pet has no noseprint.
  const [noseprint, setNoseprint] = useState<Noseprint | null | undefined>(undefined);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const token = await idToken();
      const result = token === null ? null : await getNoseprint(apiUrl, token, petId);
      if (!mounted) {
        return;
      }
      if (result === null) {
        setMessage({ kind: "error", text: SESSION_FAILURE });
      } else if (result.ok) {
        setNoseprint(result.value);
      } else {
        setMessage({ kind: "error", text: failureMessage(result) });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [petId, idToken]);

  async function register(photo: LocalFile) {
    setBusy(true);
    setMessage(null);
    const token = await idToken();
    if (token === null) {
      setMessage({ kind: "error", text: SESSION_FAILURE });
    } else {
      const result = await registerNoseprint(apiUrl, token, petId, filePart(photo));
      if (result.ok) {
        setNoseprint(result.value);
        setMessage({ kind: "success", text: "Focinho cadastrado." });
      } else {
        setMessage({ kind: "error", text: noseprintFailureMessage(result) });
      }
    }
    setBusy(false);
  }

  async function fromCamera() {
    const photo = await takePhoto();
    if (photo === "denied") {
      setMessage({ kind: "error", text: "O app não tem permissão para usar a câmera. Escolha uma foto da galeria." });
    } else if (photo !== null) {
      await register(photo);
    }
  }

  async function fromGallery() {
    const photo = await pickPhoto(NOSE_PHOTO_QUALITY);
    if (photo !== null) {
      await register(photo);
    }
  }

  return (
    <ScrollView contentContainerStyle={local.content}>
      {noseprint ? (
        <>
          <Image testID="noseprint-photo" accessibilityLabel="Foto do focinho" source={{ uri: noseprint.imageUrl }} style={local.photo} />
          <Text testID="noseprint-status" style={styles.text}>
            Cadastrado em {formatDateTime(noseprint.capturedAt)}. Nitidez: {qualityLabel(noseprint.quality)}.
          </Text>
        </>
      ) : (
        <Text testID="noseprint-status" style={styles.text}>
          {noseprint === null ? "Este pet ainda não tem o focinho cadastrado." : "Carregando..."}
        </Text>
      )}

      <Text style={local.tip}>Para uma boa foto:</Text>
      <Text style={local.tip}>1. Chegue perto: o focinho ocupa quase toda a foto.</Text>
      <Text style={local.tip}>2. Use um lugar com luz.</Text>
      <Text style={local.tip}>3. Mantenha o aparelho parado.</Text>

      {message !== null && (
        <Text
          testID={message.kind === "error" ? "noseprint-error" : "noseprint-success"}
          accessibilityRole={message.kind === "error" ? "alert" : undefined}
          style={message.kind === "error" ? styles.error : local.success}
        >
          {message.text}
        </Text>
      )}
      <Pressable
        testID="noseprint-camera-button"
        accessibilityRole="button"
        style={[styles.button, busy && styles.buttonDisabled]}
        disabled={busy}
        onPress={fromCamera}
      >
        <Text style={styles.buttonText}>{busy ? "Enviando..." : "Tirar foto do focinho"}</Text>
      </Pressable>
      <Pressable testID="noseprint-gallery-button" accessibilityRole="button" style={styles.link} disabled={busy} onPress={fromGallery}>
        <Text style={styles.linkText}>Escolher da galeria</Text>
      </Pressable>
    </ScrollView>
  );
}

const local = StyleSheet.create({
  content: { backgroundColor: "#fff", flexGrow: 1, padding: 24 },
  photo: { alignSelf: "center", borderRadius: 12, height: 220, marginBottom: 16, width: 220 },
  tip: { fontSize: 14, marginBottom: 4 },
  success: { color: "#1b6e2d", fontSize: 14, marginBottom: 8, marginTop: 12 },
});
