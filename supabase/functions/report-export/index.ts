import { authorize, json, serve, collect } from "../_shared/http.ts";
serve(async (req) => {
  const { userClient } = await authorize(req);
  const { start, end, team_id, developer_id } = await req.json();
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
    start > end
  )
    return json({ error: "Invalid report dates" }, 400);
  const logs = await collect((from, to) => {
    let q = userClient
      .from("daily_work_logs")
      .select("*")
      .eq("status", "approved")
      .gte("work_date", start)
      .lte("work_date", end)
      .order("work_date")
      .order("id")
      .range(from, to);
    if (team_id) q = q.eq("team_id", team_id);
    if (developer_id) q = q.eq("developer_id", developer_id);
    return q;
  });
  const { error } = await userClient.rpc("command", {
    action: "export",
    payload: { starts_on: start, ends_on: end, format: "csv" },
  });
  if (error) throw error;
  return json({
    records: logs,
    note: "One approved daily record per developer/date. Use frontend Excel export for the formatted workbook.",
  });
});
