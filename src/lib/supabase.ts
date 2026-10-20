import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";
const url = import.meta.env.VITE_SUPABASE_URL;
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key);
export const supabase = configured
  ? createClient<Database>(url, key, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
export function client() {
  if (!supabase)
    throw new Error("Configure Supabase before using the workspace.");
  return supabase;
}
