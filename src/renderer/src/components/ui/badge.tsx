import * as React from "react";
import { cn } from "../../lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full bg-secondary px-2 text-[11px] font-medium capitalize text-secondary-foreground",
        className
      )}
      {...props}
    />
  );
}
