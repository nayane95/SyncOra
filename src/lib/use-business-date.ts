import { useEffect, useState } from "react";
import { today } from "./business";
import { dayBounds } from "./task-calendar";
export function useBusinessDate() {
  const [date, setDate] = useState(today);
  useEffect(() => {
    const refresh = () => setDate(today());
    const timer = window.setTimeout(
      refresh,
      Math.max(25, Date.parse(dayBounds(date)[1]) - Date.now() + 25),
    );
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [date]);
  return date;
}
