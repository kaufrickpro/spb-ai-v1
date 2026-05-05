import { describe, expect, it } from "vitest";
import { generateKeyPair, SignJWT, exportJWK } from "jose";
import { createLocalJWKSet, createVerifierFromKeySet } from "./verifyJwt.js";

const USER_ID = "00000000-0000-4000-8000-000000000099";
const SUPABASE_URL = "https://example-project.supabase.co";
const SUPABASE_ISSUER = `${SUPABASE_URL}/auth/v1`;
const SUPABASE_AUDIENCE = "authenticated";

async function makeKeySetAndSigner() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  const keySet = createLocalJWKSet({ keys: [{ ...publicJwk, alg: "RS256" }] });
  return { privateKey, keySet };
}

async function signTestJwt(
  privateKey: CryptoKey,
  claims: Record<string, unknown> = {},
) {
  return new SignJWT({ sub: USER_ID, role: "authenticated", ...claims })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(SUPABASE_ISSUER)
    .setAudience(SUPABASE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
}

function createTestVerifier(keySet: ReturnType<typeof createLocalJWKSet>) {
  return createVerifierFromKeySet(keySet, {
    issuer: SUPABASE_ISSUER,
    audience: SUPABASE_AUDIENCE,
  });
}

describe("createVerifierFromKeySet", () => {
  it("extracts userId from a valid signed JWT", async () => {
    const { privateKey, keySet } = await makeKeySetAndSigner();
    const jwt = await signTestJwt(privateKey);
    const verifier = createTestVerifier(keySet);

    const result = await verifier(jwt);

    expect(result.userId).toBe(USER_ID);
    expect(result.jwt).toBe(jwt);
    expect(result.authAssuranceLevel).toBeNull();
  });

  it("extracts the Supabase AAL claim when present", async () => {
    const { privateKey, keySet } = await makeKeySetAndSigner();
    const jwt = await signTestJwt(privateKey, { aal: "aal2" });
    const verifier = createTestVerifier(keySet);

    const result = await verifier(jwt);

    expect(result.authAssuranceLevel).toBe("aal2");
  });

  it("throws when the JWT is signed with a different key", async () => {
    const { keySet } = await makeKeySetAndSigner();
    const { privateKey: otherKey } = await generateKeyPair("RS256");
    const jwt = await signTestJwt(otherKey);
    const verifier = createTestVerifier(keySet);

    await expect(verifier(jwt)).rejects.toThrow();
  });

  it("throws when the JWT has an expired expiry", async () => {
    const { privateKey, keySet } = await makeKeySetAndSigner();
    const jwt = await new SignJWT({ sub: USER_ID })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(SUPABASE_ISSUER)
      .setAudience(SUPABASE_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("-1s")
      .sign(privateKey);
    const verifier = createTestVerifier(keySet);

    await expect(verifier(jwt)).rejects.toThrow();
  });

  it("throws when the JWT issuer is missing", async () => {
    const { privateKey, keySet } = await makeKeySetAndSigner();
    const jwt = await new SignJWT({ sub: USER_ID, role: "authenticated" })
      .setProtectedHeader({ alg: "RS256" })
      .setAudience(SUPABASE_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
    const verifier = createTestVerifier(keySet);

    await expect(verifier(jwt)).rejects.toThrow();
  });

  it("throws when the JWT issuer does not match the configured Supabase issuer", async () => {
    const { privateKey, keySet } = await makeKeySetAndSigner();
    const jwt = await new SignJWT({ sub: USER_ID, role: "authenticated" })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer("https://other-project.supabase.co/auth/v1")
      .setAudience(SUPABASE_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
    const verifier = createTestVerifier(keySet);

    await expect(verifier(jwt)).rejects.toThrow();
  });

  it("throws when the JWT audience is missing", async () => {
    const { privateKey, keySet } = await makeKeySetAndSigner();
    const jwt = await new SignJWT({ sub: USER_ID, role: "authenticated" })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(SUPABASE_ISSUER)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
    const verifier = createTestVerifier(keySet);

    await expect(verifier(jwt)).rejects.toThrow();
  });

  it("throws when the JWT audience is not authenticated", async () => {
    const { privateKey, keySet } = await makeKeySetAndSigner();
    const jwt = await new SignJWT({ sub: USER_ID, role: "anon" })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(SUPABASE_ISSUER)
      .setAudience("anon")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
    const verifier = createTestVerifier(keySet);

    await expect(verifier(jwt)).rejects.toThrow();
  });

  it("throws when the JWT payload is missing the sub claim", async () => {
    const { privateKey, keySet } = await makeKeySetAndSigner();
    const jwt = await new SignJWT({ role: "authenticated" })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(SUPABASE_ISSUER)
      .setAudience(SUPABASE_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
    const verifier = createTestVerifier(keySet);

    await expect(verifier(jwt)).rejects.toThrow(
      "JWT payload is missing the required sub claim",
    );
  });

  it("throws on a malformed token string", async () => {
    const { keySet } = await makeKeySetAndSigner();
    const verifier = createTestVerifier(keySet);

    await expect(verifier("not.a.jwt")).rejects.toThrow();
  });
});
