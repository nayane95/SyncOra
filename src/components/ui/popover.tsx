import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { cn } from "../../lib/utils";
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;
export function PopoverContent({
  className,
  onEscapeKeyDown,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className={cn("app-popover", className)}
        {...props}
        onEscapeKeyDown={(event) => {
          if (document.querySelector(".app-select__menu"))
            event.preventDefault();
          onEscapeKeyDown?.(event);
        }}
      />
    </PopoverPrimitive.Portal>
  );
}
