import { json, request, type ApiResult } from "./http";
import type { components } from "./schema";

export type Report = components["schemas"]["Report"];
export type ReportPage = components["schemas"]["ReportPage"];
export type Sighting = components["schemas"]["Sighting"];
export type LostReportInput = components["schemas"]["LostReportInput"];
export type SightingInput = components["schemas"]["SightingInput"];
export type FoundReportCreated = components["schemas"]["FoundReportCreated"];

/** The texts of a report or of a sighting. */
export type ReportDetails = { place?: string; description?: string };

/** Calls GET /v1/reports, a public operation: one page of the board, from 1. */
/** The filter of the board (RN-24): the type, and the radius around a point. */
export type BoardFilter = { type?: Report["type"]; center?: { latitude: number; longitude: number }; radiusKm?: 1 | 3 | 5 | 10 };

export function listBoard(baseUrl: string, page: number, filter: BoardFilter = {}, fetchFn: typeof fetch = fetch): Promise<ApiResult<ReportPage>> {
  const query = new URLSearchParams({ page: String(page) });
  if (filter.type) {
    query.set("type", filter.type);
  }
  if (filter.center && filter.radiusKm) {
    query.set("latitude", String(filter.center.latitude));
    query.set("longitude", String(filter.center.longitude));
    query.set("radiusKm", String(filter.radiusKm));
  }
  return request<ReportPage>(fetchFn, `${baseUrl}/v1/reports?${query.toString()}`, null, { method: "GET" });
}

/** Calls GET /v1/reports/{reportId}, a public operation. */
export function getReport(baseUrl: string, reportId: string, fetchFn: typeof fetch = fetch): Promise<ApiResult<Report>> {
  return request<Report>(fetchFn, `${baseUrl}/v1/reports/${encodeURIComponent(reportId)}`, null, { method: "GET" });
}

/** Calls POST /v1/reports/lost. */
export function reportLost(
  baseUrl: string,
  idToken: string,
  input: LostReportInput,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<Report>> {
  return request<Report>(fetchFn, `${baseUrl}/v1/reports/lost`, idToken, json("POST", input));
}

/** Calls POST /v1/reports/found, a public operation, with the photo of the nose. */
export function reportFound(
  baseUrl: string,
  photo: Blob,
  point: { latitude: number; longitude: number },
  details: ReportDetails,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<FoundReportCreated>> {
  const body = new FormData();
  body.append("file", photo);
  body.append("latitude", String(point.latitude));
  body.append("longitude", String(point.longitude));
  if (details.place !== undefined) {
    body.append("place", details.place);
  }
  if (details.description !== undefined) {
    body.append("description", details.description);
  }
  return request<FoundReportCreated>(fetchFn, `${baseUrl}/v1/reports/found`, null, { method: "POST", body });
}

/** Calls POST /v1/reports/{reportId}/sightings, a public operation. */
export function reportSighting(
  baseUrl: string,
  reportId: string,
  input: SightingInput,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<Sighting>> {
  return request<Sighting>(fetchFn, `${baseUrl}/v1/reports/${encodeURIComponent(reportId)}/sightings`, null, json("POST", input));
}

/** Calls POST /v1/reports/{reportId}/resolution: the author resolves the report. */
export function resolveReport(
  baseUrl: string,
  idToken: string,
  reportId: string,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<Report>> {
  return request<Report>(fetchFn, `${baseUrl}/v1/reports/${encodeURIComponent(reportId)}/resolution`, idToken, { method: "POST" });
}

/** Calls POST /v1/reports/{reportId}/code-resolution, a public operation. */
export function resolveFoundReport(
  baseUrl: string,
  reportId: string,
  code: string,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<Report>> {
  return request<Report>(fetchFn, `${baseUrl}/v1/reports/${encodeURIComponent(reportId)}/code-resolution`, null, json("POST", { code }));
}

/** Calls GET /v1/me/reports: the reports of the owner, open and resolved. */
export async function listMyReports(
  baseUrl: string,
  idToken: string,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<Report[]>> {
  const result = await request<components["schemas"]["ReportList"]>(fetchFn, `${baseUrl}/v1/me/reports`, idToken, {
    method: "GET",
  });
  return result.ok ? { ok: true, value: result.value.reports } : result;
}
