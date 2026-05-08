import { createServer, type Server } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { createScannerServer } from "./server.js";

const servers: Server[] = [];

describe("createScannerServer", () => {
  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve) => {
            server.close(() => resolve());
          }),
      ),
    );
  });

  it("requires a bearer token for scan requests", async () => {
    const clamdPort = await startFakeClamd("stream: OK\0");
    const serverUrl = await startHttpScanner(clamdPort);

    const response = await fetch(`${serverUrl}/scan`, {
      method: "POST",
      body: "hello",
    });

    expect(response.status).toBe(401);
  });

  it("returns clean scanner responses without echoing file content", async () => {
    const clamdPort = await startFakeClamd("stream: OK\0");
    const serverUrl = await startHttpScanner(clamdPort);

    const response = await fetch(`${serverUrl}/scan`, {
      method: "POST",
      headers: { authorization: "Bearer test-token" },
      body: "clean manuscript sample",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      result: "clean",
      scanner: "clamav",
      scanner_version: null,
      signature: null,
    });
  });

  it("accepts x-scanner-token for private Cloud Run OIDC callers", async () => {
    const clamdPort = await startFakeClamd("stream: OK\0");
    const serverUrl = await startHttpScanner(clamdPort);

    const response = await fetch(`${serverUrl}/scan`, {
      method: "POST",
      headers: {
        authorization: "Bearer google-oidc-token",
        "x-scanner-token": "test-token",
      },
      body: "clean manuscript sample",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      result: "clean",
    });
  });

  it("returns suspicious scanner responses for EICAR-like signatures", async () => {
    const clamdPort = await startFakeClamd(
      "stream: Eicar-Test-Signature FOUND\0",
    );
    const serverUrl = await startHttpScanner(clamdPort);

    const response = await fetch(`${serverUrl}/scan`, {
      method: "POST",
      headers: { authorization: "Bearer test-token" },
      body: "eicar",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      result: "suspicious",
      signature: "Eicar-Test-Signature",
    });
  });

  it("fails closed when clamd returns a malformed response", async () => {
    const clamdPort = await startFakeClamd("stream: ???\0");
    const serverUrl = await startHttpScanner(clamdPort);

    const response = await fetch(`${serverUrl}/scan`, {
      method: "POST",
      headers: { authorization: "Bearer test-token" },
      body: "hello",
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "scanner_unavailable",
    });
  });
});

async function startFakeClamd(response: string): Promise<number> {
  const server = createServer((socket) => {
    socket.on("data", () => {
      socket.end(response);
    });
  });
  servers.push(server);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to bind fake clamd");
  }

  return address.port;
}

async function startHttpScanner(clamdPort: number): Promise<string> {
  const server = createScannerServer({
    bearerToken: "test-token",
    clamdHost: "127.0.0.1",
    clamdPort,
    clamdTimeoutMs: 500,
    host: "127.0.0.1",
    maxScanBytes: 1024,
    port: 0,
  });
  servers.push(server);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to bind http scanner");
  }

  return `http://127.0.0.1:${address.port}`;
}
