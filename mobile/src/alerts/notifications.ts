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

const DAY = 24 * 60 * 60 * 1000;

/**
 * Splits the notifications in "Hoje", "Esta semana" (the 6 days before today)
 * and "Antes", in the time zone of the device. A group with no item is left out.
 */
export function groupNotifications<T extends { createdAt: string }>(items: T[], now: Date = new Date()): { title: string; items: T[] }[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const groups = [
    { title: "Hoje", items: [] as T[] },
    { title: "Esta semana", items: [] as T[] },
    { title: "Antes", items: [] as T[] },
  ];
  for (const item of items) {
    const time = new Date(item.createdAt).getTime();
    groups[time >= today ? 0 : time >= today - 6 * DAY ? 1 : 2].items.push(item);
  }
  return groups.filter((group) => group.items.length > 0);
}
