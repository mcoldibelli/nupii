import { Image, StyleSheet, Text, View } from "react-native";

import type { HealthCard } from "../api/cards";
import { dateText } from "../health/form";
import { Icon, LogoMark } from "../ui/Icon";
import { colors, fonts, radius, space } from "../ui/theme";
import { medicationRows, vaccineRows, type VaccineRow } from "./card";
import { QrCode } from "./QrCode";
import { sexLabels, speciesLabels } from "../pets/labels";

/** "Shih Tzu · fêmea · castrada": the breed (or species), the sex and the castration of the card. */
function subtitle(pet: HealthCard["pet"]): string {
  const female = pet.sex === "female";
  const parts = [pet.breed ?? speciesLabels[pet.species]];
  if (pet.sex && pet.sex !== "unknown") {
    parts.push(sexLabels[pet.sex].toLowerCase());
  }
  if (pet.neutered !== undefined) {
    parts.push(pet.neutered ? (female ? "castrada" : "castrado") : female ? "não castrada" : "não castrado");
  }
  return parts.join(" · ");
}

function Table({ title, rows, empty, testID }: { title: string; rows: (VaccineRow & { product?: string })[]; empty: string; testID: string }) {
  const late = rows.filter((row) => row.late).length;
  return (
    <View style={local.section} testID={testID}>
      <View style={local.sectionHead}>
        <Text style={local.heading}>{title}</Text>
        {rows.length > 0 && (
          <View style={[local.chip, { backgroundColor: late > 0 ? colors.danger : colors.success }]}>
            <Text style={local.chipText}>{late === 0 ? "Em dia" : `${late} ${late === 1 ? "atrasado" : "atrasados"}`}</Text>
          </View>
        )}
      </View>
      {rows.length === 0 && <Text style={local.muted}>{empty}</Text>}
      {rows.map((row, index) => (
        <View key={index} style={local.row}>
          <View style={{ flex: 1 }}>
            <Text style={local.rowName}>{row.name}</Text>
            {row.product !== undefined && <Text style={local.muted}>{row.product}</Text>}
          </View>
          <Text style={local.rowDate}>{row.date}</Text>
          <Text style={[local.rowNext, row.late && { color: colors.dangerText }]}>{row.next}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * The health card of the Carteirinha-Mobile artboard (RN-83), for the owner
 * and for the public page. Only the owner view has the tutor.
 */
export function HealthCardView({ card, tutor, noseprint = false, qrText }: { card: HealthCard; tutor?: string; noseprint?: boolean; qrText?: string }) {
  const { pet } = card;
  const facts = [
    pet.birthDate ? { label: "Nascimento", value: dateText(pet.birthDate) } : null,
    pet.weightKg !== undefined ? { label: "Peso", value: `${String(pet.weightKg).replace(".", ",")} kg` } : null,
    tutor ? { label: "Tutor", value: tutor } : null,
  ].filter((fact) => fact !== null);
  const vet = [pet.vetName, pet.vetClinic, pet.vetPhone].filter(Boolean).join(" · ");
  return (
    <View style={{ gap: space.xl }}>
      <View style={local.card} testID="health-card">
        <View style={local.corner} />
        <View style={local.cardTop}>
          <LogoMark size={20} />
          <Text style={local.cardLabel}>CARTEIRINHA DE SAÚDE</Text>
        </View>
        <View style={local.petRow}>
          <View style={local.photo}>{pet.photoUrl ? <Image accessibilityLabel={`Foto de ${pet.name}`} source={{ uri: pet.photoUrl }} style={StyleSheet.absoluteFill} /> : <Icon name="camera" size={26} color={colors.onDarkMuted} />}</View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text testID="card-name" style={local.name} numberOfLines={1}>
                {pet.name}
              </Text>
              {noseprint && (
                <View accessibilityLabel="Focinho cadastrado" style={local.verified}>
                  <Icon name="check" size={13} strokeWidth={3} color={colors.onPrimary} />
                </View>
              )}
            </View>
            <Text style={local.cardMuted}>{subtitle(pet)}</Text>
          </View>
          {qrText !== undefined && (
            <View style={local.qr}>
              <QrCode text={qrText} module={2} />
            </View>
          )}
        </View>
        {facts.length > 0 && (
          <View style={local.facts}>
            {facts.map((fact) => (
              <View key={fact.label} style={{ flex: 1, gap: 2 }}>
                <Text style={local.factLabel}>{fact.label.toUpperCase()}</Text>
                <Text style={local.factValue}>{fact.value}</Text>
              </View>
            ))}
          </View>
        )}
        {vet !== "" && <Text style={local.cardMuted}>Veterinário: {vet}</Text>}
      </View>
      <Table testID="card-vaccines" title="Vacinas" rows={vaccineRows(card.vaccines)} empty="Nenhuma vacina registrada." />
      <Table testID="card-parasites" title="Antiparasitários" rows={medicationRows(card.parasiteControl)} empty="Nenhum antipulgas ou vermífugo registrado." />
      {card.exams !== undefined && (
        <View style={local.section} testID="card-exams">
          <View style={local.sectionHead}>
            <Text style={local.heading}>Exames</Text>
          </View>
          {card.exams.length === 0 && <Text style={local.muted}>Nenhum exame registrado.</Text>}
          {card.exams.map((exam, index) => (
            <View key={index} style={local.row}>
              <View style={{ flex: 1 }}>
                <Text style={local.rowName}>{exam.name}</Text>
                {(exam.lab || exam.result) && <Text style={local.muted}>{[exam.lab, exam.result].filter(Boolean).join(" · ")}</Text>}
              </View>
              <Text style={local.rowDate}>{dateText(exam.date)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const local = StyleSheet.create({
  card: { backgroundColor: colors.dark, borderRadius: radius.cardLarge, padding: space.xl, gap: space.lg, overflow: "hidden" },
  corner: { position: "absolute", right: -60, top: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: "#8A3A12" },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardLabel: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.8, color: colors.onDarkMuted },
  petRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  photo: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: colors.onDarkMuted, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  name: { flexShrink: 1, fontFamily: fonts.title, fontSize: 26, letterSpacing: -0.6, color: colors.onDark },
  verified: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  cardMuted: { fontFamily: fonts.body, fontSize: 14, color: colors.onDarkMuted },
  qr: { borderRadius: 10, overflow: "hidden" },
  facts: { flexDirection: "row", gap: 10, paddingTop: space.md, borderTopWidth: 1, borderTopColor: "#3A373D" },
  factLabel: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.6, color: colors.onDarkMuted },
  factValue: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onDark },
  section: { gap: 4 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 8, borderBottomWidth: 1.5, borderBottomColor: colors.borderStrong },
  heading: { fontFamily: fonts.titleBold, fontSize: 19, color: colors.ink },
  chip: { minHeight: 28, paddingHorizontal: 10, borderRadius: radius.pill, justifyContent: "center" },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.onPrimary },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  rowDate: { width: 72, fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },
  rowNext: { width: 70, textAlign: "right", fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
});
