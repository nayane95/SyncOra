import { authorize, json, serve } from "../_shared/http.ts";
serve(async (req) => {
  const { userClient } = await authorize(req, true);
  const payload = await req.json();
  if (
    !payload.id ||
    !["super_admin", "admin", "developer"].includes(payload.role) ||
    !["pending", "active", "inactive", "rejected"].includes(payload.status)
  )
    return json({ error: "Invalid account update" }, 400);
  const { data, error } = await userClient.rpc("command", {
    action: "user",
    payload,
  });
  if (error) throw error;
  return json(data);
});
