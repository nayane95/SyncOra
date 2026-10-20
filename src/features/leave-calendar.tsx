import { useState } from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import { useAllRows } from "../lib/api";
import { isWorkingDay, today } from "../lib/business";
import { ErrorState, Loading, Field } from "../components/shared";
export function LeaveCalendar() {
  const [month, setMonth] = useState(today().slice(0, 7));
  const base = parseISO(`${month}-01`),
    start = format(startOfMonth(base), "yyyy-MM-dd"),
    end = format(endOfMonth(base), "yyyy-MM-dd");
  const leaves = useAllRows("leave_requests", [
      { column: "status", value: "approved" },
      { column: "starts_on", op: "lte", value: end },
      { column: "ends_on", op: "gte", value: start },
    ]),
    holidays = useAllRows("holidays"),
    settings = useAllRows("working_calendar_settings");
  const days = eachDayOfInterval({
      start: parseISO(start),
      end: parseISO(end),
    }),
    cells: (Date | null)[] = [
      ...Array.from({ length: days[0].getDay() }, () => null),
      ...days,
    ];
  while (cells.length % 7) cells.push(null);
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Availability calendar</h2>
          <p className="muted">
            Approved leave only · counts include half days
          </p>
        </div>
        <Field label="Calendar month">
          <input
            type="month"
            value={month}
            onChange={(e) => {
              if (/^\d{4}-\d{2}$/.test(e.target.value))
                setMonth(e.target.value);
            }}
          />
        </Field>
      </div>
      {leaves.isPending ? (
        <Loading />
      ) : leaves.error||holidays.error||settings.error ? (
        <ErrorState error={leaves.error||holidays.error||settings.error} />
      ) : (
        <div className="calendar-wrap">
          <table className="leave-calendar">
            <caption className="sr-only">
              Approved leave in {format(base, "MMMM yyyy")}
            </caption>
            <thead>
              <tr>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <th scope="col" key={d}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: cells.length / 7 }, (_, week) => (
                <tr key={week}>
                  {cells.slice(week * 7, week * 7 + 7).map((d, i) => {
                    if (!d) return <td key={i} />;
                    const date = format(d, "yyyy-MM-dd"),
                      away = leaves.data
                        .filter((l) => l.starts_on <= date && l.ends_on >= date)
                        .reduce((n, l) => n + (l.half_day ? 0.5 : 1), 0),
                      working = isWorkingDay(
                        date,
                        settings.data?.[0]?.working_days,
                        holidays.data?.map((h) => h.holiday_date),
                      );
                    return (
                      <td className={working ? "" : "nonworking"} key={date}>
                        <time dateTime={date}>{d.getDate()}</time>
                        {working && away > 0 && (
                          <span aria-label={`${away} approved leave days`}>
                            {away} away
                          </span>
                        )}
                        {holidays.data?.some(
                          (h) => h.holiday_date === date,
                        ) && <small>Holiday</small>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
