import { z } from "zod";
import { IsoDateTimeSchema, UuidSchema } from "./common.js";

export const AppNotificationTypeSchema = z.enum([
  "intro_request_created",
  "intro_request_accepted",
  "intro_request_rejected",
  "intro_request_cancelled",
  "profile_approved",
  "profile_rejected",
  "profile_quarantined",
  "manuscript_approved",
  "manuscript_rejected",
  "manuscript_quarantined",
]);

export const NotificationTargetTypeSchema = z.enum([
  "intro_request",
  "profile",
  "manuscript",
]);

export const NotificationFilterSchema = z
  .enum(["all", "unread"])
  .optional()
  .default("all");

export const NotificationListQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  filter: NotificationFilterSchema,
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const NotificationActorSchema = z.object({
  profileId: UuidSchema,
  displayName: z.string().trim().min(1).max(120),
  role: z.enum(["author", "publisher"]),
});

export const NotificationTargetSchema = z.object({
  type: NotificationTargetTypeSchema,
  id: UuidSchema,
  label: z.string().trim().min(1).max(200).nullable(),
});

export const NotificationItemSchema = z.object({
  id: UuidSchema,
  type: AppNotificationTypeSchema,
  createdAt: IsoDateTimeSchema,
  readAt: IsoDateTimeSchema.nullable().default(null),
  actor: NotificationActorSchema.nullable(),
  target: NotificationTargetSchema,
  ctaPath: z.string().trim().min(1).max(300),
});

export const NotificationListResponseSchema = z.object({
  items: z.array(NotificationItemSchema),
  unreadCount: z.number().int().nonnegative(),
  nextCursor: z.string().trim().min(1).nullable(),
});

export const NotificationReadResponseSchema = z.object({
  notification: NotificationItemSchema,
  unreadCount: z.number().int().nonnegative(),
});

export const NotificationReadAllResponseSchema = z.object({
  unreadCount: z.number().int().nonnegative(),
});

export type AppNotificationType = z.infer<typeof AppNotificationTypeSchema>;
export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>;
export type NotificationItem = z.infer<typeof NotificationItemSchema>;
export type NotificationListResponse = z.infer<
  typeof NotificationListResponseSchema
>;
