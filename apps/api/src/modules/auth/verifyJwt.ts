import { createLocalJWKSet, createRemoteJWKSet, jwtVerify } from "jose";

export type AuthenticatedUser = {
  /** Supabase Auth user UUID — taken from the `sub` claim. */
  userId: string;
  /** Original raw JWT forwarded to user-scoped Supabase clients. */
  jwt: string;
  /** Supabase Auth assurance level claim, used for MFA-aware admin gating. */
  authAssuranceLevel: string | null;
};

/** Accepts any key set returned by jose (remote or local) so tests can use a local key pair. */
export type JoseKeySet = Parameters<typeof jwtVerify>[1];

export type JwtVerifyFn = (jwt: string) => Promise<AuthenticatedUser>;

/**
 * Creates a JWT verifier from any jose-compatible key set.
 * Production: use `createSupabaseJwksVerifier`.
 * Tests: use `createVerifierFromKeySet` with `createLocalJWKSet`.
 */
export function createVerifierFromKeySet(keySet: JoseKeySet): JwtVerifyFn {
  return async (jwt: string): Promise<AuthenticatedUser> => {
    const { payload } = await jwtVerify(jwt, keySet);
    const userId = payload.sub;
    if (!userId) {
      throw new Error("JWT payload is missing the required sub claim");
    }
    return {
      userId,
      jwt,
      authAssuranceLevel: typeof payload.aal === "string" ? payload.aal : null,
    };
  };
}

/**
 * Creates a JWT verifier backed by the Supabase project's public JWKS endpoint.
 * Tokens are verified using the public key — no secret is stored or shared.
 */
export function createSupabaseJwksVerifier(supabaseUrl: string): JwtVerifyFn {
  const jwksUrl = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
  const keySet = createRemoteJWKSet(new URL(jwksUrl));
  return createVerifierFromKeySet(keySet);
}

// Re-export so tests can build local key sets without importing jose directly.
export { createLocalJWKSet };
