import { ApiRoutes } from "@marketplace/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePostAuthRoute } from "./postAuthRouting";
import { WEB_ROUTES } from "../routing/routes";

const mockRequest = vi.fn();
const mockGetApiErrorCode = vi.fn();
const mockLoadSignupDraft = vi.fn();
const mockClearSignupDraft = vi.fn();

vi.mock("../api/client", () => ({
  getApiErrorCode: (error: unknown) => mockGetApiErrorCode(error),
  webApiClient: {
    request: (...args: unknown[]) => mockRequest(...args),
  },
}));

vi.mock("./authFlowStorage", () => ({
  clearSignupDraft: () => mockClearSignupDraft(),
  loadSignupDraft: () => mockLoadSignupDraft(),
}));

describe("resolvePostAuthRoute", () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockGetApiErrorCode.mockReset();
    mockLoadSignupDraft.mockReset();
    mockClearSignupDraft.mockReset();
  });

  it("creates a profile from the saved email signup draft after confirmation", async () => {
    const missingProfileError = new Error("profile missing");
    const draft = {
      displayName: "Ayse Yilmaz",
      locale: "tr",
      profilePhotoUrl: null,
      role: "author",
      signupIntent: "find_publisher",
    };

    mockRequest
      .mockResolvedValueOnce({ status: "no_access" })
      .mockRejectedValueOnce(missingProfileError)
      .mockResolvedValueOnce({
        profile: {
          id: "profile-1",
          ...draft,
        },
      });
    mockGetApiErrorCode.mockReturnValue("not_found");
    mockLoadSignupDraft.mockReturnValue(draft);

    await expect(resolvePostAuthRoute()).resolves.toBe(WEB_ROUTES.profile);

    expect(mockRequest).toHaveBeenNthCalledWith(1, ApiRoutes.admin.access);
    expect(mockRequest).toHaveBeenNthCalledWith(2, ApiRoutes.profiles.me);
    expect(mockRequest).toHaveBeenNthCalledWith(3, ApiRoutes.profiles.create, {
      body: draft,
    });
    expect(mockClearSignupDraft).toHaveBeenCalledOnce();
  });

  it("sends users without a saved draft back to the main signup wizard", async () => {
    const missingProfileError = new Error("profile missing");

    mockRequest
      .mockResolvedValueOnce({ status: "no_access" })
      .mockRejectedValueOnce(missingProfileError);
    mockGetApiErrorCode.mockReturnValue("not_found");
    mockLoadSignupDraft.mockReturnValue(null);

    await expect(resolvePostAuthRoute()).resolves.toBe(WEB_ROUTES.signup);

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockClearSignupDraft).not.toHaveBeenCalled();
  });

  it("sends staff sessions to MFA when admin landing is allowed", async () => {
    mockRequest.mockResolvedValueOnce({ status: "mfa_required" });

    await expect(
      resolvePostAuthRoute({ allowAdminLanding: true }),
    ).resolves.toBe(WEB_ROUTES.adminMfa);

    expect(mockRequest).toHaveBeenCalledOnce();
    expect(mockRequest).toHaveBeenCalledWith(ApiRoutes.admin.access);
    expect(mockClearSignupDraft).toHaveBeenCalledOnce();
  });

  it.each(["allowed", "mfa_required", "revoked"] as const)(
    "signs out and sends public staff callback sessions to staff login for %s access",
    async (status) => {
      const onPublicStaffSession = vi.fn();
      mockRequest.mockResolvedValueOnce({ status });

      await expect(
        resolvePostAuthRoute({ onPublicStaffSession }),
      ).resolves.toBe(`${WEB_ROUTES.adminLogin}?reason=staff`);

      expect(mockRequest).toHaveBeenCalledOnce();
      expect(mockRequest).toHaveBeenCalledWith(ApiRoutes.admin.access);
      expect(mockClearSignupDraft).toHaveBeenCalledOnce();
      expect(onPublicStaffSession).toHaveBeenCalledOnce();
    },
  );

  it("keeps no-access public callback sessions in the marketplace flow", async () => {
    const missingProfileError = new Error("profile missing");
    const onPublicStaffSession = vi.fn();

    mockRequest
      .mockResolvedValueOnce({ status: "no_access" })
      .mockRejectedValueOnce(missingProfileError);
    mockGetApiErrorCode.mockReturnValue("not_found");
    mockLoadSignupDraft.mockReturnValue(null);

    await expect(resolvePostAuthRoute({ onPublicStaffSession })).resolves.toBe(
      WEB_ROUTES.signup,
    );

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockClearSignupDraft).not.toHaveBeenCalled();
    expect(onPublicStaffSession).not.toHaveBeenCalled();
  });
});
