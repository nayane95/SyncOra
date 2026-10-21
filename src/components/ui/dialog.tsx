import type { ReactNode } from "react";
import {
  Dialog as DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./dialog-primitives";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./sheet";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  side?: boolean;
}) {
  const caption =
    description ||
    "Complete the fields below. Changes are saved only when you confirm.";
  if (side)
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="task-detail-sheet">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{caption}</SheetDescription>
          </SheetHeader>
          <div className="sheet-body">{children}</div>
        </SheetContent>
      </Sheet>
    );
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent className="workspace-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{caption}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </DialogRoot>
  );
}
