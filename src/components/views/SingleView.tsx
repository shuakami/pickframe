"use client";
 
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { AnnotationCanvas } from "../annotation/AnnotationCanvas";
import { Inspector } from "../shell/Inspector";
import { Button } from "../primitives/Button";
import { Tooltip } from "../primitives/Tooltip";
import {
  ChevronLeft,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  Crown,
} from "lucide-react";
import { cn, useIsMobile } from "@/lib/utils";
 
export function SingleView() {
 const versions = useStore((s) => s.versions);
 const focused = useStore((s) => s.focusedVersionId);
 const setFocused = useStore((s) => s.setFocused);
 const activePageId = useStore((s) => s.activePageId);
 const activeProjectId = useStore((s) => s.activeProjectId);
 const setViewMode = useStore((s) => s.setViewMode);
 
 const isMobile = useIsMobile();
 // On mobile we default the side panel CLOSED so the user immediately sees
 // the image after tapping a card. Toggle button still opens it on demand.
 const [stripOpen, setStripOpen] = React.useState<boolean>(!isMobile);
 // Sync the default once on first switch between mobile/desktop so the
 // breakpoint flip feels right when rotating a phone or resizing.
 const [prevIsMobile, setPrevIsMobile] = React.useState(isMobile);
 if (prevIsMobile !== isMobile) {
 setPrevIsMobile(isMobile);
 setStripOpen(!isMobile);
 }
 
 const candidates = React.useMemo(
    () =>
      versions.filter(
        (v) =>
          v.projectId === activeProjectId &&
          (!activePageId || v.pageId === activePageId),
      ),
    [versions, activeProjectId, activePageId],
  );
 const currentId = focused ?? candidates[0]?.id ?? null;
 const current = currentId
 ? versions.find((v) => v.id === currentId)
 : undefined;
 
 const peers = React.useMemo(
    () =>
      current
 ? versions
            .filter((v) => v.pageId === current.pageId)
            .sort((a, b) => a.label.localeCompare(b.label))
 : [],
    [versions, current],
  );
 
 const idx = current ? peers.findIndex((v) => v.id === current.id) : -1;
 const prev = idx > 0 ? peers[idx - 1] : null;
 const next = idx >= 0 && idx < peers.length - 1 ? peers[idx + 1] : null;
 
 if (!current) {
 return (
      <div className="absolute inset-0 grid place-items-center text-[var(--fg-subtle)]">
        Nothing to show
      </div>
    );
  }
 
 return (
    <div className="absolute inset-0 flex flex-col bg-[var(--bg-soft)]">
      {/* Mini header */}
      <div className="h-10 shrink-0 flex items-center gap-2 px-3 border-b border-[var(--border)] bg-[var(--bg)]">
        <Button
 size="sm"
 variant="ghost"
 onClick={() => {
 setFocused(null);
 setViewMode("board");
          }}
        >
          <ChevronLeft size={13} />
          Back
        </Button>
        <div className="flex-1 min-w-0 flex items-center justify-center gap-2">
          <span className="text-[12.5px] text-[var(--fg-muted)] tabular-nums">
            {peers.length > 0 && `${idx + 1} / ${peers.length}`}
          </span>
          <span className="text-[12.5px] font-medium truncate">
            {current.label}
          </span>
          {current.verdict === "winner" && (
            <span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--winner)]">
              <Crown size={11} />
              Winner
            </span>
          )}
        </div>
        <Tooltip content="Previous" shortcut="←">
          <Button
 size="icon-sm"
 variant="ghost"
 disabled={!prev}
 onClick={() => prev && setFocused(prev.id)}
          >
            <ChevronLeft size={13} />
          </Button>
        </Tooltip>
        <Tooltip content="Next" shortcut="→">
          <Button
 size="icon-sm"
 variant="ghost"
 disabled={!next}
 onClick={() => next && setFocused(next.id)}
          >
            <ChevronRight size={13} />
          </Button>
        </Tooltip>
        <span className="w-px h-4 bg-[var(--border)] mx-1" />
        <Tooltip content={stripOpen ? "Hide side panel" : "Show side panel"}>
          <Button
 size="icon-sm"
 variant="ghost"
 onClick={() => setStripOpen((o) => !o)}
          >
            {stripOpen ? (
              <PanelRightClose size={13} />
            ) : (
              <PanelRightOpen size={13} />
            )}
          </Button>
        </Tooltip>
      </div>
 
      <div className="flex-1 min-h-0 flex relative">
        <div className="flex-1 min-w-0 relative">
          <AnnotationCanvas key={current.id} version={current} />
        </div>

        {/* Mobile: dim the canvas while the side panel is open so taps on
            the canvas dismiss the panel rather than fight with annotation
            tools underneath. Desktop: the panel sits inline so no scrim. */}
        <AnimatePresence>
          {isMobile && stripOpen && (
            <motion.div
 key="single-strip-scrim"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.16 }}
 className="lg:hidden absolute inset-0 z-20"
 style={{ background: "var(--scrim-light)" }}
 onClick={() => setStripOpen(false)}
            />
          )}
        </AnimatePresence>

        {stripOpen && (
          <aside
 className={cn(
 "border-l border-[var(--border)] bg-[var(--bg)]",
 "flex flex-col min-h-0",
 // Mobile / tablet: floating right drawer over the canvas.
 // Desktop: inline column to the right of the canvas.
 "lg:shrink-0 lg:static lg:w-[280px]",
 "absolute right-0 top-0 bottom-0 z-30 w-[min(86vw,320px)] shadow-[var(--shadow-modal)] lg:shadow-none",
            )}
          >
            {/* Versions list — compact vertical, no oversized thumbs.
                Lives at the top so users can jump between peers fast. */}
            {peers.length > 1 && (
              <div className="border-b border-[var(--border)] flex flex-col min-h-0 max-h-[42%]">
                <div className="h-9 shrink-0 px-3 flex items-center justify-between">
                  <span className="text-[11.5px] font-medium text-[var(--fg-subtle)]">
                    Versions
                  </span>
                  <span className="text-[10.5px] tabular-nums text-[var(--fg-subtle)]">
                    {idx + 1} / {peers.length}
                  </span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto px-1 pb-2 flex flex-col gap-0.5">
                  {peers.map((v) => {
 const isActive = v.id === current.id;
 const isWinner = v.verdict === "winner";
 const ann =
                      v.annotations.strokes.length +
                      v.annotations.shapes.length +
                      v.annotations.notes.length;
 return (
                      <button
 key={v.id}
 onClick={() => setFocused(v.id)}
 className={cn(
 "group flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] text-left transition-colors",
                          isActive
 ? "bg-[var(--bg-soft)]"
 : "hover:bg-[var(--bg-soft)]/60",
                        )}
                      >
                        <span
 className={cn(
 "shrink-0 h-1.5 w-1.5 rounded-full",
                            isActive
 ? "bg-[var(--brand)]"
 : "bg-transparent border border-[var(--fg-subtle)]",
                          )}
                        />
                        <span
 className={cn(
 "flex-1 truncate text-[12.5px]",
                            isActive
 ? "text-[var(--fg)] font-medium"
 : "text-[var(--fg-muted)]",
                          )}
                        >
                          {v.label}
                        </span>
                        {isWinner && (
                          <Crown
 size={11}
 className="text-[var(--winner)] shrink-0"
                          />
                        )}
                        {ann > 0 && (
                          <span className="shrink-0 text-[10.5px] tabular-nums text-[var(--fg-subtle)]">
                            {ann}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
 
            {/* Inspector for the focused version */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <Inspector embedded />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
 
 
