import { router, useLocalSearchParams } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { checkNoseprint, registerNoseprint } from "../../src/api/biometrics";
import { SESSION_FAILURE } from "../../src/api/http";
import type { LocalFile } from "../../src/api/pets";
import { noseprintFailureMessage } from "../../src/biometrics/messages";
import { NoseprintWide } from "../../src/biometrics/NoseprintWide";
import { allGood, nextSlot, type Shot, type Shots } from "../../src/biometrics/shots";
import { apiUrl } from "../../src/config";
import { filePart, NOSE_PHOTO_QUALITY, pickPhoto, takePhoto } from "../../src/pets/pickPhoto";
import { useSession } from "../../src/session/SessionContext";
import { Button } from "../../src/ui/Button";
import { Icon, NoseExample, type IconName } from "../../src/ui/Icon";
import { StepHeader } from "../../src/ui/Surfaces";
import { ErrorText } from "../../src/ui/Text";
import { colors, fonts, radius, space } from "../../src/ui/theme";
import { useWide } from "../../src/ui/useWide";

type Step = { kind: "intro" } | { kind: "capture"; slot: 0 | 1 } | { kind: "review" };

// ADR 0036: the service finds the nose in a photo of the face and crops it.
const tips: { icon: IconName; text: string }[] = [
  { icon: "frame", text: "O rosto de frente, com o focinho no centro" },
  { icon: "sun", text: "Luz natural, sem reflexo de flash" },
  { icon: "phone", text: "Celular a uns 20 cm, bem firme" },
];

/** The camera of the phone shows the live image in the capture step; the web opens the photo chooser of the browser. */
const liveCamera = Platform.OS !== "web";

/**
 * Step 2 of the registration of a dog (RF-11): two photos of the nose, each
 * one checked before the registration (RN-85). The look is the Focinho-Intro,
 * Focinho-Captura and Focinho-Revisao artboards.
 */
export default function NoseprintScreen() {
  const { petId, petName } = useLocalSearchParams<{ petId: string; petName?: string }>();
  const { idToken } = useSession();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>({ kind: "intro" });
  const [shots, setShots] = useState<Shots>([null, null]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState(0);
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  // The browser of a computer gets the Focinho-Web artboard (#272); a tablet keeps the camera flow.
  const webWide = useWide() && Platform.OS === "web";
  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const setShot = (slot: 0 | 1, shot: Shot | null) =>
    setShots((current) => {
      const next: Shots = [current[0], current[1]];
      next[slot] = shot;
      return next;
    });

  async function check(slot: 0 | 1, file: LocalFile) {
    setShot(slot, { uri: file.uri, file, state: "checking" });
    const token = await idToken();
    const result = token === null ? null : await checkNoseprint(apiUrl, token, petId, filePart(file));
    if (result === null) {
      setShot(slot, { uri: file.uri, file, state: "refused", message: SESSION_FAILURE });
    } else if (result.ok) {
      setShot(slot, { uri: file.uri, file, state: "good" });
    } else {
      setShot(slot, { uri: file.uri, file, state: "refused", message: noseprintFailureMessage(result) });
    }
  }

  // The camera is mounted again on each capture step: the shutter waits for it.
  useEffect(() => {
    if (step.kind !== "capture") {
      setCameraReady(false);
    }
  }, [step.kind]);

  // The live camera asks for its permission when the capture step opens.
  useEffect(() => {
    if (liveCamera && step.kind === "capture" && permission !== null && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [step.kind, permission, requestPermission]);

  /** The photo of the live camera. quality 0.9: one compression from the sensor, under the 8 MB of RN-59. */
  async function shoot(): Promise<LocalFile | null> {
    try {
      const picture = await camera.current?.takePictureAsync({ quality: 0.9 });
      return picture ? { uri: picture.uri } : null;
    } catch {
      setError("A câmera não tirou a foto. Tente de novo, ou escolha uma foto da galeria.");
      return null;
    }
  }

  async function capture(slot: 0 | 1, fromGallery: boolean) {
    setError(null);
    const file = fromGallery ? await pickPhoto(NOSE_PHOTO_QUALITY) : liveCamera ? await shoot() : await takePhoto();
    if (file === "denied") {
      setError("O app não tem permissão para usar a câmera. Escolha uma foto da galeria.");
      return;
    }
    if (file === null) {
      return;
    }
    const after: Shots = [shots[0], shots[1]];
    after[slot] = { uri: file.uri, state: "checking" };
    const following = nextSlot(after);
    setStep(following === null ? { kind: "review" } : { kind: "capture", slot: following });
    await check(slot, file);
  }

  async function finish() {
    setBusy(true);
    setError(null);
    const token = await idToken();
    let failure: string | null = token === null ? SESSION_FAILURE : null;
    // A photo registered before a failure is not sent again on the next try.
    let done = registered;
    for (const shot of shots.slice(done)) {
      if (failure !== null || token === null || !shot?.file) {
        break;
      }
      const result = await registerNoseprint(apiUrl, token, petId, filePart(shot.file));
      if (result.ok) {
        done += 1;
      } else {
        failure = noseprintFailureMessage(result);
      }
    }
    setRegistered(done);
    setBusy(false);
    setError(failure);
    if (failure === null) {
      close();
    }
  }

  const page = [local.page, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.lg }];

  if (webWide) {
    return (
      <NoseprintWide
        petName={petName}
        shots={shots}
        busy={busy}
        error={error}
        onPhoto={(slot, file) => void check(slot, file)}
        onRedo={(slot) => {
          setShot(slot, null);
          setRegistered((count) => Math.min(count, slot));
        }}
        onFinish={() => void finish()}
        onBack={close}
        onLater={close}
      />
    );
  }

  if (step.kind === "capture") {
    const slot = step.slot;
    return (
      <View style={[page, local.dark]}>
        <StatusBar style="light" />
        {liveCamera && permission?.granted && <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setCameraReady(true)} />}
        <View style={local.captureTop}>
          <Pressable testID="capture-back" accessibilityRole="button" accessibilityLabel="Voltar" style={local.darkButton} onPress={() => setStep(shots[0] ? { kind: "review" } : { kind: "intro" })}>
            <Icon name="back" size={18} strokeWidth={2.4} color={colors.onDark} />
          </Pressable>
          <Text style={local.captureTitle}>Foto {slot + 1} de 2</Text>
          <Pressable testID="capture-gallery" accessibilityRole="button" accessibilityLabel="Escolher da galeria" style={local.darkButton} onPress={() => void capture(slot, true)}>
            <Icon name="image" size={20} color={colors.onDark} />
          </Pressable>
        </View>
        <View style={local.guideArea}>
          <View style={local.tipPill}>
            <Text style={local.tipPillText}>O rosto de frente, bem de perto</Text>
          </View>
          <View style={local.guide}>
            {(["tl", "tr", "bl", "br"] as const).map((corner) => (
              <View key={corner} style={[local.corner, local[corner]]} />
            ))}
          </View>
        </View>
        <Text style={local.guideText}>
          {liveCamera && permission !== null && !permission.granted
            ? "O app não tem permissão para usar a câmera. Escolha uma foto da galeria, no canto de cima."
            : liveCamera
              ? "Enquadre o rosto e deixe o focinho no centro. O app recorta o focinho."
              : "Toque no botão para tirar a foto do rosto, com o focinho no centro."}
        </Text>
        <View style={local.captureBottom}>
          <View style={{ flexDirection: "row", gap: 10, flex: 1 }}>
            {shots.map((shot, index) => (
              <View key={index} style={[local.slot, index === slot && local.slotCurrent]}>
                {shot ? <Image source={{ uri: shot.uri }} style={local.slotImage} /> : <Text style={[local.slotText, index === slot && { color: colors.brand }]}>{index + 1}</Text>}
              </View>
            ))}
          </View>
          <Pressable
            testID="shutter-button"
            accessibilityRole="button"
            accessibilityLabel="Tirar a foto"
            accessibilityState={{ disabled: liveCamera && !cameraReady }}
            disabled={liveCamera && !cameraReady}
            style={[local.shutter, liveCamera && !cameraReady && { opacity: 0.4 }]}
            onPress={() => void capture(slot, false)}
          >
            <View style={local.shutterInner} />
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>
        {error !== null && <Text style={local.darkError}>{error}</Text>}
      </View>
    );
  }

  if (step.kind === "review") {
    const good = allGood(shots);
    return (
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={page}>
        <StepHeader step={2} steps={2} onClose={close} />
        <View style={{ gap: 6 }}>
          <Text style={local.title} accessibilityRole="header">
            Confira as fotos
          </Text>
          <Text style={local.subtitle}>{good ? "As duas passaram na checagem de qualidade." : "Cada foto passa por uma checagem de qualidade."}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {shots.map((shot, index) => (
            <View key={index} style={{ flex: 1, gap: 10 }}>
              <View style={local.reviewPhoto}>
                {shot && <Image accessibilityLabel={`Foto ${index + 1} do focinho`} source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} />}
                <View style={local.tag}>
                  <Text style={local.tagText}>Foto {index + 1}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View testID={`shot-${index + 1}-state`} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 4 }}>
                  {shot?.state === "good" && <Icon name="check" size={16} strokeWidth={3} color={colors.success} />}
                  <Text style={[local.state, shot?.state === "good" && { color: colors.success }, shot?.state === "refused" && { color: colors.dangerText }]}>
                    {shot === null ? "Sem foto" : shot.state === "refused" ? shot.message : shot.state === "good" ? "Boa" : "Conferindo..."}
                  </Text>
                </View>
                <Pressable
                  testID={`redo-${index + 1}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Refazer a foto ${index + 1}`}
                  style={local.redo}
                  onPress={() => {
                    setShot(index as 0 | 1, null);
                    setRegistered((count) => Math.min(count, index));
                    setStep({ kind: "capture", slot: index as 0 | 1 });
                  }}
                >
                  <Icon name="refresh" size={18} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
        <View style={local.lockCard}>
          <View style={local.lockIcon}>
            <Icon name="lock" size={18} />
          </View>
          <Text style={local.lockText}>Usadas só para identificar {petName ?? "o cachorro"}. Nunca aparecem no mural.</Text>
        </View>
        {error !== null && <ErrorText testID="noseprint-error">{error}</ErrorText>}
        <View style={{ marginTop: "auto", gap: 10 }}>
          <Button testID="finish-noseprint-button" label="Concluir cadastro" busy={busy} disabled={!good} onPress={() => void finish()} />
          <Button
            testID="redo-both-button"
            label="Refazer as duas"
            variant="soft"
            size="md"
            disabled={busy}
            onPress={() => {
              setShots([null, null]);
              setRegistered(0);
              setStep({ kind: "capture", slot: 0 });
            }}
          />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={page}>
      <StepHeader step={2} steps={2} onClose={close} />
      <View style={{ gap: 6 }}>
        <Text style={local.title} accessibilityRole="header">
          Agora, o focinho
        </Text>
        <Text style={local.subtitle}>2 fotos do rosto, de frente e bem de perto. O app recorta o focinho.</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {[true, false].map((ok) => (
          <View key={String(ok)} style={{ flex: 1, gap: 10, alignItems: "center" }}>
            <View style={[local.example, { borderColor: ok ? colors.success : colors.danger }]}>
              <NoseExample good={ok} size={200} />
              <View style={[local.exampleBadge, { backgroundColor: ok ? colors.success : colors.danger }]}>
                <Icon name={ok ? "check" : "close"} size={14} strokeWidth={3} color={colors.onPrimary} />
              </View>
            </View>
            <Text style={[local.exampleText, { color: ok ? colors.success : colors.dangerText }]}>{ok ? "Assim: o rosto de perto" : "Não: de longe"}</Text>
          </View>
        ))}
      </View>
      <View style={{ gap: 12 }}>
        {tips.map((tip) => (
          <View key={tip.icon} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={local.tipIcon}>
              <Icon name={tip.icon} size={20} />
            </View>
            <Text style={local.tipText}>{tip.text}</Text>
          </View>
        ))}
      </View>
      <View style={{ marginTop: "auto", gap: 10 }}>
        <Button testID="open-camera-button" label="Abrir câmera" icon="camera" onPress={() => setStep({ kind: "capture", slot: nextSlot(shots) ?? 0 })} />
        <Button testID="later-button" label="Fazer depois" variant="soft" size="md" onPress={close} />
      </View>
    </ScrollView>
  );
}

const cornerSize = 34;
const local = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: space.xl, gap: space.xl },
  dark: { flex: 1, backgroundColor: "#0E0D0F" },
  title: { fontFamily: fonts.title, fontSize: 30, color: colors.ink, letterSpacing: -0.6 },
  subtitle: { fontFamily: fonts.body, fontSize: 16, color: colors.textSecondary },
  example: { width: "100%", aspectRatio: 1, borderRadius: radius.card, borderWidth: 3, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  exampleBadge: { position: "absolute", top: 10, right: 10, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  exampleText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  tipIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  tipText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  captureTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  captureTitle: { fontFamily: fonts.titleBold, fontSize: 20, color: colors.onDark },
  darkButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#2A282C", alignItems: "center", justifyContent: "center" },
  guideArea: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18 },
  tipPill: { borderRadius: radius.pill, backgroundColor: "#2A282C", paddingHorizontal: 14, paddingVertical: 8 },
  tipPillText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.onDark },
  guide: { width: 270, height: 270, borderRadius: 28, borderWidth: 2, borderColor: "rgba(255,255,255,0.85)" },
  corner: { position: "absolute", width: cornerSize, height: cornerSize, borderColor: colors.onDark },
  tl: { top: -12, left: -12, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  tr: { top: -12, right: -12, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  bl: { bottom: -12, left: -12, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  br: { bottom: -12, right: -12, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },
  guideText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.onDarkMuted, textAlign: "center" },
  captureBottom: { flexDirection: "row", alignItems: "center" },
  slot: { width: 50, height: 50, borderRadius: 12, borderWidth: 2, borderStyle: "dashed", borderColor: "#55525A", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  slotCurrent: { borderColor: colors.brand },
  slotImage: { width: 50, height: 50 },
  slotText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onDarkMuted },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: colors.onDark, alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: "rgba(255,255,255,0.12)" },
  darkError: { fontFamily: fonts.bodySemibold, fontSize: 14, color: "#FFB4A8", textAlign: "center" },
  reviewPhoto: { width: "100%", aspectRatio: 1, borderRadius: radius.card, backgroundColor: colors.surface, overflow: "hidden" },
  tag: { position: "absolute", top: 10, left: 10, borderRadius: radius.pill, backgroundColor: "rgba(24,22,26,0.75)", paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.onDark },
  state: { flexShrink: 1, fontFamily: fonts.bodyBold, fontSize: 14, color: colors.textMuted },
  redo: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  lockCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: radius.card, backgroundColor: colors.surface, padding: space.lg },
  lockIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  lockText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },
});
