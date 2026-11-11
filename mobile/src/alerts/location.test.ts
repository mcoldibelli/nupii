import { sendLocation } from "./location";

describe("sendLocation", () => {
  const position = { latitude: -23.5505, longitude: -46.6333 };

  it("RF-22: sends the position of the device when the person allows it", async () => {
    const send = jest.fn().mockResolvedValue({ ok: true, value: undefined });

    const result = await sendLocation({ allowed: async () => true, position: async () => position, send });

    expect(result).toBe("sent");
    expect(send).toHaveBeenCalledWith(position);
  });

  it("sends nothing when the person does not allow the location", async () => {
    const send = jest.fn();
    const position = jest.fn();

    expect(await sendLocation({ allowed: async () => false, position, send })).toBe("denied");
    expect(position).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("gives failed when the device has no position or the API fails", async () => {
    const noPosition = await sendLocation({
      allowed: async () => true,
      position: async () => {
        throw new Error("no position");
      },
      send: jest.fn(),
    });
    const apiFailure = await sendLocation({
      allowed: async () => true,
      position: async () => position,
      send: jest.fn().mockResolvedValue({ ok: false, code: "network" }),
    });

    expect([noPosition, apiFailure]).toEqual(["failed", "failed"]);
  });
});
