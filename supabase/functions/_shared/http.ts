import { createClient } from "npm:@supabase/supabase-js@2.118.0";
export const cors = {
  "Access-Control-Allow-Origin":
    Deno.env.get("APP_ORIGIN") || "http://localhost:5173",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-schedule-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};
export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
export function service() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function authorize(req: Request, superOnly = false) {
  const token = req.headers.get("Authorization");
  if (!token?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: token } },
      auth: { persistSession: false },
    },
  );
  const { data, error } = await userClient.auth.getUser(token.slice(7));
  if (error || !data.user) throw new Error("Unauthorized");
  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("id,role,status")
    .eq("id", data.user.id)
    .single();
  if (
    profileError ||
    profile?.status !== "active" ||
    (superOnly
      ? profile.role !== "super_admin"
      : !["admin", "super_admin"].includes(profile.role))
  )
    throw new Error("Forbidden");
  return { userClient, userId: data.user.id };
}
export function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST")
      return json({ error: "Method not allowed" }, 405);
    try {
      return await handler(req);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Request failed";
      console.error(text);
      return json(
        {
          error:
            text === "Unauthorized" || text === "Forbidden"
              ? text
              : "Request failed. Check the server logs or sync history.",
        },
        text === "Unauthorized" ? 401 : text === "Forbidden" ? 403 : 400,
      );
    }
  });
}
export async function collect<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const output: T[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await fetchPage(page * 500, page * 500 + 499);
    if (error) throw error;
    output.push(...(data || []));
    if (!data || data.length < 500) return output;
  }
}
