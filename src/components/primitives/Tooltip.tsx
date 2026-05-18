"use client";
 
import * as React from "react";
import * as RT from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";
 
export function TooltipProvider({ children }: { children: React.ReactNode }) {
 return (
    <RT.Provider delayDuration={250} skipDelayDuration={150}>
      {children}
    </RT.Provider>
  );
}
 
interface TooltipProps {
 content: React.ReactNode;
 children: React.ReactNode;
 side?: "top" | "right" | "bottom" | "left";
 align?: "start" | "center" | "end";
 shortcut?: string;
}
 
export function Tooltip({
 content,
 children,
 side = "top",
 align = "center",
 shortcut,
}: TooltipProps) {
 return (
    <RT.Root>
      <RT.Trigger asChild>{children}</RT.Trigger>
      <RT.Portal>
        <RT.Content
 side={side}
 align={align}
 sideOffset={6}
 className={cn(
 "z-50 px-2 py-1 text-[11.5px] font-medium leading-none",
 "rounded-md",
 "bg-[var(--fg)] text-[var(--bg)]",
 "shadow-[var(--shadow-2)]",
 "data-[state=delayed-open]:rise-in",
 "flex items-center gap-2",
          )}
        >
          <span>{content}</span>
          {shortcut && (
            <kbd className="text-[10.5px] opacity-70 font-mono">{shortcut}</kbd>
          )}
        </RT.Content>
      </RT.Portal>
    </RT.Root>
  );
}
