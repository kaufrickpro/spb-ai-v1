import { createServer, type Server, type Socket } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import {
  ClamdError,
  parseClamdInstreamResponse,
  scanBufferWithClamd,
} from "./clamdClient.js";

const servers: Server[] = [];

describe("parseClamdInstreamResponse", () => {
  it("maps OK responses to clean scanner output", () => {
    expect(parseClamdInstreamResponse("stream: OK")).toEqual({
      result: "clean",
      scanner: "clamav",
      scannerVersion: null,
      signature: null,
    });
  });

  it("maps FOUND responses to suspicious scanner output", () => {
    expect(
      parseClamdInstreamResponse("stream: Eicar-Test-Signature FOUND"),
    ).toEqual({
      result: "suspicious",
      scanner: "clamav",
      scannerVersion: null,
      signature: "Eicar-Test-Signature",
    });
  });

  it("rejects malformed clamd responses", () => {
    expect(() => parseClamdInstreamResponse("stream: nonsense")).toThrow(
      ClamdError,
    );
  });
});

describe("scanBufferWithClamd", () => {
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

  it("sends the INSTREAM command and maps a clean clamd response", async () => {
    const { port, received } = await startFakeClamd("stream: OK\0");

    const result = await scanBufferWithClamd(Buffer.from("hello"), {
      host: "127.0.0.1",
      port,
      timeoutMs: 500,
    });

    expect(result.result).toBe("clean");
    expect(Buffer.concat(received).includes(Buffer.from("zINSTREAM\0"))).toBe(
      true,
    );
  });

  it("maps EICAR-like clamd responses to suspicious", async () => {
    const { port } = await startFakeClamd(
      "stream: Eicar-Test-Signature FOUND\0",
    );

    const result = await scanBufferWithClamd(Buffer.from("eicar"), {
      host: "127.0.0.1",
      port,
      timeoutMs: 500,
    });

    expect(result).toMatchObject({
      result: "suspicious",
      signature: "Eicar-Test-Signature",
    });
  });
});

async function startFakeClamd(response: string): Promise<{
  port: number;
  received: Buffer[];
}> {
  const received: Buffer[] = [];
  const server = createServer((socket: Socket) => {
    socket.on("data", (chunk) => {
      received.push(chunk);
      if (Buffer.concat(received).subarray(-4).equals(Buffer.alloc(4))) {
        socket.end(response);
      }
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

  return { port: address.port, received };
}
