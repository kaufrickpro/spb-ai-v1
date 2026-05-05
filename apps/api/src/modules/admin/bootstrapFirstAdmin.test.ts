import { describe, expect, it } from "vitest";
import {
  assertFirstAdminEmailAllowed,
  bootstrapFirstAdmin,
  normalizeAdminEmail,
  parseFirstAdminAllowlist,
} from "./bootstrapFirstAdmin.js";
import {
  DEFAULT_LOCAL_ADMIN_PASSWORD,
  seedLocalAdmin,
} from "./seedLocalAdmin.js";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("first admin bootstrap helpers", () => {
  it("normalizes allowlisted emails for stable matching", () => {
    expect(normalizeAdminEmail(" Admin@Example.com ")).toBe(
      "admin@example.com",
    );
    expect(
      parseFirstAdminAllowlist(" Admin@Example.com,ops@example.com , "),
    ).toEqual(["admin@example.com", "ops@example.com"]);
  });

  it("rejects emails that are not allowlisted", () => {
    expect(() =>
      assertFirstAdminEmailAllowed("blocked@example.com", [
        "admin@example.com",
      ]),
    ).toThrow("FIRST_ADMIN_EMAIL_ALLOWLIST");
  });

  it("invites a missing auth user before granting first-admin access", async () => {
    const inserts: unknown[] = [];
    const fakeClient = {
      auth: {
        admin: {
          inviteUserByEmail: async () => ({
            data: { user: { id: "user-1", email: "admin@example.com" } },
            error: null,
          }),
          listUsers: async () => ({
            data: { users: [], nextPage: null },
            error: null,
          }),
        },
      },
      from: (table: string) => ({
        insert: async (row: unknown) => {
          inserts.push({ row, table });
          return { error: null };
        },
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(
      bootstrapFirstAdmin({
        allowlist: ["admin@example.com"],
        client: fakeClient,
        email: "admin@example.com",
      }),
    ).resolves.toEqual({
      alreadyExisted: false,
      authUserCreated: true,
      userId: "user-1",
    });

    expect(inserts).toEqual([
      {
        table: "admin_users",
        row: {
          note: "first_admin_bootstrap",
          status: "active",
          user_id: "user-1",
        },
      },
    ]);
  });

  it("seeds a local-only admin with a known password", async () => {
    const upserts: unknown[] = [];
    const fakeClient = {
      auth: {
        admin: {
          createUser: async (payload: unknown) => ({
            data: {
              user: {
                id: "user-2",
                email: (payload as { email: string }).email,
              },
            },
            error: null,
          }),
          listUsers: async () => ({
            data: { users: [], nextPage: null },
            error: null,
          }),
        },
      },
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
        upsert: async (row: unknown) => {
          upserts.push({ row, table });
          return { error: null };
        },
      }),
    } as unknown as SupabaseClient;

    await expect(
      seedLocalAdmin({
        appConfigMode: "local",
        client: fakeClient,
        email: "Admin@Example.com",
      }),
    ).resolves.toEqual({
      createdAuthUser: true,
      email: "admin@example.com",
      password: DEFAULT_LOCAL_ADMIN_PASSWORD,
      userId: "user-2",
    });

    expect(upserts).toEqual([
      {
        table: "admin_users",
        row: {
          note: "local_admin_seed",
          status: "active",
          user_id: "user-2",
        },
      },
    ]);
  });

  it("refuses to seed local admins outside local app config", async () => {
    await expect(
      seedLocalAdmin({
        appConfigMode: "production",
        client: {} as SupabaseClient,
      }),
    ).rejects.toThrow("APP_CONFIG_MODE=local");
  });
});
