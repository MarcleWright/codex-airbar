import * as React from "react";
import { cn } from "../../lib/utils";

type ButtonVariant = "default" | "secondary" | "ghost" | "destructive";
type ButtonSize = "default" | "icon" | "sm";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variants: Record<ButtonVariant, string> = {
  default: "text-foreground active:bg-primary/15",
  secondary: "text-secondary-foreground active:bg-secondary",
  ghost: "text-foreground active:bg-accent active:text-accent-foreground",
  destructive: "text-destructive active:bg-destructive/15"
};

const sizes: Record<ButtonSize, string> = {
  default: "h-8 px-2.5 text-[12px]",
  sm: "h-7 px-2 text-[11px]",
  icon: "h-7 w-7"
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
