import type { Notification } from "../api/alerts";

/** The screen that a notification opens. */
export type NotificationTarget = { pathname: "/reports/[id]"; params: { id: string } } | { pathname: "/found-notices" };

/**
 * Returns the screen of a notification: the detail of the report, or the
 * found notices for a pet found by its nose.
 */
export function notificationTarget(notification: Pick<Notification, "kind" | "reportId">): NotificationTarget {
  if (notification.kind === "found" || notification.reportId === undefined) {
    return { pathname: "/found-notices" };
  }
  return { pathname: "/reports/[id]", params: { id: notification.reportId } };
}
