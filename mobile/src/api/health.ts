import { json, request, type ApiResult } from "./http";
import type { components } from "./schema";

export type HealthEvent = components["schemas"]["HealthEvent"];
export type HealthEventInput = components["schemas"]["HealthEventInput"];
export type HealthEventType = components["schemas"]["HealthEventType"];
export type UpcomingCare = components["schemas"]["UpcomingCare"];
export type HealthAttachment = components["schemas"]["HealthAttachment"];

const events = (baseUrl: string, petId: string) => `${baseUrl}/v1/pets/${petId}/health-events`;

/** Calls GET /v1/pets/{petId}/health-events: from the newest date to the oldest. */
export async function listHealthEvents(
  baseUrl: string,
  idToken: string,
  petId: string,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<HealthEvent[]>> {
  const result = await request<components["schemas"]["HealthEventList"]>(fetchFn, events(baseUrl, petId), idToken, { method: "GET" });
  return result.ok ? { ok: true, value: result.value.events } : result;
}

/** Calls POST /v1/pets/{petId}/health-events. */
export function createHealthEvent(
  baseUrl: string,
  idToken: string,
  petId: string,
  input: HealthEventInput,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<HealthEvent>> {
  return request<HealthEvent>(fetchFn, events(baseUrl, petId), idToken, json("POST", input));
}

/** Calls PUT /v1/pets/{petId}/health-events/{eventId}: the input replaces all the data. */
export function updateHealthEvent(
  baseUrl: string,
  idToken: string,
  petId: string,
  eventId: string,
  input: HealthEventInput,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<HealthEvent>> {
  return request<HealthEvent>(fetchFn, `${events(baseUrl, petId)}/${eventId}`, idToken, json("PUT", input));
}

/** Calls DELETE /v1/pets/{petId}/health-events/{eventId}: the attachments go too. */
export function deleteHealthEvent(
  baseUrl: string,
  idToken: string,
  petId: string,
  eventId: string,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<void>> {
  return request<void>(fetchFn, `${events(baseUrl, petId)}/${eventId}`, idToken, { method: "DELETE" });
}

/** Calls GET /v1/upcoming-care: from the nearest date to the farthest. */
export async function listUpcomingCare(
  baseUrl: string,
  idToken: string,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<UpcomingCare[]>> {
  const result = await request<components["schemas"]["UpcomingCareList"]>(fetchFn, `${baseUrl}/v1/upcoming-care`, idToken, {
    method: "GET",
  });
  return result.ok ? { ok: true, value: result.value.items } : result;
}

/** Calls GET .../attachments. */
export async function listHealthAttachments(
  baseUrl: string,
  idToken: string,
  petId: string,
  eventId: string,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<HealthAttachment[]>> {
  const url = `${events(baseUrl, petId)}/${eventId}/attachments`;
  const result = await request<components["schemas"]["HealthAttachmentList"]>(fetchFn, url, idToken, { method: "GET" });
  return result.ok ? { ok: true, value: result.value.attachments } : result;
}

/** Calls POST .../attachments with the file as the part "file", with its name. */
export function uploadHealthAttachment(
  baseUrl: string,
  idToken: string,
  petId: string,
  eventId: string,
  file: Blob,
  fileName?: string,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<HealthAttachment>> {
  const body = new FormData();
  body.append("file", file);
  // The fetch of Expo sends the name of the file object, and not a name
  // given to FormData: the name goes in a field of its own.
  if (fileName !== undefined) {
    body.append("fileName", fileName);
  }
  return request<HealthAttachment>(fetchFn, `${events(baseUrl, petId)}/${eventId}/attachments`, idToken, {
    method: "POST",
    body,
  });
}

/** Calls DELETE .../attachments/{attachmentId}. */
export function deleteHealthAttachment(
  baseUrl: string,
  idToken: string,
  petId: string,
  eventId: string,
  attachmentId: string,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<void>> {
  return request<void>(fetchFn, `${events(baseUrl, petId)}/${eventId}/attachments/${attachmentId}`, idToken, {
    method: "DELETE",
  });
}
