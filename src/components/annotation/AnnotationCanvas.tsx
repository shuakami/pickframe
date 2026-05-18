"use client";
 
import * as React from "react";
import { getStroke } from "perfect-freehand";
import { nanoid } from "nanoid";
import { useStore } from "@/lib/store";
import { Tooltip } from "../primitives/Tooltip";
import { cn, STROKE_COLORS, clamp } from "@/lib/utils";
import {
  EMPTY_ANNOTATIONS,
 type Annotations,
 type Stroke,
 type Shape,
 type Version,
} from "@/lib/types";
import {
  MousePointer2,
  PenLine,
  Highlighter,
  ArrowUpRight,
  Square,
  StickyNote,
  Undo2,
  Redo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  GripVertical,
} from "lucide-react";
import { getBlobUrl } from "@/lib/db";
import { uiConfirm } from "@/lib/ui";
 
type Tool = "select" | "pen" | "highlight" | "arrow" | "rect" | "note";
 
interface CanvasState {
 zoom: number;
 panX: number;
 panY: number;
}
 
const TOOL_OPTIONS: { kind: Tool; icon: React.ReactNode; label: string; shortcut?: string }[] =
  [
    { kind: "select", icon: <MousePointer2 size={14} />, label: "Select", shortcut: "V" },
    { kind: "pen", icon: <PenLine size={14} />, label: "Pen", shortcut: "P" },
    {
      kind: "highlight",
      icon: <Highlighter size={14} />,
      label: "Marker",
      shortcut: "H",
    },
    { kind: "rect", icon: <Square size={14} />, label: "Highlight", shortcut: "R" },
    { kind: "arrow", icon: <ArrowUpRight size={14} />, label: "Arrow", shortcut: "A" },
    { kind: "note", icon: <StickyNote size={14} />, label: "Sticky", shortcut: "N" },
  ];
 
export function AnnotationCanvas({ version }: { version: Version }) {
 const setAnnotations = useStore((s) => s.setAnnotations);
 const containerRef = React.useRef<HTMLDivElement>(null);
 const imageRef = React.useRef<HTMLImageElement | null>(null);
 
 // Default to "select" so opening a version starts in look-mode. Users
 // almost always want to view first and draw second; switching to a
 // drawing tool is one keystroke (V/P/etc.) or one click on the toolbar.
 const [tool, setTool] = React.useState<Tool>("select");
 const [color, setColor] = React.useState(STROKE_COLORS[2]);
 const [size, setSize] = React.useState(4);
 const [transform, setTransform] = React.useState<CanvasState>({
    zoom: 1,
    panX: 0,
    panY: 0,
  });
 // Local annotation state (debounced to store).
 // The component is keyed by version.id (see SingleView), so initial state always reflects the new version.
 const [ann, setAnn] = React.useState<Annotations>(
    () => version.annotations ?? EMPTY_ANNOTATIONS,
  );
 const [history, setHistory] = React.useState<Annotations[]>([]);
 const [future, setFuture] = React.useState<Annotations[]>([]);
 const annRef = React.useRef(ann);

 // Floating, draggable toolbar position. null = default top-center.
 // Persisted to localStorage so it sticks across versions / sessions.
 const [toolbarPos, setToolbarPos] = React.useState<{
 x: number;
 y: number;
  } | null>(() => {
 if (typeof window === "undefined") return null;
 try {
 const v = window.localStorage.getItem("pf:annot-toolbar-pos");
 return v ? (JSON.parse(v) as { x: number; y: number }) : null;
    } catch {
 return null;
    }
  });
  React.useEffect(() => {
 try {
 if (toolbarPos) {
        window.localStorage.setItem(
 "pf:annot-toolbar-pos",
          JSON.stringify(toolbarPos),
        );
      } else {
        window.localStorage.removeItem("pf:annot-toolbar-pos");
      }
    } catch {
 /* ignore */
    }
  }, [toolbarPos]);
 const toolbarRef = React.useRef<HTMLDivElement | null>(null);
 const toolbarDragRef = React.useRef<{
 startX: number;
 startY: number;
 baseX: number;
 baseY: number;
 pointerId: number;
  } | null>(null);
 const onToolbarHandleDown = (e: React.PointerEvent) => {
 if (e.button !== 0) return;
 const tb = toolbarRef.current;
 const cont = containerRef.current;
 if (!tb || !cont) return;
 const tr = tb.getBoundingClientRect();
 const cr = cont.getBoundingClientRect();
 const baseX = tr.left - cr.left;
 const baseY = tr.top - cr.top;
    toolbarDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX,
      baseY,
      pointerId: e.pointerId,
    };
    setToolbarPos({ x: baseX, y: baseY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };
 const onToolbarHandleMove = (e: React.PointerEvent) => {
 const d = toolbarDragRef.current;
 if (!d || d.pointerId !== e.pointerId) return;
 const cont = containerRef.current;
 const tb = toolbarRef.current;
 if (!cont || !tb) return;
 const cr = cont.getBoundingClientRect();
 const tr = tb.getBoundingClientRect();
 const m = 8;
 const nx = Math.min(
      Math.max(m, d.baseX + (e.clientX - d.startX)),
 Math.max(m, cr.width - tr.width - m),
    );
 const ny = Math.min(
      Math.max(m, d.baseY + (e.clientY - d.startY)),
 Math.max(m, cr.height - tr.height - m),
    );
    setToolbarPos({ x: nx, y: ny });
  };
 const onToolbarHandleUp = (e: React.PointerEvent) => {
 if (toolbarDragRef.current?.pointerId === e.pointerId) {
      toolbarDragRef.current = null;
    }
  };
 
 // Persist debounced
  React.useEffect(() => {
    annRef.current = ann;
 const t = setTimeout(() => {
 setAnnotations(version.id, ann).catch(() => {});
    }, 350);
 return () => clearTimeout(t);
  }, [ann, version.id, setAnnotations]);
 
 // Load the image blob — track which blobId was resolved, then derive the src.
 const [imgResolved, setImgResolved] = React.useState<{
 blobId: string | undefined;
 src: string | null;
  }>({ blobId: undefined, src: null });
  React.useEffect(() => {
 let cancelled = false;
 getBlobUrl(version.blobId).then((u) => {
 if (!cancelled && u)
 setImgResolved({ blobId: version.blobId, src: u });
    });
 return () => {
      cancelled = true;
    };
  }, [version.blobId]);
 const imgSrc =
    imgResolved.blobId === version.blobId ? imgResolved.src : null;
 
 // Fit-to-screen on first load
 const [imgSize, setImgSize] = React.useState<{ w: number; h: number } | null>(
 null,
  );
 const [fitReady, setFitReady] = React.useState(false);
 const onImgLoad = React.useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
 const img = e.currentTarget;
      imageRef.current = img;
 const w = img.naturalWidth;
 const h = img.naturalHeight;
 const c = containerRef.current;
 if (c) {
 const cw = c.clientWidth;
 const ch = c.clientHeight;
 const z = Math.min((cw - 80) / w, (ch - 80) / h, 1);
 setTransform({
          zoom: z > 0 ? z : 1,
          panX: (cw - w * z) / 2,
          panY: (ch - h * z) / 2,
        });
      }
 // Set imgSize *after* the transform so the renderer never sees a 1:1 frame.
 setImgSize({ w, h });
 // Reveal in the next frame to avoid a 1-frame flash before transform applies.
 requestAnimationFrame(() => setFitReady(true));
    },
    [],
  );
 // Reset reveal when version changes (component is keyed by version.id, but
 // belt-and-braces if mount is reused). Use a tracked-prop pattern so we
 // don't issue setState from inside an effect.
 const [lastVersionId, setLastVersionId] = React.useState(version.id);
 if (lastVersionId !== version.id) {
 setLastVersionId(version.id);
 if (fitReady) setFitReady(false);
  }
 
 // Image-space coords from a screen point on the surface
 const surfaceRef = React.useRef<HTMLDivElement>(null);
 const screenToImage = React.useCallback(
    (clientX: number, clientY: number) => {
 const surface = surfaceRef.current;
 if (!surface) return { x: 0, y: 0 };
 const r = surface.getBoundingClientRect();
 const sx = clientX - r.left;
 const sy = clientY - r.top;
 return {
        x: (sx - transform.panX) / transform.zoom,
        y: (sy - transform.panY) / transform.zoom,
      };
    },
    [transform],
  );
 
 const pushHistory = React.useCallback(() => {
 setHistory((h) => [...h, annRef.current].slice(-50));
 setFuture([]);
  }, []);

 // Blur any focused sticky-note textarea when the user clicks outside a
 // sticky. Without this, the caret keeps blinking even after they've
 // moved on to drawing or panning elsewhere.
  React.useEffect(() => {
 const onPointerDown = (e: PointerEvent) => {
 const target = e.target as HTMLElement | null;
 if (target && target.closest("[data-sticky]")) return;
 const active = document.activeElement;
 if (
        active instanceof HTMLTextAreaElement &&
        active.closest("[data-sticky]")
      ) {
        active.blur();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
 return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);
 
 // Pan with space + drag, or with select tool
 const panRef = React.useRef<{
 startX: number;
 startY: number;
 panX: number;
 panY: number;
  } | null>(null);
 const [spacePressed, setSpacePressed] = React.useState(false);
  React.useEffect(() => {
 function k(e: KeyboardEvent) {
 const target = e.target as HTMLElement | null;
 const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
 if (inField) return;
 if (e.key === " ") setSpacePressed(true);
 if (e.key === "Escape") setTool("select");
 const map: Record<string, Tool> = {
        v: "select",
        p: "pen",
        h: "highlight",
        a: "arrow",
        r: "rect",
        n: "note",
      };
 if (e.key.toLowerCase() in map && !e.metaKey && !e.ctrlKey)
 setTool(map[e.key.toLowerCase()]);
 if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
 if (e.shiftKey) {
 setFuture((f) => {
 if (f.length === 0) return f;
 const next = f[f.length - 1];
 setHistory((h) => [...h, annRef.current]);
 setAnn(next);
 return f.slice(0, -1);
          });
        } else {
 setHistory((h) => {
 if (h.length === 0) return h;
 const prev = h[h.length - 1];
 setFuture((f) => [...f, annRef.current]);
 setAnn(prev);
 return h.slice(0, -1);
          });
        }
      }
    }
 function up(e: KeyboardEvent) {
 if (e.key === " ") setSpacePressed(false);
    }
    window.addEventListener("keydown", k);
    window.addEventListener("keyup", up);
 return () => {
      window.removeEventListener("keydown", k);
      window.removeEventListener("keyup", up);
    };
  }, []);
 
 // Live drawing
 const [draftStroke, setDraftStroke] = React.useState<Stroke | null>(null);
 const [draftShape, setDraftShape] = React.useState<Shape | null>(null);
 const [draggingNote, setDraggingNote] = React.useState<string | null>(null);
 const noteDragOffset = React.useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
 
 const beginPointer = (e: React.PointerEvent) => {
 const target = e.target as HTMLElement;
 if (target.closest("[data-sticky]")) return; // sticky handles its own drag
 if (target.closest("[data-toolbar]")) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
 
 if (spacePressed || (tool === "select" && e.button === 0)) {
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        panX: transform.panX,
        panY: transform.panY,
      };
 return;
    }
 
 const { x, y } = screenToImage(e.clientX, e.clientY);
 if (tool === "pen" || tool === "highlight") {
 const stroke: Stroke = {
        id: nanoid(8),
        tool: tool === "highlight" ? "highlight" : "pen",
        color,
        size: tool === "highlight" ? size * 4 : size,
        points: [x, y, e.pressure || 0.5],
      };
 pushHistory();
 setDraftStroke(stroke);
    } else if (tool === "rect") {
 const shape: Shape = {
        id: nanoid(8),
        kind: "rect",
        color,
        size,
        geom: [x, y, 0, 0],
      };
 pushHistory();
 setDraftShape(shape);
    } else if (tool === "arrow") {
 const shape: Shape = {
        id: nanoid(8),
        kind: "arrow",
        color,
        size,
        geom: [x, y, x, y],
      };
 pushHistory();
 setDraftShape(shape);
    } else if (tool === "note") {
 pushHistory();
 const id = nanoid(8);
 setAnn((a) => ({
 ...a,
        notes: [
 ...a.notes,
          {
            id,
            x,
            y,
            width: 380,
            text: "",
            // Color is only used for the read-only pin marker on
            // thumbnails; the in-canvas note now renders as a plain dark
            // capsule regardless of this value.
            color: "#fbbf24",
          },
        ],
      }));
 setTool("select");
    }
  };
 
 const movePointer = (e: React.PointerEvent) => {
 if (panRef.current) {
 const dx = e.clientX - panRef.current.startX;
 const dy = e.clientY - panRef.current.startY;
 setTransform((t) => ({
 ...t,
        panX: panRef.current!.panX + dx,
        panY: panRef.current!.panY + dy,
      }));
 return;
    }
 if (draftStroke) {
 const { x, y } = screenToImage(e.clientX, e.clientY);
 setDraftStroke({
 ...draftStroke,
        points: [...draftStroke.points, x, y, e.pressure || 0.5],
      });
    } else if (draftShape) {
 const { x, y } = screenToImage(e.clientX, e.clientY);
 if (draftShape.kind === "rect") {
 const [sx, sy] = draftShape.geom;
 setDraftShape({
 ...draftShape,
          geom: [
            Math.min(sx, x),
            Math.min(sy, y),
            Math.abs(x - sx),
            Math.abs(y - sy),
          ],
        });
      } else if (draftShape.kind === "arrow") {
 setDraftShape({
 ...draftShape,
          geom: [draftShape.geom[0], draftShape.geom[1], x, y],
        });
      }
    }
  };
 
 const endPointer = (e: React.PointerEvent) => {
 void e;
    panRef.current = null;
 if (draftStroke) {
 setAnn((a) => ({ ...a, strokes: [...a.strokes, draftStroke] }));
 setDraftStroke(null);
    }
 if (draftShape) {
 // ignore tiny shapes
 if (draftShape.kind === "rect") {
 const [, , w, h] = draftShape.geom;
 if (w > 4 && h > 4) {
 setAnn((a) => ({ ...a, shapes: [...a.shapes, draftShape] }));
        }
      } else {
 const [x1, y1, x2, y2] = draftShape.geom;
 if (Math.hypot(x2 - x1, y2 - y1) > 8) {
 setAnn((a) => ({ ...a, shapes: [...a.shapes, draftShape] }));
        }
      }
 setDraftShape(null);
    }
  };
 
 // Wheel: zoom around cursor
 const onWheel = (e: React.WheelEvent) => {
 if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 60) {
 // pan with trackpad
 setTransform((t) => ({
 ...t,
        panX: t.panX - e.deltaX,
        panY: t.panY - e.deltaY,
      }));
 return;
    }
    e.preventDefault();
 const surface = surfaceRef.current;
 if (!surface) return;
 const r = surface.getBoundingClientRect();
 const cx = e.clientX - r.left;
 const cy = e.clientY - r.top;
 const factor = Math.exp(-e.deltaY * 0.0015);
 setTransform((t) => {
 const nz = clamp(t.zoom * factor, 0.1, 8);
 const k = nz / t.zoom;
 return {
        zoom: nz,
        panX: cx - (cx - t.panX) * k,
        panY: cy - (cy - t.panY) * k,
      };
    });
  };
 
 const fit = () => {
 const c = containerRef.current;
 if (!c || !imgSize) return;
 const z = Math.min((c.clientWidth - 80) / imgSize.w, (c.clientHeight - 80) / imgSize.h);
 setTransform({
      zoom: z > 0 ? z : 1,
      panX: (c.clientWidth - imgSize.w * z) / 2,
      panY: (c.clientHeight - imgSize.h * z) / 2,
    });
  };
 
 return (
    <div
 ref={containerRef}
 className="absolute inset-0 overflow-hidden bg-[var(--bg-soft)]"
    >
      {/* Toolbar — draggable via the grip handle on the left */}
      <div
 ref={toolbarRef}
 data-toolbar
 className={cn(
 "absolute z-30 flex items-center gap-0.5 px-1 py-1",
 "bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-pill)]",
 "shadow-[var(--shadow-pop)]",
          toolbarPos ? "" : "top-3 left-3",
        )}
 style={
          toolbarPos
            ? { left: toolbarPos.x, top: toolbarPos.y }
            : undefined
        }
      >
        <div
 onPointerDown={onToolbarHandleDown}
 onPointerMove={onToolbarHandleMove}
 onPointerUp={onToolbarHandleUp}
 onPointerCancel={onToolbarHandleUp}
 onDoubleClick={() => setToolbarPos(null)}
 className="h-7 w-5 grid place-items-center text-[var(--fg-subtle)] hover:text-[var(--fg)] cursor-grab active:cursor-grabbing select-none"
 title="Drag to move (double-click to reset)"
 style={{ touchAction: "none" }}
        >
          <GripVertical size={14} />
        </div>
        <div className="w-px h-5 bg-[var(--border)] mx-0.5" />
        {TOOL_OPTIONS.map((t) => (
          <Tooltip key={t.kind} content={t.label} shortcut={t.shortcut}>
            <button
 onClick={() => setTool(t.kind)}
 className={cn(
 "h-7 w-7 grid place-items-center rounded-full",
                tool === t.kind
 ? "bg-[var(--fg)] text-[var(--bg)]"
 : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]",
              )}
            >
              {t.icon}
            </button>
          </Tooltip>
        ))}
        <div className="w-px h-5 bg-[var(--border)] mx-0.5" />
        {STROKE_COLORS.map((c) => (
          <button
 key={c}
 onClick={() => setColor(c)}
 className={cn(
 "h-5 w-5 grid place-items-center rounded-full transition-transform",
              color === c && "scale-110 ring-2 ring-offset-1 ring-[var(--fg)]/60",
            )}
 style={{ background: c }}
 title={c}
          />
        ))}
        <div className="w-px h-5 bg-[var(--border)] mx-0.5" />
        {[2, 4, 6, 10].map((s) => (
          <button
 key={s}
 onClick={() => setSize(s)}
 className={cn(
 "h-7 w-7 grid place-items-center rounded-full transition-transform",
              size === s ? "bg-[var(--bg-soft)]" : "hover:bg-[var(--bg-soft)]",
            )}
          >
            <span
 className="rounded-full"
 style={{
                width: s + 1,
                height: s + 1,
                background: "var(--fg)",
              }}
            />
          </button>
        ))}
        <div className="w-px h-5 bg-[var(--border)] mx-0.5" />
        <Tooltip content="Undo" shortcut="⌘Z">
          <button
 onClick={() => {
 if (history.length === 0) return;
 const prev = history[history.length - 1];
 setFuture((f) => [...f, annRef.current]);
 setAnn(prev);
 setHistory((h) => h.slice(0, -1));
            }}
 className="h-7 w-7 grid place-items-center rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)] disabled:opacity-30"
 disabled={history.length === 0}
          >
            <Undo2 size={14} />
          </button>
        </Tooltip>
        <Tooltip content="Redo" shortcut="⌘⇧Z">
          <button
 onClick={() => {
 if (future.length === 0) return;
 const next = future[future.length - 1];
 setHistory((h) => [...h, annRef.current]);
 setAnn(next);
 setFuture((f) => f.slice(0, -1));
            }}
 className="h-7 w-7 grid place-items-center rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)] disabled:opacity-30"
 disabled={future.length === 0}
          >
            <Redo2 size={14} />
          </button>
        </Tooltip>
        <Tooltip content="Clear annotations">
          <button
 onClick={() => {
 if (
                ann.strokes.length + ann.shapes.length + ann.notes.length ===
 0
              )
 return;
 uiConfirm({
                title: "Clear all annotations?",
                description:
 "Strokes, shapes, and sticky notes on this version will be removed.",
                danger: true,
                confirmLabel: "Clear",
              }).then((ok) => {
 if (ok) {
 pushHistory();
 setAnn({ strokes: [], shapes: [], notes: [] });
                }
              });
            }}
 className="h-7 w-7 grid place-items-center rounded-full text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
          >
            <Trash2 size={13} />
          </button>
        </Tooltip>
      </div>
 
      {/* Zoom controls (bottom-right) */}
      <div
 data-toolbar
 className="absolute bottom-3 right-3 z-30 flex items-center gap-0.5 p-1 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-pill)] shadow-[var(--shadow-pop)]"
      >
        <Tooltip content="Zoom out" shortcut="−">
          <button
 onClick={() =>
 setTransform((t) => ({ ...t, zoom: clamp(t.zoom / 1.2, 0.1, 8) }))
            }
 className="h-7 w-7 grid place-items-center rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]"
          >
            <ZoomOut size={13} />
          </button>
        </Tooltip>
        <span className="px-1 text-[11px] font-mono tabular-nums text-[var(--fg-muted)] min-w-[42px] text-center">
          {Math.round(transform.zoom * 100)}%
        </span>
        <Tooltip content="Zoom in" shortcut="+">
          <button
 onClick={() =>
 setTransform((t) => ({ ...t, zoom: clamp(t.zoom * 1.2, 0.1, 8) }))
            }
 className="h-7 w-7 grid place-items-center rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]"
          >
            <ZoomIn size={13} />
          </button>
        </Tooltip>
        <Tooltip content="Fit to screen" shortcut="0">
          <button
 onClick={fit}
 className="h-7 w-7 grid place-items-center rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]"
          >
            <Maximize2 size={13} />
          </button>
        </Tooltip>
      </div>
 
      {/* Canvas surface */}
      <div
 ref={surfaceRef}
 onPointerDown={beginPointer}
 onPointerMove={movePointer}
 onPointerUp={endPointer}
 onPointerCancel={endPointer}
 onWheel={onWheel}
 className={cn(
 "absolute inset-0",
          spacePressed
 ? "cursor-grab"
 : tool === "select"
 ? "cursor-default"
 : "cursor-crosshair",
        )}
 style={{ touchAction: "none" }}
      >
        <div
 style={{
            transform: `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.zoom})`,
            transformOrigin: "0 0",
            position: "absolute",
            top: 0,
            left: 0,
            willChange: "transform",
            opacity: fitReady ? 1 : 0,
            transition: "opacity 120ms ease-out",
          }}
        >
          {imgSrc && (
 // eslint-disable-next-line @next/next/no-img-element
            <img
 src={imgSrc}
 alt={version.label}
 onLoad={onImgLoad}
 draggable={false}
 style={{
                display: "block",
                userSelect: "none",
                pointerEvents: "none",
                borderRadius: imgSize
                  ? Math.min(imgSize.w, imgSize.h) * 0.04
                  : 0,
              }}
            />
          )}
          {imgSize && (
            <svg
 width={imgSize.w}
 height={imgSize.h}
 style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
              }}
            >
              {ann.shapes.map((s) => (
                <ShapeNode key={s.id} shape={s} />
              ))}
              {draftShape && <ShapeNode shape={draftShape} />}
              {ann.strokes.map((s) => (
                <StrokeNode key={s.id} stroke={s} />
              ))}
              {draftStroke && <StrokeNode stroke={draftStroke} />}
            </svg>
          )}
          {/* Notes */}
          {imgSize &&
            ann.notes.map((n) => (
              <div
 key={n.id}
 data-sticky
 onPointerDown={(e) => {
                  e.stopPropagation();
 setDraggingNote(n.id);
 const surface = surfaceRef.current!;
 const r = surface.getBoundingClientRect();
 const px =
                    (e.clientX - r.left - transform.panX) / transform.zoom;
 const py =
                    (e.clientY - r.top - transform.panY) / transform.zoom;
                  noteDragOffset.current = {
                    dx: px - n.x,
                    dy: py - n.y,
                  };
                  (e.currentTarget as HTMLElement).setPointerCapture(
                    e.pointerId,
                  );
                }}
 onPointerMove={(e) => {
 if (draggingNote !== n.id) return;
 const surface = surfaceRef.current!;
 const r = surface.getBoundingClientRect();
 const px =
                    (e.clientX - r.left - transform.panX) / transform.zoom;
 const py =
                    (e.clientY - r.top - transform.panY) / transform.zoom;
 setAnn((a) => ({
 ...a,
                    notes: a.notes.map((nn) =>
                      nn.id === n.id
 ? {
 ...nn,
                            x: px - noteDragOffset.current.dx,
                            y: py - noteDragOffset.current.dy,
                          }
 : nn,
                    ),
                  }));
                }}
 onPointerUp={() => setDraggingNote(null)}
 style={{
                  position: "absolute",
                  left: n.x,
                  top: n.y,
                  width: n.width,
                  padding: "12px 16px",
                  borderRadius: 12,
                  fontSize: 28,
                  lineHeight: 1.35,
                  fontWeight: 500,
                  color: "#ffffff",
                  background: "rgba(15, 18, 24, 0.72)",
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                  boxShadow:
                    "0 1px 0 rgba(255,255,255,0.06) inset, 0 8px 28px -10px rgba(0,0,0,0.45)",
                  cursor: "grab",
                }}
              >
                <textarea
 value={n.text}
 placeholder="Type a note…"
 onChange={(e) => {
 const t = e.target.value;
 setAnn((a) => ({
 ...a,
                      notes: a.notes.map((nn) =>
                        nn.id === n.id ? { ...nn, text: t } : nn,
                      ),
                    }));
                  }}
 onPointerDown={(e) => e.stopPropagation()}
 className="w-full bg-transparent border-0 outline-none resize-none placeholder:text-white/45"
 rows={Math.max(1, n.text.split("\n").length)}
 style={{
                    minHeight: 28,
                    color: "inherit",
                    fontSize: "inherit",
                    lineHeight: "inherit",
                    fontWeight: "inherit",
                    fontFamily: "inherit",
                  }}
                />
                <button
 onClick={() => {
 pushHistory();
 setAnn((a) => ({
 ...a,
                      notes: a.notes.filter((nn) => nn.id !== n.id),
                    }));
                  }}
 onPointerDown={(e) => e.stopPropagation()}
 className="absolute -top-2 -right-2 h-5 w-5 grid place-items-center rounded-full bg-[var(--fg)] text-[var(--bg)] opacity-0 hover:opacity-100 focus:opacity-100"
                >
                  ×
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
 
function StrokeNode({ stroke }: { stroke: Stroke }) {
 const pts: number[][] = [];
 for (let i = 0; i < stroke.points.length; i += 3) {
    pts.push([stroke.points[i], stroke.points[i + 1], stroke.points[i + 2]]);
  }
 if (pts.length === 0) return null;
 const outline = getStroke(pts, {
    size: stroke.size,
    thinning: stroke.tool === "highlight" ? 0.05 : 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    last: true,
  });
 if (outline.length === 0) return null;
 const d = outline.reduce((acc, [x, y], i, arr) => {
 if (i === 0) return `M ${x} ${y}`;
 if (i === arr.length - 1) return `${acc} L ${x} ${y} Z`;
 return `${acc} L ${x} ${y}`;
  }, "");
 return (
    <path
 d={d}
 fill={stroke.color}
 opacity={stroke.tool === "highlight" ? 0.32 : 1}
    />
  );
}
 
function ShapeNode({ shape }: { shape: Shape }) {
 if (shape.kind === "rect") {
 const [x, y, w, h] = shape.geom;
 return (
      <rect
 x={x}
 y={y}
 width={w}
 height={h}
 fill={`color-mix(in srgb, ${shape.color} 12%, transparent)`}
 stroke={shape.color}
 strokeWidth={shape.size}
 rx={6}
      />
    );
  }
 if (shape.kind === "arrow") {
 const [x1, y1, x2, y2] = shape.geom;
 const dx = x2 - x1;
 const dy = y2 - y1;
 const len = Math.hypot(dx, dy) || 1;
 const ux = dx / len;
 const uy = dy / len;
 const headLen = 16 + shape.size * 1.5;
 const baseX = x2 - ux * headLen;
 const baseY = y2 - uy * headLen;
 const perpX = -uy * (headLen * 0.5);
 const perpY = ux * (headLen * 0.5);
 const triangle = `M ${x2} ${y2} L ${baseX + perpX} ${baseY + perpY} L ${baseX - perpX} ${baseY - perpY} Z`;
 return (
      <g>
        <line
 x1={x1}
 y1={y1}
 x2={baseX}
 y2={baseY}
 stroke={shape.color}
 strokeWidth={shape.size}
 strokeLinecap="round"
        />
        <path d={triangle} fill={shape.color} />
      </g>
    );
  }
 return null;
}
