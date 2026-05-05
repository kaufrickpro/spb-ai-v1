import { ApiErrorSchema, createApiClient } from "@marketplace/contracts";
import { getWebConfig } from "../config/config";
import { supabase } from "../supabase/client";

export const webApiClient = createApiClient({
  baseUrl: getWebConfig().apiBaseUrl,
  getAuthToken: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  },
});

export function getApiErrorMessage(error: unknown): string {
  const parsed = ApiErrorSchema.safeParse(error);
  if (parsed.success) {
    return parsed.data.error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong";
}

export function getApiErrorCode(error: unknown): string | null {
  const parsed = ApiErrorSchema.safeParse(error);
  return parsed.success ? parsed.data.error.code : null;
}
