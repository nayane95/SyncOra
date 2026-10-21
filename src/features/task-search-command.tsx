import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { Search, ArrowUpRight } from "lucide-react";
import { Dialog } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Badge, ErrorState } from "../components/shared";
import { useTaskSearch, type Filter } from "../lib/api";
import { useSearchQuery } from "../lib/use-search-query";
import type { Task } from "../types/database";
export function TaskSearchCommand({
  filters,
  onApply,
  onTask,
}: {
  filters: Filter[];
  onApply: (query: string) => void;
  onTask: (task: Task) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const query = useSearchQuery(value);
  const results = useTaskSearch(query, filters, 0, 10, open);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, []);
  return (
    <>
      <Button
        variant="secondary"
        className="task-search-shortcut"
        aria-label="Open task search"
        onClick={() => setOpen(true)}
      >
        <Search size={16} />
        <span>Quick search</span>
        <kbd>⌘ K</kbd>
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Search tasks"
        description="Search by task ID, keywords or a partial title. Current register filters apply."
      >
        <Command
          shouldFilter={false}
          label="Search task keywords"
          className="task-command"
        >
          <Command.Input
            autoFocus
            value={value}
            onValueChange={setValue}
            maxLength={200}
            placeholder="Try SYNC-25 or authentication…"
            aria-label="Search task keywords"
          />
          <Command.List aria-label="Matching tasks">
            {results.isPending || value.trim() !== query ? (
              <p role="status">Searching…</p>
            ) : results.error ? (
              <ErrorState error={results.error} />
            ) : (
              <>
                <Command.Item
                  value="apply-query"
                  onSelect={() => {
                    onApply(query);
                    setOpen(false);
                  }}
                >
                  <Search size={16} />
                  <span>
                    Show {results.data?.total || 0} matching tasks in the
                    register
                  </span>
                  <ArrowUpRight size={16} />
                </Command.Item>
                {results.data?.items.map((task) => (
                  <Command.Item
                    key={task.id}
                    value={task.id}
                    onSelect={() => {
                      onTask(task);
                      setOpen(false);
                    }}
                  >
                    <span className="task-command-result">
                      <small>SYNC-{task.task_number}</small>
                      <strong>{task.title}</strong>
                    </span>
                    <Badge value={task.status} />
                  </Command.Item>
                ))}
                {!results.data?.total && (
                  <p>
                    No matching tasks. Try fewer words or change the filters.
                  </p>
                )}
              </>
            )}
          </Command.List>
          <p className="task-command-help">
            ↑ ↓ to navigate · Enter to open · Esc to close
          </p>
        </Command>
      </Dialog>
    </>
  );
}
