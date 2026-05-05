import { loadLocalEnvFile } from "../modules/config/loadEnvFile.js";
import { createServiceRoleSupabaseClient } from "../modules/supabase/client.js";
import {
  bootstrapFirstAdmin,
  parseFirstAdminAllowlist,
} from "../modules/admin/bootstrapFirstAdmin.js";

loadLocalEnvFile(new URL("../..", import.meta.url).pathname);

const email = process.argv[2]?.trim();

if (!email) {
  throw new Error(
    "Usage: npm run bootstrap:first-admin --workspace apps/api -- <email>",
  );
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const allowlistRaw = process.env.FIRST_ADMIN_EMAIL_ALLOWLIST;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is required");
}

if (!serviceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
}

if (!allowlistRaw) {
  throw new Error("FIRST_ADMIN_EMAIL_ALLOWLIST is required");
}

const client = createServiceRoleSupabaseClient(supabaseUrl, serviceRoleKey);
const result = await bootstrapFirstAdmin({
  client,
  email,
  allowlist: parseFirstAdminAllowlist(allowlistRaw),
  redirectTo: process.env.WEB_APP_URL
    ? `${process.env.WEB_APP_URL.replace(/\/$/, "")}/login`
    : undefined,
});

console.log(
  JSON.stringify(
    {
      alreadyExisted: result.alreadyExisted,
      authUserCreated: result.authUserCreated,
      email,
      userId: result.userId,
    },
    null,
    2,
  ),
);
