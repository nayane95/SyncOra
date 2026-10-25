import process from "node:process";
import { URL } from "node:url";
import console from "node:console";
import { createClient } from "@supabase/supabase-js";

const production = process.argv.includes("--production");
const url =
  process.env.SUPABASE_URL ||
  (production ? process.env.VITE_SUPABASE_URL : "http://127.0.0.1:54321");
if (!url)
  throw new Error("Set SUPABASE_URL to the production Supabase project URL.");
const target = new URL(url);
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_ADMIN_EMAIL || "super-admin@example.com";
const password = process.env.SEED_ADMIN_PASSWORD;

const local = ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname);
if (!local && !production)
  throw new Error(
    "Use --production explicitly to seed a hosted Supabase project.",
  );
if (
  !local &&
  (target.protocol !== "https:" ||
    target.username ||
    target.password ||
    target.pathname !== "/" ||
    target.search ||
    target.hash)
)
  throw new Error("Production SUPABASE_URL must be an HTTPS project origin.");
if (!key || !password || password.length < 16)
  throw new Error(
    "Set SUPABASE_SERVICE_ROLE_KEY and a SEED_ADMIN_PASSWORD of at least 16 characters.",
  );

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await client.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: "Super Admin" },
});
if (error) throw error;
const { error: profileError } = await client
  .from("profiles")
  .update({ role: "super_admin", status: "active" })
  .eq("id", data.user.id)
  .select("id")
  .single();
if (profileError)
  throw new Error(
    "Auth account created but profile activation failed. Inspect the pending profile in Supabase before retrying.",
  );
console.log(`Created ${local ? "local" : "production"} Super Admin: ${email}`);
