import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";

export function loadLocalEnvFile(
  cwd: string = process.cwd(),
  envFileName: string = ".env",
) {
  const envFilePath = resolve(cwd, envFileName);

  if (!existsSync(envFilePath)) {
    return false;
  }

  loadEnvFile(envFilePath);
  return true;
}
