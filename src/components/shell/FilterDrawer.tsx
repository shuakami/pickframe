"use client";
 
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { Button } from "../primitives/Button";
import { cn } from "@/lib/utils";
import {
  VERDICT_COLOR,
  VERDICT_LABEL,
 type Verdict,
  VERDICTS,
} from "@/lib/types";
import { Star } from "lucide-react";
 
export function FilterDrawer() {
 const open = useStore((s) => s.filterOpen);
 const setOpen = useStore((s) => s.setFilterOpen);
 const filter = useStore((s) => s.filter);
 const setFilter = useStore((s) => s.setFilter);
 const resetFilter = useStore((s) => s.resetFilter);
 const tags = useStore((s) => s.tags);
 const pages = useStore((s) => s.pages);
 const activeProjectId = useStore((s) => s.activeProjectId);
 
 const projectTags = tags.filter((t) => t.projectId === activeProjectId);
 const projectPages = pages
    .filter((p) => p.projectId === activeProjectId)
    .sort((a, b) => a.order - b.order);
 
 const ease = [0.2, 0.7, 0.2, 1] as const;
 return (
    <AnimatePresence>
      {open && (
        <Dialog.Root open onOpenChange={setOpen} modal>
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.14, ease }}
 className="fixed inset-0 z-40 backdrop-blur-sm"
 style={{ background: "var(--scrim-light)" }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
 initial={{ opacity: 0, x: 16 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, x: 16 }}
 transition={{ duration: 0.18, ease }}
 className={cn(
 "fixed right-3 top-3 bottom-3 z-50 w-[360px]",
 "bg-[var(--surface)] border border-[var(--border)]",
 "rounded-[var(--radius-lg)] shadow-[var(--shadow-modal)] flex flex-col",
                )}
              >
          <div className="flex items-center justify-between h-11 px-4 border-b border-[var(--border)]">
            <Dialog.Title className="text-[14px] font-semibold tracking-tight">
              Filters
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Filter design versions
            </Dialog.Description>
            <button
 onClick={resetFilter}
 className="text-[11.5px] text-[var(--fg-subtle)] hover:text-[var(--fg)]"
            >
              Reset
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
            <FilterField label="Pages">
              <div className="flex flex-wrap gap-1.5">
                {projectPages.length === 0 && (
                  <span className="text-[11.5px] text-[var(--fg-subtle)]">
                    No pages
                  </span>
                )}
                {projectPages.map((p) => {
 const active = filter.pageIds?.includes(p.id);
 return (
                    <button
 key={p.id}
 onClick={() => {
 const cur = filter.pageIds ?? [];
 const next = cur.includes(p.id)
 ? cur.filter((x) => x !== p.id)
 : [...cur, p.id];
 setFilter({
                          pageIds: next.length ? next : undefined,
                        });
                      }}
 className={cn(
 "h-7 px-2.5 rounded-[var(--radius-pill)] text-[11.5px] border",
                        active
 ? "bg-[var(--brand)] border-[var(--brand)] text-[var(--brand-fg)]"
 : "bg-transparent border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--border)] hover:text-[var(--fg)]",
                      )}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </FilterField>
 
            <FilterField label="Verdict">
              <div className="flex flex-wrap gap-1.5">
                {VERDICTS.map((v) => {
 const active = filter.verdicts?.includes(v as Verdict);
 return (
                    <button
 key={v}
 onClick={() => {
 const cur = filter.verdicts ?? [];
 const next = cur.includes(v as Verdict)
 ? cur.filter((x) => x !== v)
 : [...cur, v as Verdict];
 setFilter({
                          verdicts: next.length ? next : undefined,
                        });
                      }}
 className={cn(
 "h-7 px-2.5 inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] text-[11.5px] border",
                        active
 ? "border-transparent text-white"
 : "bg-transparent border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--border)] hover:text-[var(--fg)]",
                      )}
 style={
                        active
 ? { background: VERDICT_COLOR[v as Verdict] }
 : undefined
                      }
                    >
                      <span
 className="dot"
 style={{
                          background: active
 ? "white"
 : VERDICT_COLOR[v as Verdict],
                        }}
                      />
                      {VERDICT_LABEL[v as Verdict]}
                    </button>
                  );
                })}
              </div>
            </FilterField>
 
            <FilterField label="Tags (any)">
              <div className="flex flex-wrap gap-1.5">
                {projectTags.length === 0 && (
                  <span className="text-[11.5px] text-[var(--fg-subtle)]">
                    No tags
                  </span>
                )}
                {projectTags.map((t) => {
 const active = filter.tagIds?.includes(t.id);
 return (
                    <button
 key={t.id}
 onClick={() => {
 const cur = filter.tagIds ?? [];
 const next = cur.includes(t.id)
 ? cur.filter((x) => x !== t.id)
 : [...cur, t.id];
 setFilter({
                          tagIds: next.length ? next : undefined,
                        });
                      }}
 className={cn(
 "h-7 px-2.5 inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] text-[11.5px] border",
                        active
 ? "bg-[var(--bg-soft)] border-[var(--border)] text-[var(--fg)]"
 : "border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--border)] hover:text-[var(--fg)]",
                      )}
                    >
                      <span
 className="dot"
 style={{ background: t.color }}
                      />
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </FilterField>
 
            <FilterField label="Rating">
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    { key: "all", label: "All" },
                    { key: "unrated", label: "Unrated" },
                    { key: 1, label: "≥ 1" },
                    { key: 2, label: "≥ 2" },
                    { key: 3, label: "≥ 3" },
                    { key: 4, label: "≥ 4" },
                    { key: 5, label: "≥ 5" },
                  ] as const
                ).map((opt) => {
 const active =
                    opt.key === "all"
 ? !filter.minRating && !filter.unrated
 : opt.key === "unrated"
 ? !!filter.unrated
 : filter.minRating === opt.key;
 return (
                    <button
 key={String(opt.key)}
 onClick={() => {
 if (opt.key === "all") {
 setFilter({ minRating: undefined, unrated: undefined });
                        } else if (opt.key === "unrated") {
 setFilter({ minRating: undefined, unrated: true });
                        } else {
 setFilter({ minRating: opt.key, unrated: undefined });
                        }
                      }}
 className={cn(
 "h-7 px-2 inline-flex items-center gap-1 rounded-[var(--radius-md)] text-[11.5px] border",
                        active
 ? "bg-[var(--brand)] border-[var(--brand)] text-[var(--brand-fg)]"
 : "border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--border)]",
                      )}
                    >
                      {opt.key !== "all" && opt.key !== "unrated" && (
                        <Star
 size={11}
 fill={active ? "currentColor" : "none"}
                        />
                      )}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </FilterField>
 
            <FilterField label="Page order">
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    { key: "manual", label: "Manual" },
                    { key: "least-versions", label: "Fewest versions first" },
                    { key: "most-versions", label: "Most versions first" },
                  ] as const
                ).map((opt) => {
 const cur = filter.pageSort ?? "manual";
 const active = cur === opt.key;
 return (
                    <button
 key={opt.key}
 onClick={() =>
 setFilter({
                          pageSort:
                            opt.key === "manual" ? undefined : opt.key,
                        })
                      }
 className={cn(
 "h-7 px-2.5 rounded-[var(--radius-md)] text-[11.5px] border",
                        active
 ? "bg-[var(--brand)] border-[var(--brand)] text-[var(--brand-fg)]"
 : "border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--border)]",
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </FilterField>

            <FilterField label="Annotations">
              <label className="inline-flex items-center gap-2 cursor-pointer text-[12px] text-[var(--fg-muted)]">
                <input
 type="checkbox"
 checked={!!filter.hasAnnotations}
 onChange={(e) =>
 setFilter({
                      hasAnnotations: e.target.checked || undefined,
                    })
                  }
                />
                Only versions with annotations
              </label>
            </FilterField>
          </div>
          <div className="border-t border-[var(--border)] p-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </AnimatePresence>
  );
}
 
function FilterField({
 label,
 children,
}: {
 label: string;
 children: React.ReactNode;
}) {
 return (
    <div className="flex flex-col gap-2">
      <span className="text-[11.5px] font-medium text-[var(--fg-subtle)]">
        {label}
      </span>
      {children}
    </div>
  );
}
