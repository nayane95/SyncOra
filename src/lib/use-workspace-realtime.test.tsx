import { renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useWorkspaceRealtime } from "./use-workspace-realtime";

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, () => void>();
  const channel = {
    on: vi.fn((_event, filter, callback) => {
      handlers.set(filter.table, callback);
      return channel;
    }),
    subscribe: vi.fn(),
  };
  return {
    handlers,
    channel,
    invalidateQueries: vi.fn(),
    removeChannel: vi.fn(),
    createChannel: vi.fn(() => channel),
  };
});
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));
vi.mock("./supabase", () => ({
  supabase: {
    channel: mocks.createChannel,
    removeChannel: mocks.removeChannel,
  },
}));

it("refreshes remote conversations and activity, catches up on reconnect and removes the old user's channel", () => {
  const { rerender, unmount } = renderHook(
    ({ userId }: { userId?: string }) => useWorkspaceRealtime(userId),
    { initialProps: { userId: undefined as string | undefined } },
  );
  expect(mocks.createChannel).not.toHaveBeenCalled();
  rerender({ userId: "reader" });
  expect(mocks.createChannel).toHaveBeenCalledWith("workspace:reader");
  for (const table of [
    "task_comments",
    "standup_sessions",
    "daily_task_updates",
    "task_status_history",
  ]) {
    mocks.handlers.get(table)!();
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: [table] });
  }
  mocks.invalidateQueries.mockClear();
  const subscribed = mocks.channel.subscribe.mock.calls[0][0];
  subscribed("CHANNEL_ERROR");
  expect(mocks.invalidateQueries).not.toHaveBeenCalled();
  subscribed("SUBSCRIBED");
  expect(mocks.invalidateQueries).toHaveBeenCalledTimes(mocks.handlers.size);
  rerender({ userId: "another-reader" });
  expect(mocks.removeChannel).toHaveBeenCalledTimes(1);
  unmount();
  expect(mocks.removeChannel).toHaveBeenCalledTimes(2);
});
