"use client";
 
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useToastStore } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, X, Loader2 } from "lucide-react";
 
export function ToastHost() {
 const toasts = useToastStore((s) => s.toasts);
 const dismiss = useToastStore((s) => s.dismiss);
 
 return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[80] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
 const isSuccess = t.tone === "success";
 const isDanger = t.tone === "danger";
 const isProgress = t.sticky === true && !isSuccess && !isDanger;
 const progress = typeof t.progress === "number" ? Math.max(0, Math.min(1, t.progress)) : null;
 return (
            <motion.div
 key={t.id}
 layout
 initial={{ opacity: 0, y: 8, scale: 0.96 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: 6, scale: 0.96 }}
 transition={{ duration: 0.16, ease: [0.2, 0.7, 0.2, 1] }}
 className={cn(
 "pointer-events-auto",
 "min-w-[260px] max-w-[420px]",
 "flex items-start gap-2.5 px-3.5 py-2.5",
 "bg-[var(--surface)] border border-[var(--border)]",
 "rounded-[var(--radius-md)] shadow-[var(--shadow-pop)]",
              )}
            >
              <span
 className={cn(
 "shrink-0 mt-0.5",
                  isSuccess && "text-[var(--brand)]",
                  isDanger && "text-[var(--danger)]",
 !isSuccess && !isDanger && "text-[var(--fg-subtle)]",
                )}
              >
                {isDanger ? (
                  <AlertCircle size={14} />
                ) : isProgress ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium leading-[1.4] text-[var(--fg)]">
                  {t.title}
                </div>
                {t.description && (
                  <div className="text-[11.5px] leading-[1.5] text-[var(--fg-muted)] mt-0.5">
                    {t.description}
                  </div>
                )}
                {progress !== null && (
                  <div className="mt-1.5 h-[3px] rounded-full bg-[var(--bg-soft)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--brand)] transition-[width] duration-150"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                )}
              </div>
              <button
 onClick={() => dismiss(t.id)}
 className="shrink-0 grid place-items-center h-5 w-5 rounded-[var(--radius-sm)] text-[var(--fg-subtle)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]"
 aria-label="Dismiss"
              >
                <X size={11} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
