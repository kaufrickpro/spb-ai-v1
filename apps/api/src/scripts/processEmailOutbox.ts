import { loadConfig } from "../modules/config/config.js";
import { loadLocalEnvFile } from "../modules/config/loadEnvFile.js";
import { processEmailOutbox } from "../modules/email/outboxService.js";

loadLocalEnvFile();

const limit = Number.parseInt(process.argv[2] ?? "25", 10);

processEmailOutbox({
  config: loadConfig(),
  limit: Number.isFinite(limit) && limit > 0 ? limit : 25,
})
  .then((result) => {
    console.log(`Processed ${result.processed} email outbox row(s).`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
