"use client";
 
import * as React from "react";
import { cn } from "@/lib/utils";
 
interface PillProps extends React.HTMLAttributes<HTMLDivElement> {
 color?: string;
 size?: "sm" | "md";
 variant?: "soft" | "solid" | "outline";
 removable?: boolean;
 onRemove?: () => void;
}
 
export const Pill = React.forwardRef<HTMLDivElement, PillProps>(function Pill(
  {
 className,
 color,
 size = "sm",
 variant = "soft",
 removable,
 onRemove,
 children,
 style,
 ...props
  },
 ref,
) {
 return (
    <div
 ref={ref}
 className={cn(
 "inline-flex items-center gap-1.5 font-medium select-none",
        size === "sm" ? "h-6 px-2 text-[11.5px]" : "h-7 px-2.5 text-[12.5px]",
 "rounded-[var(--radius-pill)]",
        variant === "soft" &&
 "bg-[var(--bg-soft)] text-[var(--fg-muted)] border border-[var(--border)]",
        variant === "solid" && "text-white",
        variant === "outline" &&
 "bg-transparent text-[var(--fg-muted)] border border-[var(--border)]",
        className,
      )}
 style={{
 ...(variant === "solid" && color ? { background: color } : null),
 ...style,
      }}
      {...props}
    >
      {color && variant !== "solid" && (
        <span
 className="dot shrink-0"
 style={{ background: color }}
 aria-hidden
        />
      )}
      <span className="truncate">{children}</span>
      {removable && (
        <button
 type="button"
 onClick={(e) => {
            e.stopPropagation();
 onRemove?.();
          }}
 className="ml-0.5 -mr-0.5 grid place-items-center w-4 h-4 rounded-full hover:bg-[var(--border)] text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
 aria-label="Remove"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
 d="M2 2L8 8M8 2L2 8"
 stroke="currentColor"
 strokeWidth="1.5"
 strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
});
