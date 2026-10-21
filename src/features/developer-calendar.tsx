import { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  addMonths,
  addDays,
  parse,
  getDay,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  Calendar,
  dateFnsLocalizer,
  type EventProps,
  type EventWrapperProps,
} from "react-big-calendar";
import { enGB } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { ChevronLeft, ChevronRight, Plus, ArrowUpRight } from "lucide-react";
import { useAuth } from "../app/auth";
import { useAllRows } from "../lib/api";
import { dateLabel, localDate } from "../lib/business";
import {
  calendarTasks,
  daysInProgress,
  progressDaysLabel,
} from "../lib/task-calendar";
import { useBusinessDate } from "../lib/use-business-date";
import type { Task } from "../types/database";
import {
  Badge,
  Empty,
  ErrorState,
  Field,
  Loading,
  PageHeader,
  ProjectTag,
} from "../components/shared";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "../components/ui/sheet";
import { TaskDetail, TaskEditor } from "./tasks";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { "en-GB": enGB },
});
type CalendarTaskEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  date: string;
  status: string;
  task: Task;
};
function TaskCalendarEvent({
  event,
  onOpen,
}: EventProps<CalendarTaskEvent> & { onOpen: (day: string) => void }) {
  return (
    <Button
      variant="ghost"
      className="calendar-event-caption calendar-event-button"
      aria-label={`${event.title} · ${dateLabel(event.date)}`}
      onClick={(click) => {
        click.stopPropagation();
        onOpen(event.date);
      }}
    >
      <i
        aria-hidden="true"
        className={`calendar-status-${event.status === "backlog" ? "planned" : event.status}`}
      />
      <span>
        SYNC-{event.task.task_number} · {event.title}
      </span>
    </Button>
  );
}
export function DeveloperTaskCalendar() {
  const { profile } = useAuth();
  const today = useBusinessDate();
  const returnFocus = useRef<HTMLElement | null>(null);
  const lastSelected = useRef(today);
  const [selected, setSelected] = useState<string | null>(null);
  const [chosenMonth, setChosenMonth] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Task>();
  const date = selected || today;
  const month = chosenMonth || today.slice(0, 7);
  const tasks = useAllRows("tasks", [
    { column: "assignee_id", op: "assigned", value: profile!.id },
  ]);
  const history = useAllRows(
    "task_status_history",
    [
      {
        column: "task_id",
        op: "in",
        value: tasks.data?.map((task) => task.id) || [],
      },
    ],
    !!tasks.data?.length,
  );
  const settings = useAllRows("working_calendar_settings");
  const holidays = useAllRows("holidays");
  const projects = useAllRows("projects");
  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(parseISO(`${month}-01`)), {
          weekStartsOn: 1,
        }),
        end: endOfWeek(endOfMonth(parseISO(`${month}-01`)), {
          weekStartsOn: 1,
        }),
      }).map((day) => format(day, "yyyy-MM-dd")),
    [month],
  );
  const records = useMemo(
    () =>
      new Map(
        days.map((day) => [
          day,
          calendarTasks(day, tasks.data || [], history.data || [], today),
        ]),
      ),
    [days, today, tasks.data, history.data],
  );
  const work =
    records.get(date) ||
    calendarTasks(date, tasks.data || [], history.data || [], today);
  const loading =
    tasks.isPending ||
    (!!tasks.data?.length && history.isPending) ||
    settings.isPending ||
    holidays.isPending;
  const error =
    tasks.error || history.error || settings.error || holidays.error;
  const openDay = useCallback((day: string) => {
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    lastSelected.current = day;
    setSelected(day);
  }, []);
  const events = useMemo(
    () =>
      [...records].flatMap(([day, entries]) =>
        entries.map(({ task, status }) => ({
          id: `${day}-${task.id}`,
          title: task.title,
          start: parseISO(day),
          end: addDays(parseISO(day), 1),
          date: day,
          status,
          task,
        })),
      ),
    [records],
  );
  const components = useMemo(
    () => ({
      eventWrapper: ({
        children,
      }: EventWrapperProps<CalendarTaskEvent> & {
        children?: React.ReactNode;
      }) => <div role="cell">{children}</div>,
      event: (props: EventProps<CalendarTaskEvent>) => (
        <TaskCalendarEvent {...props} onOpen={openDay} />
      ),
      month: {
        dateHeader: ({ date: dayDate }: { date: Date }) => {
          const day = format(dayDate, "yyyy-MM-dd");
          const count = records.get(day)?.length || 0;
          return (
            <Button
              variant="ghost"
              className="calendar-date-button"
              aria-current={day === today ? "date" : undefined}
              aria-label={`${dateLabel(day)}, ${count} task${count === 1 ? "" : "s"}`}
              onClick={(event) => {
                event.stopPropagation();
                openDay(day);
              }}
            >
              {Number(day.slice(-2))}
            </Button>
          );
        },
      },
    }),
    [records, today, openDay],
  );
  const changeMonth = (value: string) => {
    setChosenMonth(value);
    setSelected(null);
  };
  return (
    <>
      <PageHeader
        title="My tasks"
        description="Explore your task history by day. Unfinished tasks carry forward until they are completed or cancelled."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus size={17} />
            Add my task
          </Button>
        }
      />
      <Card className="panel task-calendar-panel">
        <div className="panel-heading task-calendar-toolbar">
          <div>
            <h2>{format(parseISO(`${month}-01`), "MMMM yyyy")}</h2>
            <p className="muted">
              Review past work or see unfinished tasks carried into upcoming
              days.
            </p>
          </div>
          <div className="toolbar">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous month"
              onClick={() =>
                changeMonth(
                  format(addMonths(parseISO(`${month}-01`), -1), "yyyy-MM"),
                )
              }
            >
              <ChevronLeft size={18} />
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSelected(null);
                setChosenMonth(null);
              }}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next month"
              onClick={() =>
                changeMonth(
                  format(addMonths(parseISO(`${month}-01`), 1), "yyyy-MM"),
                )
              }
            >
              <ChevronRight size={18} />
            </Button>
            <Field label="Task calendar month">
              <Input
                type="month"
                value={month}
                onChange={(e) => {
                  if (/^\d{4}-\d{2}$/.test(e.target.value))
                    changeMonth(e.target.value);
                }}
              />
            </Field>
          </div>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState error={error} />
        ) : (
          <Calendar<CalendarTaskEvent>
            className="developer-big-calendar"
            localizer={localizer}
            culture="en-GB"
            date={parseISO(`${month}-01`)}
            getNow={() => parseISO(today)}
            onNavigate={(next) => changeMonth(format(next, "yyyy-MM"))}
            view="month"
            views={["month"]}
            toolbar={false}
            events={events}
            allDayAccessor={() => true}
            components={components}
            formats={{ weekdayFormat: (day) => format(day, "EEE") }}
            selectable
            onSelectSlot={(slot) => openDay(format(slot.start, "yyyy-MM-dd"))}
            onSelectEvent={(event) => openDay(event.date)}
            onShowMore={(_events, day) => openDay(format(day, "yyyy-MM-dd"))}
            doShowMoreDrillDown={false}
            onDrillDown={(day) => openDay(format(day, "yyyy-MM-dd"))}
            dayPropGetter={(day) => ({
              className: `${format(day, "yyyy-MM-dd") === selected ? "calendar-selected-day" : ""} ${format(day, "yyyy-MM-dd") > today ? "calendar-future-day" : ""}`,
            })}
            eventPropGetter={(event) => ({
              className: `calendar-task-event calendar-event-${event.status}`,
            })}
          />
        )}
        <div className="task-calendar-legend">
          <span>
            <i className="calendar-status-planned" />
            To do
          </span>
          <span>
            <i className="calendar-status-in_progress" />
            In progress
          </span>
          <span>
            <i className="calendar-status-blocked" />
            Blocked
          </span>
          <span>
            <i className="calendar-status-completed" />
            Done
          </span>
        </div>
      </Card>
      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="day-task-sheet task-calendar-agenda"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = returnFocus.current;
            if (target?.isConnected && target !== document.body) target.focus();
            else
              document
                .querySelector<HTMLButtonElement>(
                  `[data-calendar-date="${lastSelected.current}"]`,
                )
                ?.focus();
          }}
        >
          <SheetHeader>
            <span className="day-sheet-grip" aria-hidden="true" />
            <SheetTitle>Tasks · {dateLabel(date)}</SheetTitle>
            <SheetDescription>
              {date === today
                ? "Today’s work. Use the board to update task progress."
                : date > today
                  ? "Planned carry-forward · unfinished tasks remain here until completed or cancelled. Future work has not been recorded yet."
                  : "Status at the end of this day · current task titles and details"}
            </SheetDescription>
            <Button variant="secondary" asChild>
              <Link to="/dashboard">
                Open today’s board
                <ArrowUpRight size={16} />
              </Link>
            </Button>
          </SheetHeader>
          <div className="day-task-sheet-body">
            {loading ? (
              <Loading />
            ) : error ? (
              <ErrorState error={error} />
            ) : work.length ? (
              <>
                <p className="task-calendar-explanation">
                  Days in progress counts configured workdays with recorded In
                  progress time, excluding weekends and holidays. It does not
                  represent hours worked.
                </p>
                <div className="task-calendar-records">
                  {work.map(({ task, status }) => {
                    const progress = daysInProgress(
                      task,
                      history.data || [],
                      date > today ? today : date,
                      settings.data?.[0]?.working_days,
                      holidays.data?.map((holiday) => holiday.holiday_date),
                    );
                    return (
                      <article key={task.id} className="task-calendar-record">
                        <div className="task-meta">
                          <span>SYNC-{task.task_number}</span>
                          {task.project_id && (
                            <ProjectTag
                              id={task.project_id}
                              name={
                                projects.data?.find(
                                  (project) => project.id === task.project_id,
                                )?.name || "Project"
                              }
                            />
                          )}
                        </div>
                        <div className="task-calendar-record-heading">
                          <Button
                            variant="ghost"
                            className="task-title"
                            onClick={() => setDetail(task)}
                          >
                            {task.title}
                          </Button>
                          <Badge
                            value={
                              status === "unknown"
                                ? "history_unavailable"
                                : status
                            }
                          />
                        </div>
                        <p className="task-day-meta">
                          <span>
                            Created {dateLabel(localDate(task.created_at))}
                          </span>
                          <span>{progressDaysLabel(progress)}</span>
                          {localDate(task.created_at) < date &&
                            !["completed", "cancelled", "unknown"].includes(
                              status,
                            ) && (
                              <span className="task-carried-label">
                                {date > today
                                  ? "Planned carry-forward"
                                  : "Carried forward"}
                              </span>
                            )}
                        </p>
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <Empty title="No tasks for this day">
                Tasks appear from their creation or scheduled start date.
                Unfinished work carries into each following day.
              </Empty>
            )}
          </div>
        </SheetContent>
      </Sheet>
      {creating && <TaskEditor open onClose={() => setCreating(false)} />}
      {detail && (
        <TaskDetail
          task={detail}
          contextDate={date}
          onClose={() => setDetail(undefined)}
        />
      )}
    </>
  );
}
