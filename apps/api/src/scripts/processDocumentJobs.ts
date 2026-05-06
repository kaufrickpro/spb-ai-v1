import { loadConfig } from "../modules/config/config.js";
import { loadLocalEnvFile } from "../modules/config/loadEnvFile.js";
import { processQueuedSupabaseDocumentProcessingJobs } from "../modules/manuscripts/documentProcessingRunner.js";

loadLocalEnvFile(new URL("../..", import.meta.url).pathname);

const config = loadConfig();
const limit = Number(process.argv[2] ?? 10);

if (!config.supabaseUrl) {
  throw new Error("SUPABASE_URL is required");
}

if (!config.supabaseServiceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
}

if (!config.aiServiceBaseUrl) {
  throw new Error("AI_SERVICE_BASE_URL is required");
}

const results = await processQueuedSupabaseDocumentProcessingJobs({
  config,
  limit: Number.isFinite(limit) && limit > 0 ? limit : 10,
});

console.log(
  JSON.stringify(
    {
      processed: results.length,
      results,
    },
    null,
    2,
  ),
);
