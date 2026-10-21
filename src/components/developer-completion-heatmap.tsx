import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { useAllRows } from "../lib/api";
import { completionHeatmap } from "../lib/completion-heatmap";
import { useBusinessDate } from "../lib/use-business-date";
import { dateLabel } from "../lib/business";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { ErrorState, Loading } from "./shared";

export function DeveloperCompletionHeatmap({
  developerId,
  name,
}: {
  developerId: string;
  name: string;
}) {
  const today = useBusinessDate();
  const scroll = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const tasks = useAllRows("tasks");
  const history = useAllRows("task_status_history");
  useEffect(() => {
    if (scroll.current) scroll.current.scrollLeft = scroll.current.scrollWidth;
  }, [tasks.isPending, history.isPending, today]);
  const days = completionHeatmap(
    developerId,
    today,
    tasks.data || [],
    history.data || [],
  );
  const active = days.filter((day) => day.included && day.count);
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const current = days.find((day) => day.date === (selected || today));
  return (
    <Card
      className="completion-heatmap panel padded"
      aria-label={`Task completions for ${name}`}
    >
      <div className="completion-heatmap-heading">
        <div>
          <h2>Task completions</h2>
          <p className="muted">{name} · past 12 months</p>
        </div>
        {!tasks.isPending &&
          !history.isPending &&
          !tasks.error &&
          !history.error && (
            <p>
              <strong>{total}</strong>{" "}
              {total === 1 ? "completion" : "completions"} · {active.length}{" "}
              active {active.length === 1 ? "day" : "days"}
            </p>
          )}
      </div>
      {tasks.isPending || history.isPending ? (
        <Loading />
      ) : tasks.error || history.error ? (
        <ErrorState error={tasks.error || history.error} />
      ) : (
        <>
          <div
            ref={scroll}
            className="completion-heatmap-scroll"
            tabIndex={0}
            role="region"
            aria-label="Daily completion chart; scroll horizontally to explore the year"
          >
            <div className="completion-heatmap-months" aria-hidden="true">
              {days
                .filter((_, index) => index % 7 === 0)
                .map((day, index, weeks) => (
                  <span key={day.date}>
                    {index === 0 ||
                    day.date.slice(0, 7) !== weeks[index - 1].date.slice(0, 7)
                      ? format(parseISO(day.date), "MMM")
                      : ""}
                  </span>
                ))}
            </div>
            <div
              className="completion-heatmap-grid"
              role="group"
              aria-label="Daily completed tasks, Monday to Sunday in each column"
            >
              {days.map((day) =>
                day.included ? (
                  <Button
                    key={day.date}
                    variant="ghost"
                    className="completion-heatmap-day"
                    data-level={Math.min(day.count, 4)}
                    aria-label={`${dateLabel(day.date)}: ${day.count} completed task${day.count === 1 ? "" : "s"}`}
                    title={`${dateLabel(day.date)} · ${day.count} completed tasks`}
                    tabIndex={day.date === (selected || today) ? 0 : -1}
                    onKeyDown={(event) => {
                      const step = {
                        ArrowLeft: -7,
                        ArrowRight: 7,
                        ArrowUp: -1,
                        ArrowDown: 1,
                      }[event.key];
                      if (step === undefined) return;
                      event.preventDefault();
                      const cells = Array.from(
                        event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                          "button",
                        ),
                      );
                      cells[
                        Math.max(
                          0,
                          Math.min(
                            cells.length - 1,
                            cells.indexOf(event.currentTarget) + step,
                          ),
                        )
                      ]?.focus();
                    }}
                    onFocus={() => setSelected(day.date)}
                    onMouseEnter={() => setSelected(day.date)}
                    onClick={() => setSelected(day.date)}
                  />
                ) : (
                  <span key={day.date} />
                ),
              )}
            </div>
          </div>
          <div className="completion-heatmap-footer">
            <p aria-live="polite">
              {dateLabel(current?.date || today)} · {current?.count || 0}{" "}
              completed {current?.count === 1 ? "task" : "tasks"}
            </p>
            <div
              className="completion-heatmap-legend"
              aria-label="Color intensity increases from zero to four or more completions"
            >
              <span>Less</span>
              {[0, 1, 2, 3, 4].map((level) => (
                <i key={level} data-level={level} />
              ))}
              <span>More</span>
            </div>
          </div>
          <p className="completion-heatmap-note muted">
            Counted by owner at completion, once per task per day. Completions
            show activity, not hours worked.
          </p>
        </>
      )}
    </Card>
  );
}
