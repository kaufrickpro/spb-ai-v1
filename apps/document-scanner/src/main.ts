import { loadConfig } from "./config.js";
import { createScannerServer } from "./server.js";

const config = loadConfig();
const server = createScannerServer(config);

server.listen(config.port, config.host, () => {
  console.info(`document scanner listening on ${config.host}:${config.port}`);
});
