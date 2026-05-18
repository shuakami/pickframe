"use client";
 
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
 
type Variant = "default" | "ghost" | "outline" | "brand" | "danger";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";
 
const VARIANT_CLASSES: Record<Variant, string> = {
  default:
 "bg-[var(--surface)] text-[var(--fg)] border border-[var(--border)] hover:bg-[var(--bg-soft)] hover:border-[var(--border-strong)]",
  ghost:
 "text-[var(--fg-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)] border border-transparent",
  outline:
 "bg-transparent text-[var(--fg)] border border-[var(--border)] hover:bg-[var(--bg-soft)] hover:border-[var(--border-strong)]",
  brand:
 "bg-[var(--brand)] text-[var(--brand-fg)] border border-transparent hover:opacity-90",
  danger:
 "bg-transparent text-[var(--danger)] border border-transparent hover:bg-[color-mix(in_srgb,var(--danger)_8%,transparent)]",
};
 
const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[12px] gap-1.5 rounded-[var(--radius-md)]",
  md: "h-8 px-3 text-[13px] gap-1.5 rounded-[var(--radius-md)]",
  lg: "h-10 px-4 text-[14px] gap-2 rounded-[var(--radius-lg)]",
  icon: "h-8 w-8 rounded-[var(--radius-md)] grid place-items-center",
 "icon-sm": "h-7 w-7 rounded-[var(--radius-md)] grid place-items-center",
};
 
export interface ButtonProps
 extends React.ButtonHTMLAttributes<HTMLButtonElement> {
 variant?: Variant;
 size?: Size;
 asChild?: boolean;
 active?: boolean;
}
 
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
 function Button(
    {
 className,
 variant = "default",
 size = "md",
 asChild,
 active,
 ...props
    },
 ref,
  ) {
 const Comp = asChild ? Slot : "button";
 return (
      <Comp
 ref={ref}
 className={cn(
 "inline-flex items-center justify-center font-medium transition-all duration-150 select-none focus-ring",
 "disabled:opacity-40 disabled:cursor-not-allowed",
 VARIANT_CLASSES[variant],
 SIZE_CLASSES[size],
          active &&
 "bg-[var(--bg-soft)] text-[var(--fg)] border-[var(--border-strong)]",
          className,
        )}
        {...props}
      />
    );
  },
);
