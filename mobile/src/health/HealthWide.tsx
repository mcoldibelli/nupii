import { router } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { HealthEvent, HealthEventType, UpcomingCare } from "../api/health";
import type { Pet } from "../api/pets";
import { petStats, petSubtitle } from "../home/home";
import { Button } from "../ui/Button";
import { Icon, type IconName } from "../ui/Icon";
import { ErrorText } from "../ui/Text";
import { colors, fonts, radius } from "../ui/theme";
import { careWithin, itemDetail, itemStatus, lateCare, tabs, type Status } from "./board";
import { careLine, careWhen, dateTile } from "./care";
import { dateText, eventTitle, type Preset } from "./form";

type Props = {
  petId: string;
  petName: string;
  pet: Pet | undefined;
  events: HealthEvent[] | null;
  care: UpcomingCare[];
  tab: HealthEventType;
  error: string | null;
  onTab: (type: HealthEventType) => void;
  onOpen: (type: HealthEventType, params?: { eventId?: string; preset?: Preset; from?: string }) => void;
  onAnotar: () => void;
};

const typeIcons: Record<HealthEventType, IconName> = { vaccine: "syringe", consultation: "stethoscope", medication: "pill", exam: "flask", note: "calendar" };

const tones: Record<Status["tone"], { background: string; color: string }> = {
  ok: { background: colors.surface, color: colors.success },
  info: { background: colors.surface, color: colors.textSecondary },
  brand: { background: colors.primary, color: colors.onPrimary },
  late: { background: colors.danger, color: colors.onPrimary },
};

/**
 * The health of a pet on the browser of a computer (Saude-Web artboard, #233):
 * the late care, the table of events by type, the care of the next 60 days and
 * the vet of the pet. "Baixar carteirinha" opens the card to print, and
 * "Trocar veterinário" opens the edit of the pet, where the vet fields are.
 */
export function HealthWide({ petId, petName, pet, events, care, tab, error, onTab, onOpen, onAnotar }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const late = lateCare(care);
  const lateTypes = new Set(care.filter((item) => item.dueDate < today).map((item) => item.type));
  const shown = (events ?? []).filter((event) => event.type === tab);
  const current = tabs.find((item) => item.type === tab)!;
  const soon = careWithin(care, 60);
  const subtitle = pet ? [petSubtitle(pet), pet.weightKg !== undefined ? petStats(pet)[1].value : null].filter(Boolean).join(" · ") : "";
  const openCard = (print: boolean) => router.push({ pathname: "/share/[petId]", params: { petId, petName, ...(print ? { print: "1" } : {}) } });

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={local.page}>
      <View style={local.head}>
        {pet?.photoUrl ? <Image source={{ uri: pet.photoUrl }} accessibilityLabel={`Foto de ${petName}`} style={local.photo} /> : <View style={[local.photo, { backgroundColor: colors.surface }]} />}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={local.title} accessibilityRole="header">
            Saúde de {petName}
          </Text>
          <Text style={local.muted}>{subtitle}</Text>
        </View>
        <Button testID="print-card" label="Baixar carteirinha" icon="card" variant="outline" size="md" stretch={false} onPress={() => openCard(true)} />
        <Button testID="open-registrar" label="Anotar cuidado" icon="plus" variant="dark" size="md" stretch={false} onPress={onAnotar} />
      </View>

      {late && (
        <View testID="late-banner" accessibilityRole="alert" style={local.banner}>
          <View style={local.bannerIcon}>
            <Icon name="alert" size={22} color={colors.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={local.bannerTitle}>{late.care.title} atrasado</Text>
            <Text style={local.bannerLine}>
              era para {dateText(late.care.dueDate).slice(0, 5)}, há {late.days} {late.days === 1 ? "dia" : "dias"}
            </Text>
          </View>
          <Pressable testID="given-button" accessibilityRole="button" style={local.bannerButton} onPress={() => onOpen(late.care.type, { preset: "again", from: late.care.eventId })}>
            <Text style={local.bannerButtonText}>Já dei a dose</Text>
          </Pressable>
        </View>
      )}

      <View style={local.columns}>
        <View style={local.main}>
          <View style={local.tabs} accessibilityRole="tablist">
            {tabs.map((item) => {
              const selected = item.type === tab;
              const count = (events ?? []).filter((event) => event.type === item.type).length;
              const alert = lateTypes.has(item.type);
              return (
                <Pressable key={item.type} testID={`tab-${item.type}`} accessibilityRole="tab" accessibilityState={{ selected }} style={[local.tab, selected && { backgroundColor: colors.dark }]} onPress={() => onTab(item.type)}>
                  <Text style={[local.tabText, selected && { color: colors.onDark }]}>{item.label}</Text>
                  <View style={[local.count, alert && { backgroundColor: colors.danger }]}>
                    <Text style={[local.countText, alert && { color: colors.onPrimary }]}>{count}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {error !== null && <ErrorText testID="health-error">{error}</ErrorText>}
          <View style={local.table} accessibilityLabel={current.label}>
            <View style={[local.row, local.headRow]}>
              <Text style={[local.headText, local.colName]}>Registro</Text>
              <Text style={[local.headText, local.colDate]}>{tab === "medication" ? "Última dose" : "Data"}</Text>
              <Text style={[local.headText, local.colDate]}>Próxima</Text>
              <Text style={[local.headText, local.colProf]}>Profissional</Text>
              <Text style={[local.headText, local.colStatus]}>Status</Text>
              <View style={local.colAction} />
            </View>
            {events !== null && shown.length === 0 && (
              <Text testID="health-empty" style={[local.muted, { padding: 16 }]}>
                Nada anotado em {current.label.toLowerCase()}.
              </Text>
            )}
            {shown.map((event) => {
              const status = itemStatus(event, care);
              const lateItem = status.tone === "late";
              const next = care.find((item) => item.eventId === event.id);
              const detail = itemDetail(event);
              return (
                <Pressable key={event.id} testID={`event-${event.id}`} accessibilityRole="button" accessibilityLabel={`Abrir ${eventTitle(event)}`} style={local.row} onPress={() => onOpen(event.type, { eventId: event.id })}>
                  <View style={[local.colName, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
                    <View style={[local.itemIcon, lateItem && { backgroundColor: colors.danger }]}>
                      <Icon name={typeIcons[event.type]} size={18} color={lateItem ? colors.onPrimary : colors.ink} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={local.itemTitle} numberOfLines={1}>
                        {eventTitle(event)}
                      </Text>
                      {detail !== "" && (
                        <Text style={local.small} numberOfLines={1}>
                          {detail}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Text style={[local.cell, local.colDate]}>{dateText(event.date)}</Text>
                  <Text style={[local.cell, local.colDate, lateItem && { fontFamily: fonts.bodyBold }]}>{next ? dateText(next.dueDate) : "—"}</Text>
                  <Text style={[local.cell, local.colProf]} numberOfLines={1}>
                    {event.vet ?? event.clinic ?? event.lab ?? "—"}
                  </Text>
                  <View style={local.colStatus}>
                    <View style={[local.status, { backgroundColor: tones[status.tone].background }]}>
                      <Text style={[local.statusText, { color: tones[status.tone].color }]}>{status.label}</Text>
                    </View>
                  </View>
                  <View style={[local.colAction, local.action]}>
                    <Icon name="pencil" size={16} />
                  </View>
                </Pressable>
              );
            })}
            <Pressable testID={`new-${tab}`} accessibilityRole="button" style={local.addRow} onPress={() => onOpen(tab)}>
              <Icon name="plus" size={18} />
              <Text style={local.itemTitle}>{current.add}</Text>
            </Pressable>
          </View>
        </View>

        <View style={local.side}>
          <View style={local.soon}>
            <Text style={local.section}>Próximos 60 dias</Text>
            {soon.length === 0 && <Text style={local.muted}>Nenhum cuidado com data nos próximos 60 dias.</Text>}
            {soon.map((item) => {
              const lateItem = item.dueDate < today;
              const days = Math.round((Date.parse(item.dueDate) - Date.parse(today)) / 86400000);
              const background = lateItem ? colors.danger : days <= 7 ? colors.primary : colors.dark;
              return (
                <View key={`${item.eventId}-${item.dueDate}`} testID="soon-care" style={local.soonItem}>
                  <View style={[local.tile, { backgroundColor: background }]}>
                    <Text style={local.tileMonth}>{dateTile(item.dueDate).month}</Text>
                    <Text style={local.tileDay}>{dateTile(item.dueDate).day.padStart(2, "0")}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={local.itemTitle}>{item.title}</Text>
                    <Text style={[local.small, lateItem && { color: colors.dangerText }]}>{lateItem ? careWhen(item.dueDate) : careLine(item.dueDate)}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View testID="vet-card" style={local.vet}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={local.vetAvatar}>
                <Icon name="stethoscope" size={20} color={colors.onPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={local.vetLabel}>Veterinário</Text>
                <Text style={local.itemTitle}>{pet?.vetName ?? "Nenhum veterinário"}</Text>
                <Text style={local.small}>{pet?.vetName ? [pet.vetClinic, pet.vetPhone].filter(Boolean).join(" · ") : "Anote o veterinário no perfil do pet."}</Text>
              </View>
            </View>
            <Button testID="open-share" label="Enviar carteirinha" icon="share" variant="dark" size="md" onPress={() => openCard(false)} />
            <Button testID="change-vet" label={pet?.vetName ? "Trocar veterinário" : "Anotar veterinário"} variant="outline" size="md" onPress={() => router.push({ pathname: "/pets/edit/[id]", params: { id: petId } })} />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const local = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 48, paddingTop: 32, paddingBottom: 48, gap: 24 },
  head: { flexDirection: "row", alignItems: "center", gap: 14 },
  photo: { width: 56, height: 56, borderRadius: 28 },
  title: { fontFamily: fonts.title, fontSize: 32, letterSpacing: -0.8, color: colors.ink },
  muted: { fontFamily: fonts.body, fontSize: 15, color: colors.textMuted },
  small: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  banner: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, paddingLeft: 16, borderRadius: 24, backgroundColor: colors.primary },
  bannerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  bannerTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.onPrimary },
  bannerLine: { fontFamily: fonts.body, fontSize: 14, color: colors.onPrimary },
  bannerButton: { minHeight: 44, paddingHorizontal: 18, borderRadius: radius.pill, backgroundColor: colors.background, justifyContent: "center" },
  bannerButtonText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  columns: { flexDirection: "row", flexWrap: "wrap", gap: 24, alignItems: "flex-start" },
  main: { flexGrow: 3, flexBasis: 640, minWidth: 0, gap: 16 },
  side: { flexGrow: 1, flexBasis: 300, minWidth: 0, gap: 16 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tab: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, paddingLeft: 16, paddingRight: 8, borderRadius: radius.pill, backgroundColor: colors.surface },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  count: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  countText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
  table: { borderRadius: 22, borderWidth: 1.5, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  headRow: { minHeight: 40, backgroundColor: colors.surface },
  headText: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: colors.textSecondary },
  colName: { flex: 2.4, minWidth: 0 },
  colDate: { flex: 1, minWidth: 0 },
  colProf: { flex: 1.4, minWidth: 0 },
  colStatus: { flex: 1, minWidth: 0, alignItems: "flex-start" },
  colAction: { width: 36 },
  cell: { fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  itemIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  itemTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  status: { minHeight: 26, paddingHorizontal: 10, borderRadius: radius.pill, justifyContent: "center" },
  statusText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  action: { height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  addRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 52 },
  section: { fontFamily: fonts.titleBold, fontSize: 20, color: colors.ink },
  soon: { gap: 10, padding: 16, borderRadius: 24, backgroundColor: colors.surface },
  soonItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 8, borderRadius: 18, backgroundColor: colors.background },
  tile: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tileMonth: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: colors.onPrimary },
  tileDay: { fontFamily: fonts.title, fontSize: 20, lineHeight: 22, color: colors.onPrimary },
  vet: { gap: 10, padding: 16, borderRadius: 24, borderWidth: 1.5, borderColor: colors.border },
  vetAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  vetLabel: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: colors.textMuted },
});
