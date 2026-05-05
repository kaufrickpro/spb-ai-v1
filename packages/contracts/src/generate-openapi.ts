import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildOpenApiDocument } from "./openapi.js";

const outputPath = resolve("openapi.json");
const document = buildOpenApiDocument();

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`);
