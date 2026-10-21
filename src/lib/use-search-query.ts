import { useEffect, useState } from "react";
export function useSearchQuery(value: string) {
  const [query, setQuery] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(value.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [value]);
  return query;
}
