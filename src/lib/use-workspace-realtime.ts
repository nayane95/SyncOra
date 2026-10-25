import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";

const tables = [
  "tasks",
  "task_comments",
  "task_status_history",
  "task_assignees",
  "standup_sessions",
  "standup_assignments",
  "daily_work_logs",
  "daily_task_updates",
  "leave_requests",
] as const;

export function useWorkspaceRealtime(userId?: string) {
  const cache = useQueryClient();
  useEffect(() => {
    if (!supabase || !userId) return;
    const channel = supabase.channel(`workspace:${userId}`);
    const refresh = (table: string) =>
      cache.invalidateQueries({ queryKey: [table] });
    for (const table of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          void refresh(table);
          if (table === "tasks") void refresh("task_status_history");
        },
      );
    }
    channel.subscribe((status) => {
      // Reconnects do not replay changes missed while disconnected.
      if (status === "SUBSCRIBED")
        for (const table of tables) void refresh(table);
    });
    return () => {
      void supabase!.removeChannel(channel);
    };
  }, [userId, cache]);
}
