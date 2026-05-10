import type { NotificationItem } from "@marketplace/contracts";
import { CheckCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PlatformHeader } from "../layout/PlatformHeader";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "./useNotifications";
import { notificationBody, notificationTitle } from "./notificationDisplay";

export function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [cursor, setCursor] = useState<string | undefined>();
  const notifications = useNotifications({ cursor, filter, limit: 20 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const items = notifications.data?.items ?? [];

  async function openNotification(item: NotificationItem) {
    if (!item.readAt) {
      await markRead.mutateAsync(item.id);
    }
    navigate(item.ctaPath);
  }

  return (
    <>
      <PlatformHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">
              {t("notifications.kicker")}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">
              {t("notifications.title")}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => void markAllRead.mutateAsync()}
            disabled={
              markAllRead.isPending ||
              (notifications.data?.unreadCount ?? 0) === 0
            }
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" />
            {t("notifications.markAllRead")}
          </button>
        </div>

        <div className="mt-6 inline-flex rounded-md border border-slate-300 p-1">
          {(["all", "unread"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setCursor(undefined);
                setFilter(item);
              }}
              className="rounded px-3 py-1.5 text-sm font-semibold data-[active=true]:bg-slate-900 data-[active=true]:text-white"
              data-active={filter === item}
            >
              {t(`notifications.filters.${item}`)}
            </button>
          ))}
        </div>

        <section className="mt-6">
          {notifications.isLoading ? (
            <StatusText>{t("notifications.loading")}</StatusText>
          ) : notifications.isError ? (
            <StatusText tone="error">{t("notifications.error")}</StatusText>
          ) : items.length === 0 ? (
            <StatusText>{t("notifications.empty")}</StatusText>
          ) : (
            <div className="divide-y divide-slate-200 border-y border-slate-200">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="grid gap-3 py-4 sm:grid-cols-[1fr_auto]"
                >
                  <button
                    type="button"
                    onClick={() => void openNotification(item)}
                    className="text-left"
                  >
                    <div className="flex items-start gap-3">
                      {!item.readAt ? (
                        <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-600" />
                      ) : (
                        <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-transparent" />
                      )}
                      <div>
                        <h2 className="text-base font-semibold text-slate-950">
                          {notificationTitle(item, t)}
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                          {notificationBody(item, t)}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </button>
                  {!item.readAt ? (
                    <button
                      type="button"
                      onClick={() => void markRead.mutateAsync(item.id)}
                      className="self-start rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      {t("notifications.markRead")}
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        {notifications.data?.nextCursor ? (
          <div className="mt-6">
            <button
              type="button"
              onClick={() =>
                setCursor(notifications.data?.nextCursor ?? undefined)
              }
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              {t("notifications.nextPage")}
            </button>
          </div>
        ) : null}
      </main>
    </>
  );
}

function StatusText({
  children,
  tone = "muted",
}: {
  children: string;
  tone?: "muted" | "error";
}) {
  return (
    <p
      className={`rounded-md border px-4 py-6 text-sm ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {children}
    </p>
  );
}
