import { json, request, type ApiResult } from "./http";
import type { components } from "./schema";

export type Notification = components["schemas"]["Notification"];
export type Location = components["schemas"]["Location"];

/** Calls PUT /v1/me/location: the API keeps only the last location (RN-30). */
export function setMyLocation(
  baseUrl: string,
  idToken: string,
  location: Location,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<void>> {
  return request<void>(fetchFn, `${baseUrl}/v1/me/location`, idToken, json("PUT", location));
}

/** Calls GET /v1/notifications: the 50 newest notifications (RN-35). */
export async function listNotifications(
  baseUrl: string,
  idToken: string,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<Notification[]>> {
  const result = await request<components["schemas"]["NotificationList"]>(fetchFn, `${baseUrl}/v1/notifications`, idToken, {
    method: "GET",
  });
  return result.ok ? { ok: true, value: result.value.notifications } : result;
}

/** Calls POST /v1/notifications/{notificationId}/read. */
export function markNotificationRead(
  baseUrl: string,
  idToken: string,
  notificationId: string,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<void>> {
  return request<void>(fetchFn, `${baseUrl}/v1/notifications/${encodeURIComponent(notificationId)}/read`, idToken, { method: "POST" });
}

/** Calls POST /v1/notifications/read: all the notifications of the owner are read (RN-74). */
export function markAllNotificationsRead(baseUrl: string, idToken: string, fetchFn: typeof fetch = fetch): Promise<ApiResult<void>> {
  return request<void>(fetchFn, `${baseUrl}/v1/notifications/read`, idToken, { method: "POST" });
}
