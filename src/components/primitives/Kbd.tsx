import * as React from "react";
import { cn } from "@/lib/utils";
 
export function Kbd({
 children,
 className,
}: {
 children: React.ReactNode;
 className?: string;
}) {
 return (
    <kbd
 className={cn(
 "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1",
 "rounded-[5px] border border-[var(--border)]",
 "bg-[var(--surface)] text-[var(--fg-subtle)]",
 "font-mono text-[10.5px] leading-none",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
