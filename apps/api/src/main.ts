import { loadLocalEnvFile } from "./modules/config/loadEnvFile.js";
import { loadConfig } from "./modules/config/config.js";
import { buildApp } from "./server.js";

loadLocalEnvFile(new URL("..", import.meta.url).pathname);

const config = loadConfig();
const app = buildApp({ config });

await app.listen({ host: config.host, port: config.port });

app.log.info(`API listening on http://${config.host}:${config.port}`);
