import * as React from "react";
import { cn } from "../../lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex h-4 items-center rounded-full bg-secondary px-1.5 text-[10px] font-medium capitalize leading-none text-secondary-foreground",
        className
      )}
      {...props}
    />
  );
}
