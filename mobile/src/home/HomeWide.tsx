import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { devicePosition, locationAllowed } from "../alerts/deviceLocation";
import type { UpcomingCare } from "../api/health";
import type { Pet } from "../api/pets";
import { listBoard, type Report } from "../api/reports";
import { apiUrl } from "../config";
import { careLine, dateTile } from "../health/care";
import { distanceKm, timeAgo } from "../reports/board";
import { Button } from "../ui/Button";
import { MONTH_NAMES, monthGrid } from "../ui/calendar";
import { Icon, WeightChart } from "../ui/Icon";
import { colors, fonts, radius } from "../ui/theme";
import { careDays, petStats, petSubtitle } from "./home";
import { LostBanner } from "./LostBanner";

type Props = {
  pet: Pet;
  hasNoseprint: boolean;
  care: UpcomingCare[];
  unread: number;
  lost: Report | undefined;
  resolving: boolean;
  trend: { points: { date: string; kg: number }[]; latest: string; change: string | null } | null;
  onResolveLost: (report: Report) => void;
  /** The + sheet: health records and the Emergência item (#257). */
  onAdd: () => void;
};

const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"];

/**
 * The home on the browser of a computer (Inicio-Web artboard, #233): the pet
 * card, the next care with the month, and the reports near the person. The
 * owner's decisions stay: the lost report starts in the + sheet ("Adicionar")
 * and shows as the red banner (#257, #259); the notifications open from the bell.
 */
export function HomeWide({ pet, hasNoseprint, care, unread, lost, resolving, trend, onResolveLost, onAdd }: Props) {
  const today = new Date();
  const [month, setMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [near, setNear] = useState<{ reports: Report[]; center: { latitude: number; longitude: number } | null } | null>(null);
  const mine = care.filter((item) => item.petId === pet.id);
  const marked = careDays(care, pet.id, month.year, month.month);
  const isThisMonth = month.year === today.getFullYear() && month.month === today.getMonth();

  useEffect(() => {
    void (async () => {
      const center = (await locationAllowed().catch(() => false)) ? await devicePosition().catch(() => null) : null;
      const result = await listBoard(apiUrl, 1, center ? { center, radiusKm: 3 } : {});
      setNear({ reports: result.ok ? result.value.reports.slice(0, 4) : [], center });
    })();
  }, []);

  // Monday first, as in the artboard: monthGrid starts on Sunday.
  const sundayCells = monthGrid(month.year, month.month);
  const leading = sundayCells.findIndex((cell) => cell !== null);
  const days = sundayCells.filter((cell): cell is number => cell !== null);
  const cells: (number | null)[] = [...Array<null>((leading + 6) % 7).fill(null), ...days];
  const shift = (step: number) => setMonth(({ year, month: m }) => ({ year: m + step < 0 ? year - 1 : m + step > 11 ? year + 1 : year, month: (m + step + 12) % 12 }));
  const openHealth = () => router.push({ pathname: "/health/[petId]", params: { petId: pet.id, petName: pet.name } });

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={local.page}>
      <View style={local.head}>
        <Text style={local.title} accessibilityRole="header">
          Início
        </Text>
        <Pressable testID="notifications-bell" accessibilityRole="button" accessibilityLabel={unread > 0 ? `Notificações, ${unread} não lidas` : "Notificações"} style={local.bell} onPress={() => router.push("/notifications")}>
          <Icon name="bell" size={22} strokeWidth={1.9} />
          {unread > 0 && (
            <View style={local.unread}>
              <Text style={local.unreadText}>{unread}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {lost !== undefined && (
        <LostBanner petName={pet.name} report={lost} busy={resolving} onOpen={() => router.push({ pathname: "/reports/[id]", params: { id: lost.id } })} onResolve={() => onResolveLost(lost)} />
      )}

      <View style={local.columns}>
        <View style={local.main}>
          <View style={local.petRow}>
            <Pressable testID={`pet-row-${pet.name}`} accessibilityRole="button" accessibilityLabel={`Abrir o perfil de ${pet.name}`} onPress={() => router.push({ pathname: "/pets/[id]", params: { id: pet.id } })}>
              {pet.photoUrl ? (
                <Image source={{ uri: pet.photoUrl }} accessibilityLabel={`Foto de ${pet.name}`} style={local.photo} />
              ) : (
                <View style={[local.photo, local.photoEmpty]}>
                  <Text style={local.initial}>{pet.name.slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
            </Pressable>
            <View style={local.petInfo}>
              <View style={{ gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={local.petName}>{pet.name}</Text>
                  {hasNoseprint && (
                    <View accessibilityRole="image" accessibilityLabel="Focinho cadastrado" style={local.badge}>
                      <Icon name="check" size={14} strokeWidth={3.2} color={colors.onPrimary} />
                    </View>
                  )}
                </View>
                <Text style={local.muted}>{petSubtitle({ ...pet, birthDate: undefined })}</Text>
              </View>
              <View style={local.stats}>
                {petStats(pet).map((stat) => (
                  <View key={stat.label} style={{ gap: 2 }}>
                    <Text style={local.statLabel}>{stat.label}</Text>
                    <Text style={local.statValue}>{stat.value}</Text>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <Button testID="open-card" label="Carteirinha" icon="card" variant="dark" size="md" stretch={false} onPress={() => router.push({ pathname: "/share/[petId]", params: { petId: pet.id, petName: pet.name } })} />
                <Button testID="edit-pet" label="Editar perfil" variant="soft" size="md" stretch={false} onPress={() => router.push({ pathname: "/pets/edit/[id]", params: { id: pet.id } })} />
              </View>
            </View>
          </View>

          <View style={local.sectionHead}>
            <Text style={local.section}>Próximos cuidados</Text>
            <Button testID="home-anotar" label="Adicionar" icon="plus" variant="dark" size="sm" stretch={false} onPress={onAdd} />
          </View>
          <View style={local.careRow}>
            <View style={{ flex: 1, minWidth: 260, gap: 10 }}>
              {mine.slice(0, 3).map((item) => (
                <Pressable key={`${item.type}-${item.title}-${item.dueDate}`} testID="upcoming-care" accessibilityRole="button" style={local.careItem} onPress={openHealth}>
                  <View style={local.tile}>
                    <Text style={local.tileMonth}>{dateTile(item.dueDate).month}</Text>
                    <Text style={local.tileDay}>{dateTile(item.dueDate).day}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={local.careTitle}>{item.title}</Text>
                    <Text style={local.muted}>{careLine(item.dueDate)}</Text>
                  </View>
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" style={local.careEmpty} onPress={onAdd}>
                <View style={local.careEmptyIcon}>
                  <Icon name="calendar" size={18} />
                </View>
                <Text style={[local.muted, { flex: 1 }]}>Registre vacinas e consultas e a gente lembra você na data.</Text>
              </Pressable>
            </View>
            <View testID="care-calendar" style={local.calendar}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={[local.careTitle, { flex: 1 }]}>
                  {MONTH_NAMES[month.month]} {month.year}
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" style={local.monthButton} onPress={() => shift(-1)}>
                  <Icon name="back" size={16} strokeWidth={2.4} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" style={local.monthButton} onPress={() => shift(1)}>
                  <Icon name="chevronRight" size={16} strokeWidth={2.4} />
                </Pressable>
              </View>
              <View style={local.grid}>
                {WEEKDAYS.map((weekday, index) => (
                  <Text key={index} style={local.weekday}>
                    {weekday}
                  </Text>
                ))}
                {cells.map((cell, index) => {
                  const isToday = isThisMonth && cell === today.getDate();
                  const hasCare = cell !== null && marked.has(cell);
                  return (
                    <View key={index} style={local.cell}>
                      {cell !== null && (
                        <View style={[local.dayCircle, isToday && { backgroundColor: colors.dark }, hasCare && !isToday && { backgroundColor: colors.primary }]}>
                          <Text style={[local.dayText, (isToday || hasCare) && { color: colors.onPrimary }]}>{cell}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
              <View style={{ flexDirection: "row", gap: 14 }}>
                <View style={local.legend}>
                  <View style={[local.legendDot, { backgroundColor: colors.dark }]} />
                  <Text style={local.legendText}>hoje</Text>
                </View>
                <View style={local.legend}>
                  <View style={[local.legendDot, { backgroundColor: colors.primary }]} />
                  <Text style={local.legendText}>cuidado agendado</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={local.side}>
          <View style={local.sectionHead}>
            <Text style={local.section}>Perto de você</Text>
            <Button testID="open-board" label="Ver mural" icon="pin" variant="dark" size="sm" stretch={false} onPress={() => router.push("/reports")} />
          </View>
          {near === null ? (
            <Text style={local.muted}>Carregando...</Text>
          ) : near.reports.length === 0 ? (
            <Text style={local.muted}>Nenhum perdido ou achado {near.center ? "a até 3 km" : "no mural"} agora.</Text>
          ) : (
            near.reports.map((report) => {
              const lostReport = report.type === "lost";
              return (
                <Pressable key={report.id} testID={`near-${report.id}`} accessibilityRole="button" style={local.nearCard} onPress={() => router.push({ pathname: "/reports/[id]", params: { id: report.id } })}>
                  {report.photoUrl ? (
                    <Image source={{ uri: report.photoUrl }} style={local.nearPhoto} />
                  ) : (
                    <View style={[local.nearPhoto, { backgroundColor: lostReport ? colors.brand : colors.accent, alignItems: "center", justifyContent: "center" }]}>
                      <Icon name="pin" size={20} color={colors.onPrimary} />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={local.careTitle} numberOfLines={1}>
                      {lostReport ? (report.petName ?? "Cachorro") : "Cachorro achado"}
                    </Text>
                    <Text style={local.muted} numberOfLines={1}>
                      {[timeAgo(report.createdAt), near.center ? `${distanceKm(near.center, report).toFixed(1).replace(".", ",")} km` : null].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  <View style={[local.tag, { backgroundColor: lostReport ? colors.danger : colors.success }]}>
                    <Text style={local.tagText}>{lostReport ? "Perdido" : "Achado"}</Text>
                  </View>
                </Pressable>
              );
            })
          )}

          <View testID="weight-card" style={local.weight}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
              <Text style={local.careTitle}>Peso</Text>
              <Text style={local.weightValue}>{trend?.latest ?? petStats(pet)[1].value}</Text>
              {trend?.change && <Text style={local.weightChange}>{trend.change}</Text>}
            </View>
            {trend !== null && trend.points.length > 1 ? <WeightChart points={trend.points} width={320} /> : <Text style={local.muted}>Registre o peso numa consulta ou numa anotação para ver o gráfico.</Text>}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const local = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 48, paddingTop: 32, paddingBottom: 48, gap: 24 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: fonts.title, fontSize: 32, letterSpacing: -0.8, color: colors.ink },
  bell: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  unread: { position: "absolute", right: 7, top: 8, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 3, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.surface, alignItems: "center", justifyContent: "center" },
  unreadText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.onPrimary },
  columns: { flexDirection: "row", flexWrap: "wrap", gap: 32, alignItems: "flex-start" },
  main: { flexGrow: 2, flexBasis: 560, minWidth: 0, gap: 22 },
  side: { flexGrow: 1, flexBasis: 320, minWidth: 0, gap: 12 },
  petRow: { flexDirection: "row", flexWrap: "wrap", gap: 24, alignItems: "center" },
  photo: { width: 330, height: 280, borderRadius: 28 },
  photoEmpty: { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  initial: { fontFamily: fonts.title, fontSize: 72, color: colors.primary },
  petInfo: { flexGrow: 1, flexBasis: 260, gap: 18 },
  petName: { fontFamily: fonts.title, fontSize: 44, letterSpacing: -1.2, color: colors.ink },
  badge: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  stats: { flexDirection: "row", gap: 40 },
  statLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  statValue: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  section: { fontFamily: fonts.titleBold, fontSize: 22, color: colors.ink },
  careRow: { flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "flex-start" },
  careItem: { flexDirection: "row", alignItems: "center", gap: 14, padding: 10, borderRadius: radius.card, backgroundColor: colors.surface },
  tile: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  tileMonth: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: colors.onPrimary },
  tileDay: { fontFamily: fonts.title, fontSize: 21, lineHeight: 24, color: colors.onPrimary },
  careTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  careEmpty: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: radius.card, borderWidth: 2, borderStyle: "dashed", borderColor: colors.borderDashed },
  careEmptyIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  calendar: { flex: 1, minWidth: 300, gap: 10, padding: 16, borderRadius: 24, borderWidth: 1.5, borderColor: colors.border },
  monthButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: { width: `${100 / 7}%`, textAlign: "center", fontFamily: fonts.bodyBold, fontSize: 12, color: colors.textMuted, paddingVertical: 4 },
  cell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 2 },
  dayCircle: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  dayText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.ink },
  legend: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  nearCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: radius.card, borderWidth: 1.5, borderColor: colors.border },
  nearPhoto: { width: 56, height: 56, borderRadius: 14 },
  tag: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.onPrimary },
  weight: { gap: 8, padding: 16, borderRadius: 22, backgroundColor: colors.surface, marginTop: 8 },
  weightValue: { fontFamily: fonts.title, fontSize: 22, color: colors.ink },
  weightChange: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.success },
});
