import { loadLocalEnvFile } from "../modules/config/loadEnvFile.js";
import { createServiceRoleSupabaseClient } from "../modules/supabase/client.js";
import {
  DEFAULT_DEMO_AUTHOR_COUNT,
  DEFAULT_DEMO_EMAIL_DOMAIN,
  DEFAULT_DEMO_PASSWORD,
  DEFAULT_DEMO_PUBLISHER_COUNT,
  seedMarketplaceDemoData,
  type DemoSeedOptions,
} from "../modules/demoSeed/marketplaceDemoSeed.js";

loadLocalEnvFile(new URL("../..", import.meta.url).pathname);

const options = parseArgs(process.argv.slice(2));
const appConfigMode = process.env.APP_CONFIG_MODE ?? "local";

if (appConfigMode === "production") {
  throw new Error("Demo marketplace seed refuses to run in production mode");
}

if (
  appConfigMode !== "local" &&
  process.env.DEMO_SEED_ALLOW_NON_LOCAL !== "true" &&
  !options.allowNonLocal
) {
  throw new Error(
    "Demo marketplace seed is local-only by default. Set DEMO_SEED_ALLOW_NON_LOCAL=true or pass --allow-non-local for a non-production remote.",
  );
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is required");
}

if (!serviceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
}

const client = createServiceRoleSupabaseClient(supabaseUrl, serviceRoleKey);
const result = await seedMarketplaceDemoData({
  client,
  options: options.seedOptions,
});

console.log(`Demo marketplace seed complete

Publishers: ${result.publisherCount}
Authors: ${result.authorCount}
Author manuscripts: ${result.manuscriptsCreatedOrUpdated}

First publisher login: ${result.firstPublisherEmail}
First author login: ${result.firstAuthorEmail}
Password for all demo users: ${result.password}

Emails use the configured demo prefix/domain and are confirmed through Supabase Auth admin APIs.
`);

function parseArgs(args: string[]): {
  allowNonLocal: boolean;
  seedOptions: DemoSeedOptions;
} {
  const seedOptions: DemoSeedOptions = {
    authorCount: DEFAULT_DEMO_AUTHOR_COUNT,
    emailDomain: DEFAULT_DEMO_EMAIL_DOMAIN,
    password: DEFAULT_DEMO_PASSWORD,
    prefix: "demo",
    publisherCount: DEFAULT_DEMO_PUBLISHER_COUNT,
  };
  let allowNonLocal = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--allow-non-local") {
      allowNonLocal = true;
      continue;
    }

    const next = args[index + 1];
    if (!next) {
      throw new Error(`Missing value for ${arg}`);
    }

    if (arg === "--authors") {
      seedOptions.authorCount = parsePositiveInt(next, arg);
    } else if (arg === "--publishers") {
      seedOptions.publisherCount = parsePositiveInt(next, arg);
    } else if (arg === "--password") {
      if (next.length < 6) {
        throw new Error("Demo seed password must be at least 6 characters");
      }
      seedOptions.password = next;
    } else if (arg === "--email-domain") {
      seedOptions.emailDomain = next.trim().toLowerCase();
    } else if (arg === "--prefix") {
      seedOptions.prefix = next.trim().toLowerCase();
    } else {
      throw new Error(`Unknown argument ${arg}`);
    }
    index += 1;
  }

  return { allowNonLocal, seedOptions };
}

function parsePositiveInt(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 500) {
    throw new Error(`${label} must be an integer between 0 and 500`);
  }
  return parsed;
}
