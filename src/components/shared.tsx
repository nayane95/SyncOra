import { gsap } from "gsap";
import { useLayoutEffect, useRef } from "react";
import { Skeleton } from "./ui/skeleton";
import { Badge as StatusBadge } from "./ui/badge";
import { Avatar as UserAvatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Alert } from "./ui/alert";
import { Card } from "./ui/card";
import { Label } from "./ui/label";
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
  const heading = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(heading.current, {
        y: 8,
        duration: 0.32,
        ease: "power2.out",
        clearProps: "transform",
      });
    });
    return () => media.revert();
  }, [title]);
  return (
    <div ref={heading} className="page-heading">
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
      <div className="loading-lines" aria-hidden="true">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
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
    <Alert variant="destructive" className="error">
      <AlertCircle size={19} />
      <div>
        {message(error)}
        {retry && (
          <Button variant="secondary" onClick={retry}>
            Try again
          </Button>
        )}
      </div>
    </Alert>
  );
}
export function Badge({ value }: { value: string }) {
  return (
    <StatusBadge variant="outline" className={`badge badge-${value}`}>
      {label(value)}
    </StatusBadge>
  );
}
const identityTones = ["violet", "blue", "rose", "cyan"] as const;
export function ProjectTag({ id, name }: { id: string; name: string }) {
  const tone =
    identityTones[(id.charCodeAt(id.length - 1) || 0) % identityTones.length];
  return (
    <StatusBadge variant="secondary" className={`project-tag tone-${tone}`}>
      {name}
    </StatusBadge>
  );
}
export function Avatar({ name, src }: { name: string; src?: string }) {
  return (
    <UserAvatar
      className={`avatar tone-${identityTones[(name.charCodeAt(0) || 0) % identityTones.length]}`}
      aria-hidden="true"
    >
      {src?.startsWith("https://") && (
        <AvatarImage
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          className="object-cover"
        />
      )}
      <AvatarFallback>
        {name
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()}
      </AvatarFallback>
    </UserAvatar>
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
    <Label className="field">
      <span id={id}>{labelText}</span>
      {control}
      {error && (
        <span id={`${id}-error`} className="field-error" role="alert">
          {error}
        </span>
      )}
    </Label>
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
        <Card className="metric" key={i.label}>
          <p className="muted">{i.label}</p>
          <strong>{i.value}</strong>
          {i.note && <small>{i.note}</small>}
        </Card>
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
