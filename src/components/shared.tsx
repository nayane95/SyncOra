import { cloneElement, isValidElement, useId, type ReactNode } from "react";
import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import { Button } from "./ui/button";
import { label } from "../lib/business";
import { message } from "../lib/api";
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow || "Team workspace"}</p>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      <div className="toolbar">{actions}</div>
    </div>
  );
}
export function Empty({
  title = "Nothing here yet",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Inbox aria-hidden="true" size={26} />
      <h3>{title}</h3>
      <p className="muted">
        {children || "Records will appear here when they are added."}
      </p>
    </div>
  );
}
export function Loading() {
  return (
    <div className="empty" role="status">
      <LoaderCircle className="spin" size={24} />
      Loading workspace…
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="error" role="alert">
      <AlertCircle size={19} />
      <div>
        {message(error)}
        {retry && (
          <Button variant="secondary" onClick={retry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
export function Badge({ value }: { value: string }) {
  return <span className={`badge badge-${value}`}>{label(value)}</span>;
}
export function Avatar({ name }: { name: string }) {
  return (
    <span className="avatar" aria-hidden="true">
      {name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()}
    </span>
  );
}
export function Field({
  label: labelText,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  const id = useId();
  const control = isValidElement<{
    "aria-labelledby"?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>(children)
    ? cloneElement(children, {
        "aria-labelledby": id,
        "aria-describedby": error ? `${id}-error` : undefined,
        "aria-invalid": !!error,
      })
    : children;
  return (
    <label className="field">
      <span id={id}>{labelText}</span>
      {control}
      {error && (
        <span id={`${id}-error`} className="field-error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
export function Metrics({
  items,
}: {
  items: { label: string; value: number | string; note?: string }[];
}) {
  return (
    <div className="metrics">
      {items.map((i) => (
        <div className="metric" key={i.label}>
          <p className="muted">{i.label}</p>
          <strong>{i.value}</strong>
          {i.note && <small>{i.note}</small>}
        </div>
      ))}
    </div>
  );
}
export function Pager({
  page,
  setPage,
  count,
}: {
  page: number;
  setPage: (page: number) => void;
  count: number;
}) {
  return (
    <div className="pager">
      <Button
        variant="secondary"
        disabled={!page}
        onClick={() => setPage(page - 1)}
      >
        Previous
      </Button>
      <span>Page {page + 1}</span>
      <Button
        variant="secondary"
        disabled={count < 100}
        onClick={() => setPage(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}
