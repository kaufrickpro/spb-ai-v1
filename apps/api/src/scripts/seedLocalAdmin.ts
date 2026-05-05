import { loadLocalEnvFile } from "../modules/config/loadEnvFile.js";
import { createServiceRoleSupabaseClient } from "../modules/supabase/client.js";
import {
  DEFAULT_LOCAL_ADMIN_EMAIL,
  DEFAULT_LOCAL_ADMIN_PASSWORD,
  seedLocalAdmin,
} from "../modules/admin/seedLocalAdmin.js";

loadLocalEnvFile(new URL("../..", import.meta.url).pathname);

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is required");
}

if (!serviceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
}

const client = createServiceRoleSupabaseClient(supabaseUrl, serviceRoleKey);
const result = await seedLocalAdmin({
  appConfigMode: process.env.APP_CONFIG_MODE ?? "local",
  client,
  email: process.argv[2],
  password: process.argv[3],
});

const webAppUrl = (process.env.WEB_APP_URL ?? "http://localhost:5173").replace(
  /\/$/,
  "",
);

console.log(`Local admin ready

Email: ${result.email}
Password: ${result.password}
Login: ${webAppUrl}/admin/login

Created Auth user: ${result.createdAuthUser ? "yes" : "no, updated existing user"}

Defaults: ${DEFAULT_LOCAL_ADMIN_EMAIL} / ${DEFAULT_LOCAL_ADMIN_PASSWORD}
This command is local-only and refuses to run unless APP_CONFIG_MODE=local.`);
