import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { listBoard, type Report } from "../src/api/reports";
import { apiUrl } from "../src/config";
import { timeAgo } from "../src/reports/board";
import { Button } from "../src/ui/Button";
import { Icon, LogoMark, Mascot, type IconName } from "../src/ui/Icon";
import { colors, landingFonts, radius, space } from "../src/ui/theme";
import { useWide } from "../src/ui/useWide";

const create: Href = { pathname: "/sign-in", params: { mode: "create" } };

const steps = [
  { n: "1", title: "Cadastre o focinho", text: "Duas fotos bem de perto, pela câmera do celular ou enviando fotos que você já tem. O focinho vira a identidade do seu cachorro.", tags: ["2 fotos", "Pelo celular ou computador"], background: colors.brand, color: colors.ink },
  { n: "2", title: "Cuide da saúde", text: "Vacinas, antipulgas, consultas e peso num histórico só, com lembretes e uma carteirinha digital para mandar ao veterinário.", tags: ["Lembretes", "Carteirinha com QR"], background: colors.accent, color: colors.onPrimary },
  { n: "3", title: "Reencontre", text: "Se ele sumir, avisamos quem está perto. Quem encontrar escaneia o focinho e você recebe o aviso na hora.", tags: ["Alerta no bairro", "Mural aberto"], background: colors.surface, color: colors.ink },
];

const health: { icon: IconName; color: string; title: string; text: string }[] = [
  { icon: "syringe", color: colors.accent, title: "Vacinas e remédios", text: "V10, antirrábica, antipulgas e vermífugo, com a próxima dose calculada para você." },
  { icon: "bell", color: colors.primary, title: "Lembrete antes de cada dose", text: "Um aviso alguns dias antes, e outro se passar da data." },
  { icon: "weight", color: colors.dark, title: "Peso e consultas", text: "Gráfico do peso ao longo dos meses e o histórico de consultas e exames, com os laudos." },
  { icon: "card", color: colors.success, title: "Carteirinha digital", text: "Mande para o veterinário, o hotel ou a creche por link ou QR code, e revogue quando quiser." },
];

const promises: { icon: IconName; title: string; text: string }[] = [
  { icon: "eye", title: "O focinho nunca vai para o mural", text: "As fotos do focinho servem só para identificar. No mural aparece o retrato do cachorro." },
  { icon: "lock", title: "Seu contato fica com você", text: "Quem encontra não vê seu telefone nem e-mail. Você decide quando falar." },
  { icon: "phone", title: "Sem instalar nada", text: "Funciona no navegador. Se quiser, adicione à tela inicial do celular." },
];

/** The landing page of the public web (Landing-Web artboard, #231): what Nupii does, for a visitor. */
export default function Landing() {
  const wide = useWide();
  const [reports, setReports] = useState<Report[]>([]);
  useEffect(() => {
    void listBoard(apiUrl, 1).then((result) => result.ok && setReports(result.value.reports.slice(0, 4)));
  }, []);
  const row = wide ? local.row : local.column;

  return (
    <ScrollView contentContainerStyle={[local.page, !wide && { paddingHorizontal: space.xl, gap: 48 }]}>
      {/* On a wide screen the header of the web frame has these links. */}
      {!wide && (
        <View style={[local.row, { alignItems: "center", gap: 8, paddingTop: space.lg }]}>
          <LogoMark size={28} />
          <Text style={[local.footerBrand, { flex: 1, fontSize: 24 }]}>nupii</Text>
          <Button labelFont={landingFonts.bodyBold} testID="landing-sign-in" label="Entrar" variant="outline" size="sm" stretch={false} onPress={() => router.push("/sign-in")} />
        </View>
      )}
      <View style={[row, { alignItems: "center", paddingVertical: wide ? 48 : 24 }]}>
        <View style={{ flex: 1.1, gap: 20 }}>
          <Text style={[local.hero, !wide && { fontSize: 48, lineHeight: 50, letterSpacing: -1.6 }]} accessibilityRole="header">
            Todo focinho{"\n"}é único.
          </Text>
          <Text style={local.lead}>O focinho funciona como uma digital. Cadastre o do seu cachorro, cuide da saúde dele num só lugar e, se ele sumir, o bairro fica sabendo na hora.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <Button labelFont={landingFonts.bodyBold} testID="landing-create" label="Cadastrar meu cachorro" trailingIcon="arrowRight" stretch={false} onPress={() => router.push(create)} />
            <Button labelFont={landingFonts.bodyBold} testID="landing-found" label="Achei um cachorro" icon="scan" variant="outline" stretch={false} onPress={() => router.push("/found")} />
          </View>
        </View>
        <View style={{ flex: 1, alignItems: "center" }}>
          <View style={[local.art, { width: wide ? 460 : 320, height: wide ? 460 : 320 }]}>
            <View style={[local.circle, { width: wide ? 380 : 260, height: wide ? 380 : 260, borderRadius: wide ? 190 : 130 }]}>
              <Mascot width={wide ? 250 : 170} />
            </View>
            <View style={[local.float, { top: 40, left: 0 }]}>
              <View style={[local.floatIcon, { backgroundColor: colors.danger }]}>
                <Icon name="pin" size={14} color={colors.onPrimary} />
              </View>
              <View>
                <Text style={local.floatTitle}>Thor sumiu aqui</Text>
                <Text style={local.floatText}>há 40 min · 1,2 km</Text>
              </View>
            </View>
            <View style={[local.float, { top: wide ? 230 : 150, right: 0 }]}>
              <View style={[local.floatIcon, { backgroundColor: colors.dark }]}>
                <Icon name="scan" size={14} color={colors.onPrimary} />
              </View>
              <View>
                <Text style={local.floatTitle}>Focinho cadastrado</Text>
                <Text style={local.floatText}>2 fotos de perto</Text>
              </View>
            </View>
            <View style={[local.float, { bottom: 30, left: 20 }]}>
              <View style={[local.floatIcon, { backgroundColor: colors.success }]}>
                <Icon name="check" size={14} color={colors.onPrimary} strokeWidth={3} />
              </View>
              <View>
                <Text style={local.floatTitle}>Tutor avisado</Text>
                <Text style={local.floatText}>agora mesmo</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={{ gap: 20 }}>
        <View style={[local.row, { alignItems: "flex-end", justifyContent: "space-between" }]}>
          <Text style={local.h2}>Como funciona</Text>
          <Text style={local.muted}>Três coisas, um app só.</Text>
        </View>
        <View style={[row, { alignItems: "stretch" }]}>
          {steps.map((step) => (
            <View key={step.n} style={[local.step, { backgroundColor: step.background }]}>
              <View style={[local.stepNumber, { backgroundColor: step.color === colors.ink ? colors.dark : colors.background }]}>
                <Text style={[local.stepNumberText, { color: step.color === colors.ink ? colors.onDark : colors.accent }]}>{step.n}</Text>
              </View>
              <Text style={[local.stepTitle, { color: step.color }]}>{step.title}</Text>
              <Text style={[local.stepText, { color: step.color }]}>{step.text}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: "auto" }}>
                {step.tags.map((tag) => (
                  <View key={tag} style={local.tag}>
                    <Text style={[local.tagText, { color: step.color }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={[row, { alignItems: "center" }]}>
        <View style={{ flex: 1, gap: 16 }}>
          <Text style={local.overline}>SAÚDE</Text>
          <Text style={local.h2}>A saúde do seu cachorro em dia, sem depender da memória.</Text>
          <Text style={local.lead}>Tudo o que hoje fica espalhado entre a carteirinha de papel, fotos no celular e a cabeça do tutor, num histórico só.</Text>
          {health.map((item) => (
            <View key={item.title} style={{ flexDirection: "row", gap: 12 }}>
              <View style={[local.featureIcon, { backgroundColor: item.color }]}>
                <Icon name={item.icon} size={18} color={colors.onPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={local.featureTitle}>{item.title}</Text>
                <Text style={local.muted}>{item.text}</Text>
              </View>
            </View>
          ))}
          <Button labelFont={landingFonts.bodyBold} label="Começar o histórico" variant="dark" trailingIcon="arrowRight" stretch={false} onPress={() => router.push(create)} />
        </View>
        <View style={[local.demo, { flex: 1 }]} accessibilityLabel="Exemplo da tela de saúde">
          <Text style={local.featureTitle}>Saúde do seu cachorro</Text>
          <View style={local.demoOk}>
            <View style={[local.featureIcon, { backgroundColor: colors.success }]}>
              <Icon name="check" size={16} color={colors.onPrimary} strokeWidth={3} />
            </View>
            <View>
              <Text style={[local.featureTitle, { color: colors.onDark }]}>Tudo em dia</Text>
              <Text style={[local.muted, { color: colors.onDarkMuted }]}>próximo: vermífugo · em 5 dias</Text>
            </View>
          </View>
          {[
            ["V10 · reforço anual", "mar/27"],
            ["Antirrábica", "mar/27"],
            ["Vermífugo", "Em 5 dias"],
          ].map(([name, when]) => (
            <View key={name} style={local.demoRow}>
              <Icon name="syringe" size={18} />
              <Text style={[local.featureTitle, { flex: 1 }]}>{name}</Text>
              <Text style={local.muted}>{when}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[local.band, row, { alignItems: "center" }]}>
        <View style={{ flex: 1, gap: 14 }}>
          <Text style={[local.h2, { color: colors.onDark }]}>Encontrou um cachorro?</Text>
          <Text style={[local.lead, { color: colors.onDarkMuted }]}>Escaneie o focinho com a câmera. Se ele tiver cadastro, o tutor recebe o aviso na hora. Seu contato só vai para o tutor do cão que você escolher.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <Pressable accessibilityRole="button" style={local.bandPrimary} onPress={() => router.push("/found")}>
              <Icon name="scan" size={18} />
              <Text style={local.featureTitle}>Escanear um focinho</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={local.bandSecondary} onPress={() => router.push("/reports")}>
              <Text style={[local.featureTitle, { color: colors.onDark }]}>Ver perdidos no mural</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ flex: 1, gap: 10 }}>
          {[
            ["1", "Aponte a câmera para o focinho", "bem de perto, dentro do quadrado"],
            ["2", "Veja os cachorros parecidos", "com a foto de cada um, sem dados do tutor"],
            ["3", "Avise o tutor", "ele recebe o seu contato na hora"],
          ].map(([n, title, text]) => (
            <View key={n} style={local.bandStep}>
              <View style={local.bandNumber}>
                <Text style={local.stepNumberText}>{n}</Text>
              </View>
              <View>
                <Text style={[local.featureTitle, { color: colors.onDark }]}>{title}</Text>
                <Text style={[local.muted, { color: colors.onDarkMuted }]}>{text}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: 20 }}>
        <View style={[local.row, { alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap" }]}>
          <View style={{ gap: 4 }}>
            <Text style={local.h2}>Perdidos perto de você</Text>
            <Text style={local.muted}>O mural é aberto, sem precisar de conta</Text>
          </View>
          <Button labelFont={landingFonts.bodyBold} label="Ver mural completo" variant="dark" size="sm" trailingIcon="arrowRight" stretch={false} onPress={() => router.push("/reports")} />
        </View>
        <View style={[local.row, { flexWrap: "wrap" }]}>
          {reports.length === 0 && <Text style={local.muted}>Nenhuma ocorrência aberta no mural agora.</Text>}
          {reports.map((report) => (
            <Pressable key={report.id} accessibilityRole="link" style={[local.post, !wide && { width: "100%" }]} onPress={() => router.push({ pathname: "/reports/[id]", params: { id: report.id } })}>
              <View style={[local.postPhoto, { backgroundColor: report.type === "lost" ? colors.brand : colors.accent }]}>{report.photoUrl ? <Image source={{ uri: report.photoUrl }} style={StyleSheet.absoluteFill} /> : <Icon name="pin" size={28} color={colors.onPrimary} />}</View>
              <View style={[local.postTag, { backgroundColor: report.type === "lost" ? colors.danger : colors.success }]}>
                <Text style={local.postTagText}>{report.type === "lost" ? "Perdido" : "Achado"}</Text>
              </View>
              <Text style={local.featureTitle} numberOfLines={1}>
                {report.type === "lost" ? (report.petName ?? "Pet perdido") : "Cachorro achado"}
              </Text>
              <Text style={local.muted}>{timeAgo(report.createdAt)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[row, { alignItems: "stretch" }]}>
        {promises.map((item) => (
          <View key={item.title} style={local.promise}>
            <Icon name={item.icon} size={20} color={colors.accent} />
            <Text style={local.featureTitle}>{item.title}</Text>
            <Text style={local.muted}>{item.text}</Text>
          </View>
        ))}
      </View>

      <View style={[local.cta, row, { alignItems: "center" }]}>
        <Text style={[local.h2, { color: colors.onPrimary, flex: 1 }]}>Cadastre o focinho hoje. Leva dois minutos.</Text>
        <Pressable accessibilityRole="button" style={local.ctaButton} onPress={() => router.push(create)}>
          <Text style={local.featureTitle}>Criar conta</Text>
          <Icon name="arrowRight" size={18} />
        </Pressable>
      </View>

      <View style={[local.row, { alignItems: "center", flexWrap: "wrap", paddingBottom: 32 }]}>
        <LogoMark size={24} />
        <Text style={local.footerBrand}>nupii</Text>
        <Text style={local.muted}>© 2026</Text>
        <View style={{ flex: 1 }} />
        <Pressable accessibilityRole="link" style={local.footerLink} onPress={() => router.push("/terms")}>
          <Text style={local.footerLinkText}>Termos de uso e privacidade</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const local = StyleSheet.create({
  page: { width: "100%", maxWidth: 1280, alignSelf: "center", paddingHorizontal: 48, gap: 72, backgroundColor: colors.background },
  row: { flexDirection: "row", gap: 24 },
  column: { flexDirection: "column", gap: 24 },
  hero: { fontFamily: landingFonts.title, fontSize: 84, lineHeight: 84, letterSpacing: -3, color: colors.ink },
  lead: { fontFamily: landingFonts.body, fontSize: 18, lineHeight: 27, color: colors.textSecondary },
  art: { position: "relative", alignItems: "center", justifyContent: "center" },
  circle: { backgroundColor: colors.brand, alignItems: "center", justifyContent: "flex-end", overflow: "hidden" },
  float: { position: "absolute", flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.background, shadowColor: colors.ink, shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  floatIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  floatTitle: { fontFamily: landingFonts.bodyBold, fontSize: 13, color: colors.ink },
  floatText: { fontFamily: landingFonts.body, fontSize: 12, color: colors.textMuted },
  h2: { fontFamily: landingFonts.title, fontSize: 36, letterSpacing: -1, color: colors.ink },
  muted: { fontFamily: landingFonts.body, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  overline: { fontFamily: landingFonts.bodyBold, fontSize: 13, letterSpacing: 0.8, color: colors.accent },
  step: { flex: 1, minHeight: 280, gap: 14, padding: 24, borderRadius: radius.cardLarge },
  stepNumber: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  stepNumberText: { fontFamily: landingFonts.title, fontSize: 17, color: colors.onPrimary },
  stepTitle: { fontFamily: landingFonts.title, fontSize: 26, letterSpacing: -0.6 },
  stepText: { fontFamily: landingFonts.body, fontSize: 15, lineHeight: 22 },
  tag: { minHeight: 30, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.35)", justifyContent: "center" },
  tagText: { fontFamily: landingFonts.bodyBold, fontSize: 13 },
  featureIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  featureTitle: { fontFamily: landingFonts.bodyBold, fontSize: 15, color: colors.ink },
  demo: { gap: 12, padding: 20, borderRadius: radius.cardLarge, backgroundColor: colors.surface },
  demoOk: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.dark },
  demoRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.background },
  band: { padding: 36, borderRadius: radius.cardLarge, backgroundColor: colors.dark },
  bandPrimary: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 18, borderRadius: radius.pill, backgroundColor: colors.background },
  bandSecondary: { minHeight: 48, paddingHorizontal: 18, borderRadius: radius.pill, borderWidth: 1.5, borderColor: "#4A474E", justifyContent: "center" },
  bandStep: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, backgroundColor: "#2A282C" },
  bandNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  post: { width: "23%", flexGrow: 1, gap: 8, padding: 10, borderRadius: 22, borderWidth: 1.5, borderColor: colors.border },
  postPhoto: { height: 160, borderRadius: 16, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  postTag: { alignSelf: "flex-start", minHeight: 24, paddingHorizontal: 8, borderRadius: radius.pill, justifyContent: "center" },
  postTagText: { fontFamily: landingFonts.bodyBold, fontSize: 12, color: colors.onPrimary },
  promise: { flex: 1, gap: 8, padding: 20, borderRadius: 22, borderWidth: 1.5, borderColor: colors.border },
  cta: { padding: 36, borderRadius: radius.cardLarge, backgroundColor: colors.brand },
  ctaButton: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 52, paddingHorizontal: 22, borderRadius: radius.pill, backgroundColor: colors.background },
  footerBrand: { fontFamily: landingFonts.title, fontSize: 20, color: colors.ink },
  footerLink: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.surface, justifyContent: "center" },
  footerLinkText: { fontFamily: landingFonts.bodyBold, fontSize: 13, color: colors.ink },
});
