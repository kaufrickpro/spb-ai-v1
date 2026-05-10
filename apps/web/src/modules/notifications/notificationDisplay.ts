import type { NotificationItem } from "@marketplace/contracts";
import type { TFunction } from "i18next";

export function notificationTitle(
  item: NotificationItem,
  t: TFunction,
): string {
  return t(`notifications.types.${item.type}.title`);
}

export function notificationBody(item: NotificationItem, t: TFunction): string {
  return t(`notifications.types.${item.type}.body`, {
    actor: item.actor?.displayName ?? t("notifications.systemActor"),
    target: item.target.label ?? t("notifications.genericTarget"),
  });
}
