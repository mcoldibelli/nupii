import { markNotificationRead } from "./alerts";
import { checkNoseprint, getNoseprint, registerNoseprint } from "./biometrics";
import { createShareLink, listShareLinks, revokeShareLink } from "./cards";
import { confirmIdentification } from "./found";
import { createHealthEvent, deleteHealthAttachment, deleteHealthEvent, listHealthAttachments, listHealthEvents, updateHealthEvent, uploadHealthAttachment } from "./health";
import { deletePet, getPet, updatePet, uploadPetPhoto } from "./pets";
import { getReport, reportSighting, resolveFoundReport, resolveReport } from "./reports";

const base = "https://api.test";
// An id from the address of a screen. A link can put any text in it.
const id = "../me";
const blob = new Blob(["x"]);
const any = {} as never;

/** A fetch that keeps the address of each call. */
function recordingFetch() {
  const urls: string[] = [];
  const fetchFn = jest.fn(async (url: string) => {
    urls.push(url);
    return { ok: true, status: 200, json: async () => ({}) };
  }) as unknown as typeof fetch;
  return { urls, fetchFn };
}

const calls: [string, (fetchFn: typeof fetch) => Promise<unknown>][] = [
  ["markNotificationRead", (f) => markNotificationRead(base, "t", id, f)],
  ["getNoseprint", (f) => getNoseprint(base, "t", id, f)],
  ["registerNoseprint", (f) => registerNoseprint(base, "t", id, blob, f)],
  ["checkNoseprint", (f) => checkNoseprint(base, "t", id, blob, f)],
  ["confirmIdentification", (f) => confirmIdentification(base, id, "c", { name: "a", phone: "11999999999" }, blob, f)],
  ["createShareLink", (f) => createShareLink(base, "t", id, any, f)],
  ["listShareLinks", (f) => listShareLinks(base, "t", id, f)],
  ["revokeShareLink", (f) => revokeShareLink(base, "t", id, id, f)],
  ["getPet", (f) => getPet(base, "t", id, f)],
  ["updatePet", (f) => updatePet(base, "t", id, any, f)],
  ["deletePet", (f) => deletePet(base, "t", id, f)],
  ["uploadPetPhoto", (f) => uploadPetPhoto(base, "t", id, blob, f)],
  ["listHealthEvents", (f) => listHealthEvents(base, "t", id, f)],
  ["createHealthEvent", (f) => createHealthEvent(base, "t", id, any, f)],
  ["updateHealthEvent", (f) => updateHealthEvent(base, "t", id, id, any, f)],
  ["deleteHealthEvent", (f) => deleteHealthEvent(base, "t", id, id, f)],
  ["listHealthAttachments", (f) => listHealthAttachments(base, "t", id, id, f)],
  ["uploadHealthAttachment", (f) => uploadHealthAttachment(base, "t", id, id, blob, "a.pdf", f)],
  ["deleteHealthAttachment", (f) => deleteHealthAttachment(base, "t", id, id, id, f)],
  ["getReport", (f) => getReport(base, id, f)],
  ["reportSighting", (f) => reportSighting(base, id, any, f)],
  ["resolveReport", (f) => resolveReport(base, "t", id, f)],
  ["resolveFoundReport", (f) => resolveFoundReport(base, id, "code", f)],
];

describe("ids in the path of the API (#246)", () => {
  it.each(calls)("%s encodes the id, so ../me does not change the route", async (_name, call) => {
    const { urls, fetchFn } = recordingFetch();

    await call(fetchFn);

    expect(urls).toHaveLength(1);
    // The URL parser of fetch removes a "../" segment: "/v1/pets/../me" is "/v1/me".
    expect(urls[0]).not.toContain("/../");
    expect(new URL(urls[0]).pathname).toContain(encodeURIComponent(id));
  });
});
