import { json, serve } from "../_shared/http.ts";
import { synchronize } from "../_shared/sheets.ts";
serve(async (req) => {
  const secret = Deno.env.get("SCHEDULE_SECRET");
  const supplied = req.headers.get("x-schedule-secret");
  if (!secret || !supplied) throw new Error("Unauthorized");
  const hash = async (s: string) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    );
  const a = await hash(secret),
    b = await hash(supplied);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  if (difference !== 0) throw new Error("Unauthorized");
  return json(await synchronize(null));
});
