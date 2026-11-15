import { careDays, noseprintBadges, petStats, petSubtitle, pickPet, unreadCount, weightTrend } from "./home";

const now = new Date(Date.UTC(2026, 10, 12, 12));
const pet = { id: "p1", name: "Shakira", species: "dog", createdAt: "x" } as const;

describe("home", () => {
  it("writes the breed, the sex and the age of the pet", () => {
    expect(petSubtitle({ ...pet, breed: "Shih Tzu", sex: "female", birthDate: "2025-10-01" }, now)).toBe("Shih Tzu · fêmea · 1 ano");
    expect(petSubtitle({ ...pet, birthDate: "2026-07-01" }, now)).toBe("Cachorro · 4 meses");
    expect(petSubtitle({ ...pet, sex: "male", birthDate: "2023-01-01" }, now)).toBe("Cachorro · macho · 3 anos");
  });

  it("picks the saved pet, or the first one", () => {
    const list = [pet, { ...pet, id: "p2", name: "Paçoca" }];
    expect(pickPet(list, "p2")?.name).toBe("Paçoca");
    expect(pickPet(list, "gone")?.name).toBe("Shakira");
    expect(pickPet([], null)).toBeNull();
  });

  it("RN-51: gives the weight points of the events, the last six, and the change in 6 months", () => {
    const events = [
      { date: "2026-06-10", weightKg: 5.8 },
      { date: "2026-08-10", weightKg: 6.6 },
      { date: "2026-11-01", weightKg: 7.2 },
      { date: "2026-09-10" },
    ];
    expect(weightTrend(events, now)).toEqual({
      points: [
        { date: "2026-06-10", kg: 5.8 },
        { date: "2026-08-10", kg: 6.6 },
        { date: "2026-11-01", kg: 7.2 },
      ],
      latest: "7,2 kg",
      change: "+1,4 em 6 meses",
    });
    expect(weightTrend([], now)).toBeNull();
  });

  it("counts the unread notifications", () => {
    expect(unreadCount([{ read: false }, { read: true }, { read: false }])).toBe(2);
  });
});

describe("noseprintBadges (#252)", () => {
  it("gives the noseprint badge of each dog from the list of pets, with no call per pet", () => {
    const pets = [
      { id: "a", species: "dog", hasNoseprint: true },
      { id: "b", species: "dog", hasNoseprint: false },
      { id: "c", species: "dog" },
      { id: "d", species: "cat", hasNoseprint: true },
    ] as const;

    expect(noseprintBadges([...pets])).toEqual({ a: true, b: false, c: false });
  });
});

describe("Inicio-Web (#233)", () => {
  const now = new Date("2026-11-15T12:00:00Z");

  it("gives the age, the weight and the birth date of the pet card", () => {
    expect(petStats({ birthDate: "2025-05-09", weightKg: 7.2 }, now)).toEqual([
      { label: "Idade", value: "1 ano" },
      { label: "Peso", value: "7,2 kg" },
      { label: "Nasceu", value: "09/05/25" },
    ]);
    expect(petStats({}, now)).toEqual([
      { label: "Idade", value: "—" },
      { label: "Peso", value: "—" },
      { label: "Nasceu", value: "—" },
    ]);
  });

  it("marks the days of a month that have a care of the pet", () => {
    const care = [
      { petId: "a", dueDate: "2026-11-18" },
      { petId: "a", dueDate: "2026-12-02" },
      { petId: "b", dueDate: "2026-11-20" },
    ];
    expect(careDays(care, "a", 2026, 10)).toEqual(new Set([18]));
    expect(careDays(care, "a", 2026, 11)).toEqual(new Set([2]));
  });
});
