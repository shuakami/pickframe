"use client";
 
import * as React from "react";
import { cn } from "@/lib/utils";
 
/**
 * Display a page name that may contain "/" or "›" / ">" separators
 * as a hierarchical breadcrumb. The leaf segment uses the normal text
 * colour, ancestors are rendered in --fg-subtle.
 *
 *   "内页/错题解析" → 内页 › 错题解析
 *   "Home"        → Home
 */
export function PageLabel({
 name,
 className,
 separator = "›",
 leafClassName,
 ancestorClassName,
}: {
 name: string;
 className?: string;
 separator?: string;
 leafClassName?: string;
 ancestorClassName?: string;
}) {
 const parts = name
    .split(/\s*[\/›>]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
 if (parts.length <= 1) {
 return <span className={cn("truncate", className)}>{name}</span>;
  }
 const leaf = parts[parts.length - 1];
 const ancestors = parts.slice(0, -1);
 return (
    <span className={cn("truncate inline-flex items-center gap-1", className)}>
      {ancestors.map((a, i) => (
        <React.Fragment key={i}>
          <span
 className={cn(
 "text-[var(--fg-subtle)]",
              ancestorClassName,
            )}
          >
            {a}
          </span>
          <span className="text-[var(--fg-subtle)] opacity-70" aria-hidden>
            {separator}
          </span>
        </React.Fragment>
      ))}
      <span className={cn("truncate", leafClassName)}>{leaf}</span>
    </span>
  );
}
