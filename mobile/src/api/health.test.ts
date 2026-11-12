import { createHealthEvent, deleteHealthAttachment, deleteHealthEvent, listHealthAttachments, listHealthEvents, listUpcomingCare, updateHealthEvent, uploadHealthAttachment } from "./health";

const baseUrl = "http://api.test";
const event = { id: "e1", petId: "p1", type: "exam", date: "2026-11-11", name: "X", remind: false, createdAt: "x" };

function fetchThatAnswers(status: number, body: unknown = undefined): jest.Mock {
  return jest.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body });
}

describe("health API", () => {
  it("lists, creates, changes and deletes the events of a pet", async () => {
    const list = fetchThatAnswers(200, { events: [event] });
    expect(await listHealthEvents(baseUrl, "t", "p1", list)).toEqual({ ok: true, value: [event] });
    expect(list.mock.calls[0][0]).toBe("http://api.test/v1/pets/p1/health-events");

    const create = fetchThatAnswers(201, event);
    await createHealthEvent(baseUrl, "t", "p1", { type: "exam", date: "2026-11-11", name: "X" }, create);
    expect(create.mock.calls[0][1].method).toBe("POST");

    const update = fetchThatAnswers(200, event);
    await updateHealthEvent(baseUrl, "t", "p1", "e1", { type: "exam", date: "2026-11-11", name: "Y" }, update);
    expect(update.mock.calls[0][0]).toBe("http://api.test/v1/pets/p1/health-events/e1");
    expect(update.mock.calls[0][1].method).toBe("PUT");

    const remove = fetchThatAnswers(204);
    await deleteHealthEvent(baseUrl, "t", "p1", "e1", remove);
    expect(remove.mock.calls[0][1].method).toBe("DELETE");
  });

  it("lists the upcoming care", async () => {
    const item = { eventId: "e1", petId: "p1", petName: "Rex", type: "vaccine", title: "V10", dueDate: "2027-11-10" };
    const fetchFn = fetchThatAnswers(200, { items: [item] });

    expect(await listUpcomingCare(baseUrl, "t", fetchFn)).toEqual({ ok: true, value: [item] });
    expect(fetchFn.mock.calls[0][0]).toBe("http://api.test/v1/upcoming-care");
  });

  it("lists, sends and deletes the attachments of an event", async () => {
    const attachment = { id: "a1", url: "u", contentType: "application/pdf", fileName: "x.pdf", sizeBytes: 3, createdAt: "x" };
    const list = fetchThatAnswers(200, { attachments: [attachment] });
    expect(await listHealthAttachments(baseUrl, "t", "p1", "e1", list)).toEqual({ ok: true, value: [attachment] });

    const upload = fetchThatAnswers(201, attachment);
    await uploadHealthAttachment(baseUrl, "t", "p1", "e1", new Blob(["%PDF"]), "exame.pdf", upload);
    expect(upload.mock.calls[0][0]).toBe("http://api.test/v1/pets/p1/health-events/e1/attachments");
    const body = upload.mock.calls[0][1].body as FormData;
    expect(body.get("file")).toBeInstanceOf(Blob);
    expect(body.get("fileName")).toBe("exame.pdf");

    const remove = fetchThatAnswers(204);
    await deleteHealthAttachment(baseUrl, "t", "p1", "e1", "a1", remove);
    expect(remove.mock.calls[0][0]).toBe("http://api.test/v1/pets/p1/health-events/e1/attachments/a1");
  });
});
