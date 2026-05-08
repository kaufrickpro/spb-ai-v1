export interface ScannerConfig {
  host: string;
  port: number;
  bearerToken: string;
  clamdHost: string;
  clamdPort: number;
  clamdTimeoutMs: number;
  maxScanBytes: number;
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
): ScannerConfig {
  const bearerToken = normalizeRequired(
    env.SCANNER_BEARER_TOKEN,
    "SCANNER_BEARER_TOKEN",
  );
  return {
    host: env.HOST ?? "0.0.0.0",
    port: parsePositiveInteger(env.PORT ?? "8080", "PORT"),
    bearerToken,
    clamdHost: env.CLAMD_HOST ?? "127.0.0.1",
    clamdPort: parsePositiveInteger(env.CLAMD_PORT ?? "3310", "CLAMD_PORT"),
    clamdTimeoutMs: parsePositiveInteger(
      env.CLAMD_TIMEOUT_MS ?? "60000",
      "CLAMD_TIMEOUT_MS",
    ),
    maxScanBytes: parsePositiveInteger(
      env.MAX_SCAN_BYTES ?? "26214400",
      "MAX_SCAN_BYTES",
    ),
  };
}

function normalizeRequired(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${name} is required`);
  }
  return normalized;
}

function parsePositiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}
