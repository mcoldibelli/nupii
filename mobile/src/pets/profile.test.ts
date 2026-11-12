import { healthChips, petFacts } from "./profile";

const now = new Date("2026-11-12T12:00:00Z");
const care = (title: string, dueDate: string) => ({ eventId: "e", petId: "p", petName: "Thor", type: "vaccine" as const, title, dueDate });

test("the health chips show each next care and the castration (Pet artboard)", () => {
  expect(healthChips({ neutered: true }, [care("V10", "2027-05-01"), care("Antirrábica", "2026-11-24"), care("Drontal", "2026-11-10")], now)).toEqual([
    { label: "V10 em dia", tone: "ok" },
    { label: "Antirrábica vence em 12 dias", tone: "warn" },
    { label: "Drontal atrasado há 2 dias", tone: "late" },
    { label: "Castrado", tone: "ok" },
  ]);
  expect(healthChips({ neutered: false }, [], now)).toEqual([]);
});

test("the facts show only the data that the pet has", () => {
  expect(petFacts({ sex: "male", weightKg: 18, size: "medium" })).toEqual([
    { icon: "sex", label: "Macho" },
    { icon: "weight", label: "18 kg" },
    { icon: "size", label: "Porte médio" },
  ]);
  expect(petFacts({ sex: "unknown", weightKg: 7.25 })).toEqual([{ icon: "weight", label: "7,25 kg" }]);
});
