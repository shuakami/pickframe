"use client";
 
import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { Thumb } from "../primitives/Thumb";
import { Crown, Star } from "lucide-react";
import { VERDICT_LABEL, VERDICT_COLOR } from "@/lib/types";
 
/**
 * Quick Look — hold Space while hovering a card on the Board to see a
 * fullscreen preview (with live annotations). Release Space to dismiss.
 *
 * - Hovering a different card while held swaps the preview live.
 * - Without a hovered card, falls back to the focused / first selected card.
 * - Wheel = zoom around cursor. Drag = pan. Double-click = reset.
 * - Suppressed when typing in inputs, in single view, or while a Dialog is open.
 */
export function QuickLook() {
 const versions = useStore((s) => s.versions);
 const pages = useStore((s) => s.pages);
 const viewMode = useStore((s) => s.viewMode);
 const commandOpen = useStore((s) => s.commandOpen);
 const filterOpen = useStore((s) => s.filterOpen);
 const exportOpen = useStore((s) => s.exportOpen);
 
 const [hoveredId, setHoveredId] = React.useState<string | null>(null);
 const [active, setActive] = React.useState(false);
 // Target captured at the moment Space was pressed. Stays put for the
 // entire hold so the preview never silently swaps when the cursor drifts
 // onto another card.
 const [lockedTargetId, setLockedTargetId] = React.useState<string | null>(
 null,
  );
 // Always-current ref of hoveredId so the keydown handler can read the
 // *latest* hover without re-subscribing every move.
 const hoveredIdRef = React.useRef<string | null>(null);
 const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
 
 // Track hovered card via document mousemove
  React.useEffect(() => {
 const onMove = (e: MouseEvent) => {
 const t = e.target as HTMLElement | null;
 if (!t) return;
 const card = t.closest("[data-version-card]") as HTMLElement | null;
 const id = card?.getAttribute("data-version-card") ?? null;
      hoveredIdRef.current = id;
 setHoveredId((cur) => (cur === id ? cur : id));
    };
    window.addEventListener("mousemove", onMove);
 return () => window.removeEventListener("mousemove", onMove);
  }, []);
 
 // Space hold = preview
 const suppressed =
    viewMode === "single" || commandOpen || filterOpen || exportOpen;
  React.useEffect(() => {
 const isTyping = (el: EventTarget | null) => {
 const t = el as HTMLElement | null;
 if (!t) return false;
 const tag = t.tagName?.toLowerCase();
 return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        t.isContentEditable === true
      );
    };
 const onDown = (e: KeyboardEvent) => {
 if (suppressed) return;
 if (e.code !== "Space") return;
 if (isTyping(e.target)) return;
 if (e.repeat) {
        e.preventDefault();
 return;
      }
      e.preventDefault();
 // Snapshot the current target at press time. Fallback chain matches
 // the original (hover → focused → first selected). Once captured this
 // doesn't change until Space is released, so moving the cursor onto
 // another card during hold won't silently swap the preview.
 const s = useStore.getState();
 const firstSel = s.selectedIds.values().next();
 const snap =
        hoveredIdRef.current ??
        s.focusedVersionId ??
        (firstSel.done ? null : firstSel.value);
 setLockedTargetId(snap);
 setActive(true);
    };
 const onUp = (e: KeyboardEvent) => {
 if (e.code !== "Space") return;
 setActive(false);
 setLockedTargetId(null);
    };
 const onBlur = () => {
 setActive(false);
 setLockedTargetId(null);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
 return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [suppressed]);
 
 // Drop active when suppression kicks in.
 if (suppressed && active) {
 setActive(false);
 setLockedTargetId(null);
  }

 // The preview's target is whatever was locked in at Space-down. hoveredId
 // is only used by the keydown handler to seed the next press — it does
 // NOT influence the live preview while Space is held, which is the whole
 // point: cursor drift mid-press must not silently swap the image.
 void hoveredId;
 const targetId = active ? lockedTargetId : null;
 
 // Sticky id keeps the preview painted during exit animation.
 const [lastTargetId, setLastTargetId] = React.useState<string | null>(null);
 if (targetId && targetId !== lastTargetId) {
 setLastTargetId(targetId);
  }
 
 // Reset zoom/pan when target changes or we close.
 const [zoom, setZoom] = React.useState(1);
 const [pan, setPan] = React.useState({ x: 0, y: 0 });
 const [prevTargetId, setPrevTargetId] = React.useState<string | null>(null);
 if (targetId !== prevTargetId) {
 setPrevTargetId(targetId);
 setZoom(1);
 setPan({ x: 0, y: 0 });
  }
 
 const v = lastTargetId
 ? versions.find((x) => x.id === lastTargetId)
 : null;
 const page = v ? pages.find((p) => p.id === v.pageId) : null;
 
 // Pan + zoom handlers (only attached when active)
 const overlayRef = React.useRef<HTMLDivElement>(null);
 const draggingRef = React.useRef<{
 startX: number;
 startY: number;
 baseX: number;
 baseY: number;
  } | null>(null);
 const [dragging, setDragging] = React.useState(false);
 
 // Native wheel listener with passive: false so we can preventDefault.
  React.useEffect(() => {
 if (!active) return;
 const overlay = overlayRef.current;
 if (!overlay) return;
 const handler = (e: WheelEvent) => {
      e.preventDefault();
 const rect = overlay.getBoundingClientRect();
 const cx = e.clientX - rect.left - rect.width / 2;
 const cy = e.clientY - rect.top - rect.height / 2;
 const delta = -e.deltaY;
 const factor = Math.exp(delta * 0.0015);
 setZoom((z) => {
 const nextZoom = Math.min(8, Math.max(1, z * factor));
 if (nextZoom === z) return z;
 const k = nextZoom / z;
 setPan((p) => {
 if (nextZoom === 1) return { x: 0, y: 0 };
 return { x: cx - (cx - p.x) * k, y: cy - (cy - p.y) * k };
        });
 return nextZoom;
      });
    };
    overlay.addEventListener("wheel", handler, { passive: false });
 return () => overlay.removeEventListener("wheel", handler);
  }, [active]);
 
 const onMouseDown = (e: React.MouseEvent) => {
 if (e.button !== 0) return;
    draggingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: pan.x,
      baseY: pan.y,
    };
 setDragging(true);
  };

 // While Quick Look is open, kill ALL native drag-and-drop globally —
 // this is the only reliable way to prevent the browser from yanking
 // <img> elements (including the one in <Thumb>) out as a drag ghost.
 // We also block selectstart on the overlay below.
  React.useEffect(() => {
 if (!active) return;
 const stop = (e: Event) => e.preventDefault();
    document.addEventListener("dragstart", stop, true);
    document.addEventListener("drag", stop, true);
    document.addEventListener("dragover", stop, true);
    document.addEventListener("drop", stop, true);
 return () => {
      document.removeEventListener("dragstart", stop, true);
      document.removeEventListener("drag", stop, true);
      document.removeEventListener("dragover", stop, true);
      document.removeEventListener("drop", stop, true);
    };
  }, [active]);

  React.useEffect(() => {
 if (!active) return;
 // Clear any leftover drag-state ref from a previous Quick Look session
 // before wiring up listeners. This kills the "ghost drag" where the
 // image kept panning without the user holding LMB.
    draggingRef.current = null;
 const onMove = (e: MouseEvent) => {
 const d = draggingRef.current;
 if (!d) return;
 // If the left button is no longer pressed, abandon the drag.
 // Catches mouseups that happened outside the window or while a
 // different listener was active — root cause of the "ghost drag"
 // where the image kept moving without the user holding LMB.
 if ((e.buttons & 1) === 0) {
        draggingRef.current = null;
 setDragging(false);
 return;
      }
 setPan({
        x: d.baseX + (e.clientX - d.startX),
        y: d.baseY + (e.clientY - d.startY),
      });
    };
 const onUp = () => {
      draggingRef.current = null;
 setDragging(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
 return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [active]);
 
 const onDoubleClick = () => {
 setZoom(1);
 setPan({ x: 0, y: 0 });
  };
 
 if (!mounted) return null;
 
 return createPortal(
    <AnimatePresence
 onExitComplete={() => {
 if (!active) {
 setLastTargetId(null);
 // Defensive cleanup — if Space was released while the mouse
 // button was still down, the drag ref could otherwise leak into
 // the next Quick Look session and pan the image without a click.
          draggingRef.current = null;
 setDragging(false);
 setZoom(1);
 setPan({ x: 0, y: 0 });
        }
      }}
    >
      {active && v && (
        <motion.div
 key="quicklook"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.14, ease: [0.2, 0.7, 0.2, 1] }}
 ref={overlayRef}
 onMouseDown={onMouseDown}
 onDoubleClick={onDoubleClick}
 onDragStart={(e) => e.preventDefault()}
 className="fixed inset-0 z-[80] backdrop-blur-md grid place-items-center"
 style={{
            background: "var(--scrim-strong)",
            cursor: dragging ? "grabbing" : zoom > 1 ? "grab" : "default",
          }}
 aria-hidden
        >
          {/* Top: single capsule pill with metadata, centered */}
          <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 h-[26px] rounded-full bg-[var(--surface-elevated)]/85 backdrop-blur-md border border-[var(--border)] text-[12px] text-[var(--fg)] select-none whitespace-nowrap">
            {v.verdict === "winner" ? (
              <Crown size={11} className="text-[var(--winner)]" />
            ) : v.verdict !== "unset" ? (
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: VERDICT_COLOR[v.verdict] }}
                title={VERDICT_LABEL[v.verdict]}
              />
            ) : null}
            <span className="font-medium">{v.label}</span>
            {page && (
              <>
                <span className="opacity-40">·</span>
                <span className="opacity-80 max-w-[200px] truncate">{page.name}</span>
              </>
            )}
            {v.rating > 0 && (
              <>
                <span className="opacity-40">·</span>
                <span className="inline-flex items-center gap-0.5">
                  <Star size={10} className="fill-current" />
                  {v.rating}
                </span>
              </>
            )}
            {zoom > 1 && (
              <>
                <span className="opacity-40">·</span>
                <span className="tabular-nums opacity-70">
                  {Math.round(zoom * 100)}%
                </span>
              </>
            )}
          </div>

 <motion.div
 key={v.id}
 initial={{ scale: 0.96, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 exit={{ scale: 0.97, opacity: 0 }}
 transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
 className="relative flex flex-col items-center max-w-[92vw] max-h-[92vh] pointer-events-none"
 >
 <div
 className="relative rounded-[var(--radius-lg)] overflow-hidden shadow-[var(--shadow-modal)] pointer-events-none"
 style={{
 aspectRatio:
 v.width > 0 && v.height > 0
 ? `${v.width} / ${v.height}`
 : "3 / 4",
 maxWidth: "92vw",
 maxHeight: "84vh",
 width:
 v.width > 0 && v.height > 0
 ? `min(92vw, calc(84vh * ${v.width / v.height}))`
 : "min(92vw, 60vh)",
 transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
 transformOrigin: "center center",
 transition: dragging
 ? "none"
 : "transform 80ms cubic-bezier(0.2,0.7,0.2,1)",
 }}
 >
 <Thumb
 blobId={v.blobId}
 fit="contain"
 imageWidth={v.width}
 imageHeight={v.height}
 annotations={v.annotations}
 className="w-full h-full"
 />
 </div>
 </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
