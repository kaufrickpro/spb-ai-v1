import { Bell } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { NotificationItem } from "@marketplace/contracts";
import { WEB_ROUTES } from "../routing/routes";
import { useMarkNotificationRead, useNotifications } from "./useNotifications";
import { notificationBody, notificationTitle } from "./notificationDisplay";

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const preview = useNotifications(
    { filter: "all", limit: 5 },
    { refetchInterval: 45_000 },
  );
  const markRead = useMarkNotificationRead();
  const items = preview.data?.items ?? [];
  const unreadCount = preview.data?.unreadCount ?? 0;

  async function openNotification(item: NotificationItem) {
    if (!item.readAt) {
      await markRead.mutateAsync(item.id);
    }
    navigate(item.ctaPath);
  }

  return (
    <details className="group relative">
      <summary
        aria-label={t("appNav.notifications")}
        className="relative flex cursor-pointer list-none items-center rounded-full border border-white/40 p-2 text-white hover:bg-white/10"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-80 rounded-md border border-slate-200 bg-white p-2 text-slate-900 shadow-lg">
        <div className="flex items-center justify-between px-2 py-1">
          <p className="text-sm font-semibold">{t("notifications.preview")}</p>
          <Link
            to={WEB_ROUTES.notifications}
            className="text-xs font-semibold text-cyan-700 hover:text-cyan-900"
          >
            {t("notifications.viewAll")}
          </Link>
        </div>
        {preview.isLoading ? (
          <p className="px-2 py-3 text-sm text-slate-600">
            {t("notifications.loading")}
          </p>
        ) : preview.isError ? (
          <p className="px-2 py-3 text-sm text-red-700">
            {t("notifications.error")}
          </p>
        ) : items.length === 0 ? (
          <p className="px-2 py-3 text-sm text-slate-600">
            {t("notifications.empty")}
          </p>
        ) : (
          <div className="mt-1 space-y-1">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void openNotification(item)}
                className="block w-full rounded-md px-2 py-2 text-left hover:bg-slate-100"
              >
                <span className="flex items-start gap-2">
                  {!item.readAt ? (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-600" />
                  ) : (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-transparent" />
                  )}
                  <span>
                    <span className="block text-sm font-semibold">
                      {notificationTitle(item, t)}
                    </span>
                    <span className="block text-xs text-slate-600">
                      {notificationBody(item, t)}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
