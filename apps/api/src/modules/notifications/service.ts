import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AppNotificationTypeSchema,
  NotificationItemSchema,
  type NotificationItem,
  type NotificationListQuery,
  type NotificationListResponse,
} from "@marketplace/contracts";
import type { ApiConfig } from "../config/config.js";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import {
  findTestProfileById,
  findTestProfileByUserId,
  type ProfileTestState,
} from "../profiles/testState.js";
import type {
  IntroNotification,
  IntroRequestTestState,
} from "../introRequests/testState.js";
import { NotificationServiceError } from "./errors.js";

type NotificationDeps = {
  config: ApiConfig;
  introTestState: IntroRequestTestState;
  profileTestState: ProfileTestState;
  user: AuthenticatedUser;
};

type DbNotificationRow = {
  id: string;
  recipient_profile_id: string;
  actor_profile_id: string | null;
  notification_type: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

const TARGET_LABEL_KEYS = [
  "manuscript_title",
  "publisher_name",
  "profile_name",
  "decision_label",
] as const;

export async function listNotifications(
  input: NotificationDeps & { query: NotificationListQuery },
): Promise<NotificationListResponse> {
  if (input.config.authMode === "test") {
    const profile = resolveTestProfile(input);
    return listTestNotifications(input, profile.profile.id, input.query);
  }

  const db = createServiceRoleSupabaseClient(
    input.config.supabaseUrl!,
    input.config.supabaseServiceRoleKey!,
  );
  const profileId = await resolveSupabaseProfileId(db, input.user.userId);
  return listSupabaseNotifications(db, profileId, input.query);
}

export async function markNotificationRead(
  input: NotificationDeps & { notificationId: string },
): Promise<{ notification: NotificationItem; unreadCount: number }> {
  if (input.config.authMode === "test") {
    const profile = resolveTestProfile(input);
    const row = input.introTestState.notifications.find(
      (item) =>
        item.id === input.notificationId &&
        item.recipientProfileId === profile.profile.id,
    );
    if (!row) {
      throw new NotificationServiceError("not_found", "Notification not found");
    }
    row.readAt = row.readAt ?? new Date().toISOString();
    return {
      notification: mapNotification(row, input.profileTestState),
      unreadCount: countUnread(
        input.introTestState.notifications,
        profile.profile.id,
      ),
    };
  }

  const db = createServiceRoleSupabaseClient(
    input.config.supabaseUrl!,
    input.config.supabaseServiceRoleKey!,
  );
  const profileId = await resolveSupabaseProfileId(db, input.user.userId);
  const { data, error } = await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", input.notificationId)
    .eq("recipient_profile_id", profileId)
    .select()
    .maybeSingle();
  if (error) {
    throw new NotificationServiceError(
      "storage",
      "Failed to mark notification read",
      error,
    );
  }
  if (!data) {
    throw new NotificationServiceError("not_found", "Notification not found");
  }

  return {
    notification: await mapDbNotification(db, data as DbNotificationRow),
    unreadCount: await countSupabaseUnread(db, profileId),
  };
}

export async function markAllNotificationsRead(
  input: NotificationDeps,
): Promise<{ unreadCount: number }> {
  if (input.config.authMode === "test") {
    const profile = resolveTestProfile(input);
    const now = new Date().toISOString();
    for (const item of input.introTestState.notifications) {
      if (item.recipientProfileId === profile.profile.id && !item.readAt) {
        item.readAt = now;
      }
    }
    return { unreadCount: 0 };
  }

  const db = createServiceRoleSupabaseClient(
    input.config.supabaseUrl!,
    input.config.supabaseServiceRoleKey!,
  );
  const profileId = await resolveSupabaseProfileId(db, input.user.userId);
  const { error } = await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_profile_id", profileId)
    .is("read_at", null);
  if (error) {
    throw new NotificationServiceError(
      "storage",
      "Failed to mark notifications read",
      error,
    );
  }
  return { unreadCount: 0 };
}

function listTestNotifications(
  input: NotificationDeps,
  profileId: string,
  query: NotificationListQuery,
): NotificationListResponse {
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  const visible = input.introTestState.notifications
    .filter((item) => item.recipientProfileId === profileId)
    .filter((item) => query.filter !== "unread" || !item.readAt)
    .filter(
      (item) =>
        AppNotificationTypeSchema.safeParse(item.notificationType).success,
    )
    .sort(compareNotificationRows);
  const afterCursor = cursor
    ? visible.filter(
        (item) =>
          item.createdAt < cursor.createdAt ||
          (item.createdAt === cursor.createdAt && item.id < cursor.id),
      )
    : visible;
  const page = afterCursor.slice(0, query.limit);
  return {
    items: page.map((item) => mapNotification(item, input.profileTestState)),
    nextCursor:
      afterCursor.length > query.limit && page.length > 0
        ? encodeCursor(page[page.length - 1])
        : null,
    unreadCount: countUnread(input.introTestState.notifications, profileId),
  };
}

async function listSupabaseNotifications(
  db: SupabaseClient,
  profileId: string,
  query: NotificationListQuery,
): Promise<NotificationListResponse> {
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  let request = db
    .from("notifications")
    .select()
    .eq("recipient_profile_id", profileId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(query.limit + 1);

  if (query.filter === "unread") {
    request = request.is("read_at", null);
  }
  if (cursor) {
    request = request.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await request;
  if (error) {
    throw new NotificationServiceError(
      "storage",
      "Failed to list notifications",
      error,
    );
  }

  const mapped = (
    await Promise.all(
      (data ?? [])
        .filter(
          (item) =>
            AppNotificationTypeSchema.safeParse(item.notification_type).success,
        )
        .map((item) => mapDbNotification(db, item as DbNotificationRow)),
    )
  ).slice(0, query.limit);

  return {
    items: mapped,
    nextCursor:
      (data ?? []).length > query.limit && mapped.length > 0
        ? encodeCursor({
            createdAt: mapped[mapped.length - 1].createdAt,
            id: mapped[mapped.length - 1].id,
          })
        : null,
    unreadCount: await countSupabaseUnread(db, profileId),
  };
}

async function mapDbNotification(
  db: SupabaseClient,
  row: DbNotificationRow,
): Promise<NotificationItem> {
  const actor = row.actor_profile_id
    ? await loadActor(db, row.actor_profile_id)
    : null;
  return NotificationItemSchema.parse({
    actor,
    createdAt: row.created_at,
    ctaPath: buildCtaPath(row.notification_type, row.target_id),
    id: row.id,
    readAt: row.read_at,
    target: {
      id: row.target_id,
      label: pickTargetLabel(row.metadata ?? {}),
      type: normalizeTargetType(row.target_type),
    },
    type: row.notification_type,
  });
}

function mapNotification(
  row: IntroNotification,
  profileState: ProfileTestState,
): NotificationItem {
  const actor = row.actorProfileId
    ? findTestProfileById(profileState, row.actorProfileId)?.profile
    : null;
  return NotificationItemSchema.parse({
    actor: actor
      ? {
          displayName: actor.displayName,
          profileId: actor.id,
          role: actor.role,
        }
      : null,
    createdAt: row.createdAt,
    ctaPath: buildCtaPath(row.notificationType, row.targetId),
    id: row.id,
    readAt: row.readAt,
    target: {
      id: row.targetId,
      label: pickTargetLabel(row.metadata),
      type: normalizeTargetType(row.targetType),
    },
    type: row.notificationType,
  });
}

async function loadActor(db: SupabaseClient, profileId: string) {
  const { data, error } = await db
    .from("profiles")
    .select("id,display_name,role")
    .eq("id", profileId)
    .maybeSingle();
  if (error) {
    throw new NotificationServiceError(
      "storage",
      "Failed to load notification actor",
      error,
    );
  }
  if (!data) return null;
  return {
    displayName: String(data.display_name),
    profileId: String(data.id),
    role: data.role === "publisher" ? "publisher" : "author",
  };
}

async function resolveSupabaseProfileId(
  db: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data, error } = await db
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new NotificationServiceError(
      "storage",
      "Failed to resolve notification profile",
      error,
    );
  }
  if (!data?.id) {
    throw new NotificationServiceError("not_found", "Profile not found");
  }
  return String(data.id);
}

async function countSupabaseUnread(
  db: SupabaseClient,
  profileId: string,
): Promise<number> {
  const { count, error } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_profile_id", profileId)
    .is("read_at", null);
  if (error) {
    throw new NotificationServiceError(
      "storage",
      "Failed to count unread notifications",
      error,
    );
  }
  return count ?? 0;
}

function resolveTestProfile(input: NotificationDeps) {
  const profile = findTestProfileByUserId(
    input.profileTestState,
    input.user.userId,
  );
  if (!profile) {
    throw new NotificationServiceError("not_found", "Profile not found");
  }
  return profile;
}

function countUnread(rows: IntroNotification[], profileId: string): number {
  return rows.filter(
    (item) => item.recipientProfileId === profileId && !item.readAt,
  ).length;
}

function compareNotificationRows(
  left: IntroNotification,
  right: IntroNotification,
) {
  const dateDelta = right.createdAt.localeCompare(left.createdAt);
  if (dateDelta !== 0) return dateDelta;
  return right.id.localeCompare(left.id);
}

function buildCtaPath(type: string, targetId: string): string {
  if (type === "intro_request_created") return "/app/requests?box=received";
  if (
    type === "intro_request_accepted" ||
    type === "intro_request_rejected" ||
    type === "intro_request_cancelled"
  ) {
    return "/app/requests?box=all";
  }
  if (type.startsWith("profile_")) return "/app/profile";
  if (type.startsWith("manuscript_")) {
    return `/app/manuscripts/${targetId}`;
  }
  return "/app/dashboard";
}

function normalizeTargetType(value: string) {
  if (value === "profile" || value === "manuscript") return value;
  return "intro_request";
}

function pickTargetLabel(metadata: Record<string, unknown>): string | null {
  for (const key of TARGET_LABEL_KEYS) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim().slice(0, 200);
    }
  }
  return null;
}

function encodeCursor(input: { createdAt: string; id: string }): string {
  return Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
}

function decodeCursor(
  cursor: string,
): { createdAt: string; id: string } | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );
    if (typeof parsed.createdAt === "string" && typeof parsed.id === "string") {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}
