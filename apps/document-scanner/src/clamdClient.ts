import { createConnection } from "node:net";

export type ClamdScanResult =
  | {
      result: "clean";
      scanner: "clamav";
      scannerVersion: string | null;
      signature: null;
    }
  | {
      result: "suspicious";
      scanner: "clamav";
      scannerVersion: string | null;
      signature: string;
    };

export class ClamdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClamdError";
  }
}

export interface ClamdClientConfig {
  host: string;
  port: number;
  timeoutMs: number;
}

const MAX_CLAMD_CHUNK_BYTES = 1024 * 1024;

export async function scanBufferWithClamd(
  content: Buffer,
  config: ClamdClientConfig,
): Promise<ClamdScanResult> {
  const response = await sendInstream(content, config);
  return parseClamdInstreamResponse(response);
}

async function sendInstream(
  content: Buffer,
  config: ClamdClientConfig,
): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const socket = createConnection({
      host: config.host,
      port: config.port,
    });

    const fail = (error: Error) => {
      socket.destroy();
      reject(error);
    };

    socket.setTimeout(config.timeoutMs, () => {
      fail(new ClamdError("clamd_timeout"));
    });

    socket.on("error", (error) => {
      fail(new ClamdError(`clamd_connection_error:${error.message}`));
    });

    socket.on("data", (chunk) => {
      chunks.push(chunk);
    });

    socket.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8").replace(/\0+$/u, ""));
    });

    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (
        let offset = 0;
        offset < content.length;
        offset += MAX_CLAMD_CHUNK_BYTES
      ) {
        const chunk = content.subarray(offset, offset + MAX_CLAMD_CHUNK_BYTES);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length, 0);
        socket.write(size);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
  });
}

export function parseClamdInstreamResponse(response: string): ClamdScanResult {
  const trimmed = response.trim();

  if (/:\s+OK$/u.test(trimmed)) {
    return {
      result: "clean",
      scanner: "clamav",
      scannerVersion: null,
      signature: null,
    };
  }

  const foundMatch = trimmed.match(/:\s+(.+)\s+FOUND$/u);
  if (foundMatch) {
    return {
      result: "suspicious",
      scanner: "clamav",
      scannerVersion: null,
      signature: foundMatch[1].slice(0, 200),
    };
  }

  throw new ClamdError("clamd_invalid_response");
}
