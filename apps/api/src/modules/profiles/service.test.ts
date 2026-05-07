import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiConfig } from "../config/config.js";
import {
  completeMarketplaceOnboardingDetails,
  createMarketplaceProfile,
  ProfileOnboardingError,
} from "./service.js";

const supabaseMocks = vi.hoisted(() => {
  const clientQueue: unknown[] = [];

  return {
    clientQueue,
    createUserSupabaseClient: vi.fn(() => {
      const client = clientQueue.shift();
      if (!client) {
        throw new Error("Unexpected Supabase client creation");
      }
      return client;
    }),
    createServiceRoleSupabaseClient: vi.fn(() => {
      const client = clientQueue.shift();
      if (!client) {
        throw new Error("Unexpected Supabase service-role client creation");
      }
      return client;
    }),
  };
});

vi.mock("../supabase/client.js", () => ({
  createServiceRoleSupabaseClient:
    supabaseMocks.createServiceRoleSupabaseClient,
  createUserSupabaseClient: supabaseMocks.createUserSupabaseClient,
}));

const supabaseConfig = {
  appConfigMode: "local",
  authMode: "supabase",
  host: "127.0.0.1",
  logLevel: "silent",
  port: 4000,
  storageProvider: "local",
  supabaseAnonKey: "anon-key",
  supabaseServiceRoleKey: "service-role-key",
  supabaseUrl: "http://localhost:54321",
  webAppUrl: "http://localhost:5173",
} as ApiConfig;

const user = {
  authAssuranceLevel: "aal1" as const,
  jwt: "user-jwt",
  userId: "00000000-0000-4000-8000-000000000010",
};

describe("profile service", () => {
  beforeEach(() => {
    supabaseMocks.clientQueue.length = 0;
    supabaseMocks.createServiceRoleSupabaseClient.mockClear();
    supabaseMocks.createUserSupabaseClient.mockClear();
  });

  it("creates Supabase marketplace profiles with the service-role client", async () => {
    const profileRow = {
      approval_status: "pending",
      created_at: "2026-05-05T12:00:00.000Z",
      display_name: "Ayse Yilmaz",
      eligibility_status: "limited",
      id: "10000000-0000-4000-8000-000000000001",
      locale: "tr",
      profile_photo_url: null,
      review_outcome: "needs_review",
      role: "author",
      signup_intent: "find_publisher",
      updated_at: "2026-05-05T12:00:00.000Z",
      user_id: user.userId,
    };
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: profileRow, error: null }),
      })),
    }));
    const serviceDb = {
      from: vi.fn(() => ({ insert })),
    };
    supabaseMocks.clientQueue.push(createAdminLookupClient(), serviceDb);

    const response = await createMarketplaceProfile({
      config: supabaseConfig,
      profile: {
        displayName: "Ayse Yilmaz",
        locale: "tr",
        profilePhotoUrl: null,
        role: "author",
        signupIntent: "find_publisher",
      },
      user,
    });

    expect(supabaseMocks.createServiceRoleSupabaseClient).toHaveBeenCalledWith(
      supabaseConfig.supabaseUrl,
      supabaseConfig.supabaseServiceRoleKey,
    );
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        approval_status: "pending",
        eligibility_status: "limited",
        review_outcome: "needs_review",
        user_id: user.userId,
      }),
    );
    expect(response.profile).toMatchObject({
      approvalStatus: "pending",
      eligibilityStatus: "limited",
      reviewOutcome: "needs_review",
      role: "author",
    });
  });

  it("completes Supabase onboarding details through one service-role RPC", async () => {
    const profileRow = {
      approval_status: "approved",
      created_at: "2026-05-05T12:00:00.000Z",
      display_name: "Ayse Yilmaz",
      eligibility_status: "eligible",
      id: "10000000-0000-4000-8000-000000000001",
      locale: "tr",
      profile_photo_url: null,
      review_outcome: "auto_approved",
      role: "author",
      signup_intent: "find_publisher",
      updated_at: "2026-05-05T12:01:00.000Z",
      user_id: user.userId,
    };
    const adminDb = createAdminLookupClient();
    const rpc = vi.fn().mockResolvedValue({ data: profileRow, error: null });
    const serviceDb = {
      from: vi.fn(() => {
        throw new Error(
          "Onboarding details must not use separate table writes",
        );
      }),
      rpc,
    };
    supabaseMocks.clientQueue.push(adminDb, serviceDb);

    const response = await completeMarketplaceOnboardingDetails({
      config: supabaseConfig,
      details: {
        role: "author",
        biography: "Roman ve oyku projeleri uzerinde calisiyorum.",
        primaryGenre: "Roman",
        writingLanguages: ["tr", "en"],
      },
      user,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      "complete_profile_onboarding_details",
      expect.objectContaining({
        p_accepts_unsolicited: null,
        p_actor_user_id: user.userId,
        p_biography: "Roman ve oyku projeleri uzerinde calisiyorum.",
        p_focus_genres: null,
        p_preferred_languages: null,
        p_primary_genre: "Roman",
        p_role: "author",
        p_style_statement: null,
        p_writing_languages: ["tr", "en"],
      }),
    );
    expect(serviceDb.from).not.toHaveBeenCalled();
    expect(supabaseMocks.createServiceRoleSupabaseClient).toHaveBeenCalledWith(
      supabaseConfig.supabaseUrl,
      supabaseConfig.supabaseServiceRoleKey,
    );
    expect(response).toMatchObject({
      profile: {
        approvalStatus: "approved",
        eligibilityStatus: "eligible",
        reviewOutcome: "auto_approved",
        role: "author",
      },
      details: {
        primaryGenre: "Roman",
        role: "author",
        writingLanguages: ["tr", "en"],
      },
    });
  });

  it("maps RPC role mismatches to the onboarding conflict error", async () => {
    supabaseMocks.clientQueue.push(createAdminLookupClient(), {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "P0004",
          message: "Onboarding details must match the saved marketplace role",
        },
      }),
    });

    await expect(
      completeMarketplaceOnboardingDetails({
        config: supabaseConfig,
        details: {
          role: "publisher",
          acceptsUnsolicited: true,
          focusGenres: ["Roman"],
          preferredLanguages: ["tr"],
        },
        user,
      }),
    ).rejects.toMatchObject({
      kind: "role_mismatch" satisfies ProfileOnboardingError["kind"],
    });
  });
});

function createAdminLookupClient() {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
  };
}
