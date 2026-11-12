import { petSubtitle, pickPet, unreadCount, weightTrend } from "./home";

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
