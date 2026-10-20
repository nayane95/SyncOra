import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, configured } from "./supabase";
import type { Json, Tables } from "../types/database";
export type Filter = {
  column: string;
  op?: "eq" | "gte" | "lte" | "in" | "is" | "search" | "assigned";
  value: string | boolean | null | string[];
};
export async function rows<K extends keyof Tables>(
  table: K,
  filters: Filter[] = [],
  page = 0,
  size = 100,
): Promise<Tables[K][]> {
  let query = client()
    .from(table)
    .select("*")
    .order("created_at", { ascending: false })
    .order("id")
    .range(page * size, (page + 1) * size - 1);
  for (const f of filters) {
    if (f.op === "search") {
      const term = String(f.value)
        .replace(/[(),%"\\]/g, " ")
        .trim();
      if (term)
        query = query.or(
          `title.ilike.%${term}%,description.ilike.%${term}%${/^\d+$/.test(term.replace(/^SYNC-/i, "")) ? `,task_number.eq.${Number(term.replace(/^SYNC-/i, ""))}` : ""}`,
        );
    } else if (f.op === "assigned") {
      const { data, error } = await client()
        .from("task_assignees")
        .select("task_id")
        .eq("developer_id", String(f.value));
      if (error) throw error;
      query = query.or(
        `assignee_id.eq.${f.value}${data.length ? `,id.in.(${data.map((a) => a.task_id).join(",")})` : ""}`,
      );
    } else if (f.op === "in")
      query = query.filter(
        f.column,
        "in",
        `(${(f.value as string[]).map((v) => `"${v.replaceAll('"', '\\"')}"`).join(",")})`,
      );
    else if (f.op === "is") query = query.is(f.column, f.value as null);
    else if (f.op === "gte") query = query.gte(f.column, f.value as string);
    else if (f.op === "lte") query = query.lte(f.column, f.value as string);
    else query = query.filter(f.column, "eq", f.value);
  }
  const { data, error } = await query;
  if (error) throw error;
  // The client returns generic table unions for a dynamic relation; narrow at this typed boundary.
  return data as unknown as Tables[K][];
}
export async function allRows<K extends keyof Tables>(
  table: K,
  filters: Filter[] = [],
): Promise<Tables[K][]> {
  const result: Tables[K][] = [];
  for (let page = 0; ; page++) {
    const batch = await rows(table, filters, page, 500);
    result.push(...batch);
    if (batch.length < 500) return result;
  }
}
export function useRows<K extends keyof Tables>(
  table: K,
  filters: Filter[] = [],
  page = 0,
  enabled = true,
) {
  return useQuery({
    queryKey: [table, filters, page],
    queryFn: () => rows(table, filters, page),
    enabled: configured && enabled,
  });
}
export async function command(action: string, payload: object) {
  const { data, error } = await client().rpc("command", {
    action,
    payload: payload as Json,
  });
  if (error) throw error;
  return data;
}
export function useCommand() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: ({ action, payload }: { action: string; payload: object }) =>
      command(action, payload),
    onSuccess: (_data, { action }) => {
      const affected: Record<string, string[]> = {
        profile: ["profile", "profiles"],
        user: ["profile", "profiles", "teams", "tasks"],
        team: ["teams"],
        project: ["projects"],
        module: ["modules"],
        membership: ["team_memberships", "profiles", "teams"],
        project_membership: ["project_memberships", "projects"],
        holiday: ["holidays"],
        calendar: ["working_calendar_settings"],
        leave_type: ["leave_types"],
        integration: ["google_sheet_integrations"],
        task: ["tasks", "task_status_history"],
        bulk_tasks: ["tasks", "task_status_history"],
        contributor: ["task_assignees", "tasks"],
        comment: ["task_comments"],
        plan: ["standup_sessions", "standup_assignments"],
        leave: ["leave_requests"],
        leave_decision: ["leave_requests", "daily_work_logs"],
        work_log: ["daily_work_logs", "daily_task_updates"],
        review: ["daily_work_logs"],
        snapshot: ["report_snapshots"],
        export: ["report_exports"],
      };
      return Promise.all(
        [...(affected[action] || []), "audit_logs"].map((key) =>
          cache.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
  });
}
export function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "Something went wrong. Please try again.";
}
export function useAllRows<K extends keyof Tables>(
  table: K,
  filters: Filter[] = [],
  enabled = true,
) {
  return useQuery({
    queryKey: [table, "all", filters],
    queryFn: () => allRows(table, filters),
    enabled: configured && enabled,
  });
}
