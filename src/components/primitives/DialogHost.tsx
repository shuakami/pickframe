"use client";
 
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { useDialogStore } from "@/lib/ui";
import { Button } from "./Button";
import { cn } from "@/lib/utils";
 
const EASE = [0.2, 0.7, 0.2, 1] as const;
 
export function DialogHost() {
 const queue = useDialogStore((s) => s.queue);
 const resolveTop = useDialogStore((s) => s.resolveTop);
 const top = queue[0];
 
 const [draft, setDraft] = React.useState("");
 const [lastId, setLastId] = React.useState<string | null>(null);
 const inputRef = React.useRef<HTMLInputElement>(null);
 
 if (top && top.id !== lastId) {
 setLastId(top.id);
 setDraft(top.kind === "prompt" ? (top.opts.defaultValue ?? "") : "");
  }
 
  React.useEffect(() => {
 if (top?.kind === "prompt") {
 const t = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
 return () => clearTimeout(t);
    }
  }, [top]);
 
 const cancel = React.useCallback(() => {
 if (!top) return;
 resolveTop(top.kind === "prompt" ? null : false);
  }, [resolveTop, top]);
 
 const confirm = () => {
 if (!top) return;
 resolveTop(top.kind === "prompt" ? draft.trim() : true);
  };
 
 const isPrompt = top?.kind === "prompt";
 const opts = top?.opts;
 const danger = top?.kind === "confirm" && top.opts.danger;
 
 return (
    <Dialog.Root
 open={!!top}
 onOpenChange={(o) => {
 if (!o) cancel();
      }}
    >
      <AnimatePresence>
        {top && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
 className="fixed inset-0 z-[60] backdrop-blur-[1px]"
 style={{ background: "var(--scrim)" }}
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.14, ease: EASE }}
              />
            </Dialog.Overlay>
            <Dialog.Content
 asChild
 forceMount
 onKeyDown={(e) => {
 if (e.key === "Enter" && isPrompt) {
                  e.preventDefault();
 confirm();
                }
              }}
            >
              <motion.div
 key={top.id}
 initial={{ opacity: 0, y: 6, scale: 0.985 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: 4, scale: 0.985 }}
 transition={{ duration: 0.16, ease: EASE }}
 className={cn(
 "fixed left-1/2 top-[28%] z-[70] -translate-x-1/2 w-[min(92vw,420px)]",
 "bg-[var(--surface)] border border-[var(--border)]",
 "rounded-[var(--radius-lg)] shadow-[var(--shadow-modal)]",
 "outline-none",
                )}
              >
                <div className="px-5 pt-5 pb-1">
                  <Dialog.Title className="text-[15px] font-semibold tracking-tight text-[var(--fg)]">
                    {opts?.title}
                  </Dialog.Title>
                  {opts?.description && (
                    <Dialog.Description className="mt-1.5 text-[13px] leading-[1.55] text-[var(--fg-muted)]">
                      {opts.description}
                    </Dialog.Description>
                  )}
                </div>
                {isPrompt && (
                  <div className="px-5 pt-3">
                    <input
 ref={inputRef}
 value={draft}
 onChange={(e) => setDraft(e.target.value)}
 placeholder={
                        (opts as { placeholder?: string } | undefined)
                          ?.placeholder
                      }
 className={cn(
 "w-full h-9 px-2.5 text-[13.5px] bg-[var(--bg-soft)]",
 "border border-[var(--border)] rounded-[var(--radius-md)]",
 "outline-none focus:border-[var(--brand)]",
 "placeholder:text-[var(--fg-subtle)]",
                      )}
                    />
                  </div>
                )}
                <div className="px-5 py-4 mt-2 flex items-center justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={cancel}>
                    {opts?.cancelLabel ?? "Cancel"}
                  </Button>
                  <Button
 size="sm"
 variant={danger ? "danger" : "brand"}
 onClick={confirm}
 className={
                      danger
 ? "bg-[var(--danger)] text-white border border-transparent hover:opacity-90"
 : undefined
                    }
                  >
                    {opts?.confirmLabel ?? (danger ? "Delete" : "OK")}
                  </Button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
