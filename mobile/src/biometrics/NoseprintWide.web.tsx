import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { LocalFile } from "../api/pets";
import { Button } from "../ui/Button";
import { Icon, NoseExample } from "../ui/Icon";
import { ErrorText } from "../ui/Text";
import { colors, fonts, radius } from "../ui/theme";
import { MIN_CROP_SIDE, moveSquare, outputSide, resizeSquare, sourceRect, viewOf, type Corner, type Size, type Square } from "./crop";
import { allGood, nextSlot, type Shots } from "./shots";

export type NoseprintWideProps = {
  petName?: string;
  shots: Shots;
  busy: boolean;
  error: string | null;
  /** A photo for a slot: the screen checks it (RN-85). */
  onPhoto: (slot: 0 | 1, file: LocalFile) => void;
  /** Clears a slot to take its photo again. */
  onRedo: (slot: 0 | 1) => void;
  onFinish: () => void;
  onBack: () => void;
  onLater: () => void;
};

type Stage = { kind: "send" } | { kind: "webcam" } | { kind: "crop"; url: string; image: Size };

const STAGE_HEIGHT = 340;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const isHeic = (file: File) => /image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name);

const rules = ["O rosto de frente, com o focinho nítido, sem reflexo de flash", `O recorte do rosto precisa ter pelo menos ${MIN_CROP_SIDE} px`, "JPG, PNG ou WebP (HEIC só no Safari)"];

/**
 * The noseprint step on the browser of a computer (Focinho-Web artboard, #272,
 * ADR 0034): the two photos on the left; on the right, a photo from the
 * computer or the webcam, then a square crop. The crop goes as a PNG, pixel
 * for pixel up to 1280 px, so the photo of the nose has no new compression.
 */
export function NoseprintWide({ petName, shots, busy, error, onPhoto, onRedo, onFinish, onBack, onLater }: NoseprintWideProps) {
  const [stage, setStage] = useState<Stage>({ kind: "send" });
  const [redo, setRedo] = useState<0 | 1 | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const slot = redo ?? nextSlot(shots);
  const done = allGood(shots);
  const refused = shots.some((shot) => shot?.state === "refused");

  async function useFile(file: File) {
    setProblem(null);
    if (!isHeic(file) && !ACCEPTED.includes(file.type)) {
      setProblem("Use uma foto JPG, PNG ou WebP.");
      return;
    }
    // #270: no converter of HEIC (it needs eval, which the CSP refuses). The
    // browser opens the photo itself: Safari opens HEIC, the others do not.
    const url = URL.createObjectURL(file);
    const element = new window.Image();
    element.onload = () => setStage({ kind: "crop", url, image: { width: element.naturalWidth, height: element.naturalHeight } });
    element.onerror = () =>
      setProblem(
        isHeic(file)
          ? "Este navegador não abre fotos HEIC. Envie a foto em JPG ou PNG, ou use o Safari."
          : "Não foi possível abrir esta foto.",
      );
    element.src = url;
  }

  function useCrop(file: File) {
    if (slot === null) {
      return;
    }
    onPhoto(slot, { uri: URL.createObjectURL(file), file, name: file.name });
    setRedo(null);
    setStage({ kind: "send" });
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={local.page}>
      <View style={local.column}>
        <View style={local.head}>
          <Pressable testID="noseprint-back" accessibilityRole="button" accessibilityLabel="Voltar" style={local.round} onPress={onBack}>
            <Icon name="back" size={18} strokeWidth={2.4} />
          </Pressable>
          <View style={local.progress} accessibilityLabel="Passo 2 de 2">
            <View style={[local.bar, { backgroundColor: colors.brand }]} />
            <View style={[local.bar, { backgroundColor: colors.brand }]} />
          </View>
          <Text style={local.step}>2 de 2 · Focinho</Text>
        </View>
        <View style={{ gap: 4 }}>
          <Text style={local.title} accessibilityRole="header">
            Agora, o focinho
          </Text>
          <Text style={local.lead}>2 fotos do rosto, de frente e bem de perto. O app recorta o focinho. Use fotos que você já tem ou a câmera.</Text>
        </View>

        <View style={local.columns}>
          <View style={local.left}>
            {shots.map((shot, index) => (
              <View key={index} testID={`slot-${index + 1}`} style={[local.slot, slot === index && local.slotCurrent]}>
                <View style={local.thumb}>{shot ? <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} /> : <Text style={local.thumbText}>{index + 1}</Text>}</View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={local.slotTitle}>Foto {index + 1}</Text>
                  <Text testID={`slot-${index + 1}-state`} style={[local.slotState, shot?.state === "good" && { color: colors.success }, shot?.state === "refused" && { color: colors.dangerText }]}>
                    {shot === null ? (slot === index ? "Agora" : "Falta") : shot.state === "refused" ? shot.message : shot.state === "good" ? "Focinho achado, foto nítida" : "Conferindo..."}
                  </Text>
                </View>
                {shot !== null && (
                  <Pressable
                    testID={`redo-${index + 1}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Trocar a foto ${index + 1}`}
                    style={local.round}
                    onPress={() => {
                      onRedo(index as 0 | 1);
                      setRedo(index as 0 | 1);
                      setStage({ kind: "send" });
                    }}
                  >
                    <Icon name="refresh" size={18} />
                  </Pressable>
                )}
              </View>
            ))}
            <View style={{ flexDirection: "row", gap: 12 }}>
              {[true, false].map((ok) => (
                <View key={String(ok)} style={{ flex: 1, gap: 8, alignItems: "center" }}>
                  <View style={[local.example, { borderColor: ok ? colors.success : colors.danger }]}>
                    <NoseExample good={ok} size={180} />
                  </View>
                  <Text style={[local.exampleText, { color: ok ? colors.success : colors.dangerText }]}>{ok ? "Assim: o rosto de perto" : "Não: de longe"}</Text>
                </View>
              ))}
            </View>
            <View style={{ gap: 8 }}>
              {rules.map((rule) => (
                <View key={rule} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={local.dot} />
                  <Text style={local.rule}>{rule}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={local.right}>
            {slot === null ? (
              <View style={local.ready}>
                <Text style={local.readyTitle}>{done ? "Tudo certo com as 2 fotos" : refused ? "Troque a foto que não passou" : "Conferindo as fotos..."}</Text>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  {shots.map((shot, index) => shot && <Image key={index} accessibilityLabel={`Recorte ${index + 1} do rosto`} source={{ uri: shot.uri }} style={local.readyImage} />)}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Icon name="lock" size={18} color={colors.textMuted} />
                  <Text style={local.rule}>Usadas só para identificar {petName ?? "o cachorro"}. Nunca aparecem no mural.</Text>
                </View>
              </View>
            ) : stage.kind === "crop" ? (
              <Cropper key={stage.url} url={stage.url} image={stage.image} slot={slot} onUse={useCrop} onCancel={() => setStage({ kind: "send" })} />
            ) : stage.kind === "webcam" ? (
              <Webcam onPhoto={(file) => void useFile(file)} onCancel={() => setStage({ kind: "send" })} onDenied={() => {
                setProblem("O navegador não liberou a câmera. Escolha uma foto do computador.");
                setStage({ kind: "send" });
              }} />
            ) : (
              <div
                data-testid="nose-drop"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const file = event.dataTransfer.files[0];
                  if (file) {
                    void useFile(file);
                  }
                }}
                style={dropStyle}
              >
                <View style={local.dropIcon}>
                  <Icon name="upload" size={28} color={colors.brand} strokeWidth={2} />
                </View>
                <Text style={local.readyTitle}>Arraste fotos do rosto aqui</Text>
                <Text style={[local.rule, { textAlign: "center" }]}>Pode ser uma foto antiga, com o rosto de frente. Depois você ajusta o quadrado em volta do rosto.</Text>
                <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                  <Button testID="nose-choose" label="Escolher do computador" icon="image" variant="dark" size="md" stretch={false} onPress={() => fileInput.current?.click()} />
                  <Button testID="nose-webcam" label="Usar a webcam" icon="camera" variant="outline" size="md" stretch={false} onPress={() => setStage({ kind: "webcam" })} />
                </View>
                <input
                  ref={fileInput}
                  data-testid="nose-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) {
                      void useFile(file);
                    }
                  }}
                />
              </div>
            )}
            {problem !== null && <ErrorText testID="nose-problem">{problem}</ErrorText>}
          </View>
        </View>

        {error !== null && <ErrorText testID="noseprint-error">{error}</ErrorText>}
        <View style={local.footer}>
          <Button testID="later-button" label="Fazer depois" variant="soft" size="md" stretch={false} onPress={onLater} />
          <Button testID="finish-noseprint-button" label="Concluir cadastro" variant="dark" size="md" stretch={false} busy={busy} disabled={!done} onPress={onFinish} />
        </View>
      </View>
    </ScrollView>
  );
}

/** The square crop on the photo: drag it, resize it from a corner, zoom the photo. */
function Cropper({ url, image, slot, onUse, onCancel }: { url: string; image: Size; slot: 0 | 1; onUse: (file: File) => void; onCancel: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const picture = useRef<HTMLImageElement>(null);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [square, setSquare] = useState<Square | null>(null);
  const drag = useRef<{ mode: "move" | Corner; x: number; y: number; start: Square } | null>(null);
  const stage = { width, height: STAGE_HEIGHT };

  useEffect(() => {
    const measure = () => setWidth(box.current?.clientWidth ?? 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  useEffect(() => {
    if (width > 0 && square === null) {
      // The face fills most of a good photo (ADR 0036).
      const size = Math.round(Math.min(width, STAGE_HEIGHT) * 0.9);
      setSquare({ x: Math.round((width - size) / 2), y: Math.round((STAGE_HEIGHT - size) / 2), size });
    }
  }, [width, square]);
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const current = drag.current;
      if (current === null) {
        return;
      }
      const dx = event.clientX - current.x;
      const dy = event.clientY - current.y;
      const area = { width: box.current?.clientWidth ?? 0, height: STAGE_HEIGHT };
      setSquare(current.mode === "move" ? moveSquare(current.start, dx, dy, area) : resizeSquare(current.start, current.mode, dx, dy, area));
    };
    const up = () => {
      drag.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const begin = (mode: "move" | Corner) => (event: ReactPointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (square !== null) {
      drag.current = { mode, x: event.clientX, y: event.clientY, start: square };
    }
  };

  const view = viewOf(stage, image, zoom);
  const rect = square && width > 0 ? sourceRect(square, view, image) : null;
  const sharpEnough = rect !== null && rect.side >= MIN_CROP_SIDE;

  function use() {
    const element = picture.current;
    if (rect === null || element === null || !sharpEnough) {
      return;
    }
    const side = outputSide(rect.side);
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    canvas.getContext("2d")?.drawImage(element, rect.x, rect.y, rect.side, rect.side, 0, 0, side, side);
    // PNG: no new compression of the photo of the nose (ADR 0034).
    canvas.toBlob((blob) => blob && onUse(new File([blob], `focinho-${slot + 1}.png`, { type: "image/png" })), "image/png");
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <Text style={local.cropTitle}>Recorte o rosto · Foto {slot + 1}</Text>
        <Text style={local.rule}>Deixe o rosto inteiro dentro do quadrado</Text>
      </View>
      <div ref={box} data-testid="nose-stage" style={{ position: "relative", height: STAGE_HEIGHT, borderRadius: 24, background: "#111", overflow: "hidden", touchAction: "none" }}>
        <img ref={picture} src={url} alt="Foto enviada do cachorro" draggable={false} style={{ position: "absolute", left: view.left, top: view.top, width: image.width * view.scale, height: image.height * view.scale, userSelect: "none" }} />
        {square && rect && (
          <div data-testid="nose-square" onPointerDown={begin("move")} style={{ position: "absolute", left: square.x, top: square.y, width: square.size, height: square.size, border: `3px solid ${sharpEnough ? "#3DD07A" : colors.danger}`, boxSizing: "border-box", cursor: "move", boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)" }}>
            <span style={{ position: "absolute", top: -30, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", padding: "3px 10px", borderRadius: 12, background: sharpEnough ? colors.success : colors.danger, color: "#fff", fontFamily: fonts.bodyBold, fontSize: 12 }}>
              {rect.side} × {rect.side} px
            </span>
            {(["tl", "tr", "bl", "br"] as const).map((corner) => (
              <span key={corner} data-testid={`nose-corner-${corner}`} onPointerDown={begin(corner)} style={handleStyle(corner)} />
            ))}
          </div>
        )}
      </div>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink }}>
          Zoom
          <input data-testid="nose-zoom" type="range" min={1} max={4} step={0.1} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} style={{ width: 180, accentColor: colors.brand }} />
        </label>
        <View style={[local.chip, { backgroundColor: sharpEnough ? "#E7F3EB" : colors.dangerSoft }]}>
          <Text style={[local.chipText, { color: sharpEnough ? colors.success : colors.dangerText }]}>{sharpEnough ? "Resolução ok" : `Mínimo de ${MIN_CROP_SIDE} px: aumente o quadrado ou diminua o zoom`}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <Button testID="nose-other" label="Escolher outra foto" variant="soft" size="md" stretch={false} onPress={onCancel} />
        <Button testID="nose-use-crop" label="Usar este recorte" variant="dark" size="md" stretch={false} disabled={!sharpEnough} onPress={use} />
      </View>
    </View>
  );
}

/** The webcam of the computer: a frame of it goes to the crop. */
function Webcam({ onPhoto, onCancel, onDenied }: { onPhoto: (file: File) => void; onCancel: () => void; onDenied: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const stop = useCallback(() => stream.current?.getTracks().forEach((track) => track.stop()), []);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((media) => {
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = media;
        if (video.current) {
          video.current.srcObject = media;
          void video.current.play();
        }
      })
      .catch(onDenied);
    return () => {
      cancelled = true;
      stop();
    };
  }, [onDenied, stop]);

  function shoot() {
    const element = video.current;
    if (!element || element.videoWidth === 0) {
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    canvas.getContext("2d")?.drawImage(element, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        stop();
        onPhoto(new File([blob], "webcam.png", { type: "image/png" }));
      }
    }, "image/png");
  }

  return (
    <View style={{ gap: 12 }}>
      <video ref={video} data-testid="nose-video" muted playsInline style={{ width: "100%", height: STAGE_HEIGHT, objectFit: "cover", borderRadius: 24, background: "#111" }} />
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
        <Button testID="nose-webcam-cancel" label="Cancelar" variant="soft" size="md" stretch={false} onPress={() => {
          stop();
          onCancel();
        }} />
        <Button testID="nose-webcam-shoot" label="Tirar foto" icon="camera" variant="dark" size="md" stretch={false} onPress={shoot} />
      </View>
    </View>
  );
}

const dropStyle: CSSProperties = {
  minHeight: STAGE_HEIGHT,
  borderRadius: 28,
  border: `2px dashed ${colors.borderDashed}`,
  background: colors.surface,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 14,
  padding: 28,
  boxSizing: "border-box",
};

function handleStyle(corner: Corner): CSSProperties {
  return {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    background: "#fff",
    border: "3px solid #3DD07A",
    boxSizing: "border-box",
    top: corner[0] === "t" ? -10 : undefined,
    bottom: corner[0] === "b" ? -10 : undefined,
    left: corner[1] === "l" ? -10 : undefined,
    right: corner[1] === "r" ? -10 : undefined,
    cursor: corner === "tl" || corner === "br" ? "nwse-resize" : "nesw-resize",
  };
}

const local = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 48, paddingTop: 32, paddingBottom: 48 },
  column: { width: "100%", maxWidth: 1080, alignSelf: "center", gap: 24 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  progress: { flexGrow: 1, maxWidth: 360, flexDirection: "row", gap: 8 },
  bar: { flex: 1, height: 6, borderRadius: 3 },
  step: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.textMuted },
  title: { fontFamily: fonts.title, fontSize: 36, letterSpacing: -1, color: colors.ink },
  lead: { fontFamily: fonts.body, fontSize: 16, color: colors.textSecondary },
  columns: { flexDirection: "row", flexWrap: "wrap", gap: 28, alignItems: "flex-start" },
  left: { flexGrow: 1, flexBasis: 320, maxWidth: 400, gap: 16 },
  right: { flexGrow: 2, flexBasis: 480, minWidth: 0, gap: 12 },
  slot: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: radius.card, borderWidth: 2, borderColor: colors.border },
  slotCurrent: { borderColor: colors.ink },
  thumb: { width: 60, height: 60, borderRadius: 14, backgroundColor: colors.surface, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  thumbText: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.textMuted },
  slotTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  slotState: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.textMuted },
  example: { width: "100%", aspectRatio: 1, borderRadius: radius.card, borderWidth: 3, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  exampleText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brand },
  rule: { flexShrink: 1, fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },
  dropIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  readyTitle: { fontFamily: fonts.titleBold, fontSize: 20, color: colors.ink, textAlign: "center" },
  ready: { gap: 16, padding: 24, borderRadius: 28, backgroundColor: colors.surface, alignItems: "flex-start" },
  readyImage: { width: 140, height: 140, borderRadius: 18 },
  cropTitle: { fontFamily: fonts.titleBold, fontSize: 20, color: colors.ink },
  chip: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  footer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 12, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.border },
});
