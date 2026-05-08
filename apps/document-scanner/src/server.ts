import { timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import { ClamdError, scanBufferWithClamd } from "./clamdClient.js";
import type { ScannerConfig } from "./config.js";

export function createScannerServer(config: ScannerConfig) {
  return createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/health") {
        sendJson(response, 200, { status: "ok" });
        return;
      }

      if (request.method !== "POST" || request.url !== "/scan") {
        sendJson(response, 404, { error: "not_found" });
        return;
      }

      if (!isAuthorized(request, config.bearerToken)) {
        sendJson(response, 401, { error: "unauthorized" });
        return;
      }

      const content = await readRequestBody(request, config.maxScanBytes);
      const scan = await scanBufferWithClamd(content, {
        host: config.clamdHost,
        port: config.clamdPort,
        timeoutMs: config.clamdTimeoutMs,
      });

      sendJson(response, 200, {
        result: scan.result,
        scanner: scan.scanner,
        scanner_version: scan.scannerVersion,
        signature: scan.signature,
      });
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        sendJson(response, 413, { error: "scan_payload_too_large" });
        return;
      }

      if (error instanceof ClamdError) {
        sendJson(response, 502, { error: "scanner_unavailable" });
        return;
      }

      sendJson(response, 500, { error: "scanner_error" });
    }
  });
}

function isAuthorized(request: IncomingMessage, bearerToken: string): boolean {
  const headerToken = getScannerToken(request);
  if (!headerToken) {
    return false;
  }

  const supplied = Buffer.from(headerToken);
  const expected = Buffer.from(bearerToken);

  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}

function getScannerToken(request: IncomingMessage): string | null {
  const scannerToken = request.headers["x-scanner-token"];
  if (typeof scannerToken === "string" && scannerToken.trim()) {
    return scannerToken.trim();
  }

  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }

  return null;
}

class RequestBodyTooLargeError extends Error {}

async function readRequestBody(
  request: IncomingMessage,
  maxScanBytes: number,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxScanBytes) {
      throw new RequestBodyTooLargeError();
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: Record<string, unknown>,
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}
