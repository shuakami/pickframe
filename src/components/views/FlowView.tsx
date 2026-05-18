"use client";

import * as React from "react";
import { useStore } from "@/lib/store";
import { Thumb } from "../primitives/Thumb";
import { PageLabel } from "../primitives/PageLabel";
import { VERDICT_COLOR, VERDICT_LABEL, type Version } from "@/lib/types";
import {
  Crown,
  Maximize2,
  Minimize2,
  Plus,
  Minus,
  Pencil,
  Square,
  ArrowUpRight,
  MousePointer2,
  Undo2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Annotations, Stroke, Shape } from "@/lib/types";

/**
 * Flow — a pannable, zoomable canvas that lays out one representative version
 * per page in left-to-right reading order, with dotted connector arrows
 * between them. Use case: "we're about to start building, show me whether
 * the whole flow holds together".
 *
 * Pick rule (per page): winner > picked > partial > top rating > most recent.
 *
 * Interactions:
 *  - Drag empty canvas to pan; ⌘/Ctrl + scroll to zoom around cursor; scroll
 *    alone pans vertically; shift+scroll pans horizontally.
 *  - Click a frame to dive into Single view on that version.
 *  - Toolbar: zoom %, ±, Fit, 100%.
 */

const FRAME_HEIGHT = 560; // px at zoom = 1
const GUTTER = 88; // gap between frames
const VPAD = 80; // top/bottom padding inside the world
const HPAD = 64; // left/right padding inside the world

function pickRepresentative(versions: Version[]): Version | null {
  if (!versions.length) return null;
  const order: Record<Version["verdict"], number> = {
    winner: 0,
    picked: 1,
    partial: 2,
    unset: 3,
    rejected: 4,
  };
  return [...versions].sort((a, b) => {
    const va = order[a.verdict];
    const vb = order[b.verdict];
    if (va !== vb) return va - vb;
    if (b.rating !== a.rating) return b.rating - a.rating;
    return b.updatedAt - a.updatedAt;
  })[0];
}

type FlowTool = "select" | "pen" | "arrow" | "rect";

const FLOW_PALETTE = [
  "#ef4444", // red
  "#f59e0b", // amber
  "#22c55e", // green
  "#3b82f6", // blue
  "#a855f7", // purple
  "#0a0a0a", // ink
];

export function FlowView() {
  const activeProjectId = useStore((s) => s.activeProjectId);
  const pages = useStore((s) => s.pages);
  const versions = useStore((s) => s.versions);
  const setFocused = useStore((s) => s.setFocused);
  const setViewMode = useStore((s) => s.setViewMode);
  const projects = useStore((s) => s.projects);
  const setFlowAnnotations = useStore((s) => s.setFlowAnnotations);

  const flowAnnotations: Annotations = React.useMemo(() => {
    const p = projects.find((x) => x.id === activeProjectId);
    return (
      p?.flowAnnotations ?? { strokes: [], shapes: [], notes: [] }
    );
  }, [projects, activeProjectId]);

  const [tool, setTool] = React.useState<FlowTool>("select");
  const [color, setColor] = React.useState(FLOW_PALETTE[0]);
  const [size, setSize] = React.useState(3);

  // While we drag-draw a stroke or shape, hold a *local* preview that the
  // user sees instantly. We commit to the store on pointer up so we don't
  // dirty IndexedDB on every mouse move.
  const [previewStroke, setPreviewStroke] = React.useState<Stroke | null>(
    null,
  );
  const [previewShape, setPreviewShape] = React.useState<Shape | null>(null);
  const drawingRef = React.useRef<{
    kind: "pen" | "arrow" | "rect";
    startX: number;
    startY: number;
  } | null>(null);

  const items = React.useMemo(() => {
    return pages
      .filter((p) => p.projectId === activeProjectId)
      .sort((a, b) => a.order - b.order)
      .map((page) => {
        const all = versions.filter((v) => v.pageId === page.id);
        return { page, rep: pickRepresentative(all), count: all.length };
      });
  }, [pages, versions, activeProjectId]);

  // Compute frame layout. Each frame keeps the rep image's true aspect ratio,
  // so a phone screen looks like a phone and a wide hero looks wide.
  const frames = React.useMemo(() => {
    return items.reduce<
      {
        page: (typeof items)[number]["page"];
        rep: Version | null;
        count: number;
        x: number;
        y: number;
        w: number;
        h: number;
      }[]
    >((acc, { page, rep, count }) => {
      const aspect =
        rep && rep.width > 0 && rep.height > 0
          ? rep.width / rep.height
          : 9 / 19.5;
      const h = FRAME_HEIGHT;
      const w = Math.max(180, Math.round(h * aspect));
      const prev = acc[acc.length - 1];
      const x = prev ? prev.x + prev.w + GUTTER : HPAD;
      acc.push({ page, rep, count, x, y: VPAD, w, h });
      return acc;
    }, []);
  }, [items]);

  const totalW =
    frames.length > 0
      ? frames[frames.length - 1].x + frames[frames.length - 1].w + HPAD
      : HPAD * 2;
  const totalH = FRAME_HEIGHT + VPAD * 2;

  // Camera (pan in viewport px, zoom is multiplier)
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const draggingRef = React.useRef<{
    baseX: number;
    baseY: number;
    startX: number;
    startY: number;
  } | null>(null);

  // Auto-fit when content size or active project changes. Triggered via a
  // sentinel key so we don't re-fit when the user has manually moved.
  const fitKey = `${activeProjectId ?? "_"}:${frames.length}:${totalW}:${totalH}`;
  const lastFitKeyRef = React.useRef<string | null>(null);

  const fitCamera = React.useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const margin = 64;
    const s = Math.min(
      1,
      Math.min((r.width - margin) / totalW, (r.height - margin) / totalH),
    );
    setZoom(s);
    setPan({ x: (r.width - totalW * s) / 2, y: (r.height - totalH * s) / 2 });
  }, [totalW, totalH]);

  const actualSize = React.useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setZoom(1);
    setPan({ x: (r.width - totalW) / 2, y: 40 });
  }, [totalW]);

  // Run fit once per "scene change". Layout effect avoids the post-paint flash.
  React.useLayoutEffect(() => {
    if (lastFitKeyRef.current === fitKey) return;
    lastFitKeyRef.current = fitKey;
    fitCamera();
  }, [fitKey, fitCamera]);

  // Wheel behaviour, Figma-style:
  //  - Plain scroll = zoom around cursor (most users have a wheel mouse).
  //  - Shift+scroll  = horizontal pan.
  //  - Trackpad two-finger drag (deltaX != 0) = pan in both axes.
  const onWheel = (e: React.WheelEvent) => {
    const isPinch = e.ctrlKey || e.metaKey;
    const isTrackpadPan = !isPinch && Math.abs(e.deltaX) > 0;
    if (e.shiftKey && !isPinch) {
      setPan((p) => ({ x: p.x - e.deltaY, y: p.y }));
      return;
    }
    if (isTrackpadPan) {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      return;
    }
    // Zoom around cursor
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const wx = (mx - pan.x) / zoom;
    const wy = (my - pan.y) / zoom;
    const next = Math.max(0.1, Math.min(3, zoom * (1 - e.deltaY * 0.0018)));
    setZoom(next);
    setPan({ x: mx - wx * next, y: my - wy * next });
  };

  const zoomAroundCenter = (next: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.width / 2;
    const cy = r.height / 2;
    const wx = (cx - pan.x) / zoom;
    const wy = (cy - pan.y) / zoom;
    const clamped = Math.max(0.1, Math.min(3, next));
    setZoom(clamped);
    setPan({ x: cx - wx * clamped, y: cy - wy * clamped });
  };

  // Unified pointer-based pan + pinch zoom (works for mouse, pen, and touch).
  //   1 active pointer  → pan
  //   2 active pointers → pinch zoom around the midpoint, with simultaneous
  //                       midpoint translation so the gesture feels anchored.
  const pointersRef = React.useRef<Map<number, { x: number; y: number }>>(
    new Map(),
  );
  const pinchRef = React.useRef<{
    startDist: number;
    startZoom: number;
    startPan: { x: number; y: number };
    worldX: number;
    worldY: number;
  } | null>(null);

  const screenToWorld = React.useCallback(
    (clientX: number, clientY: number) => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return { x: 0, y: 0 };
      return {
        x: (clientX - r.left - pan.x) / zoom,
        y: (clientY - r.top - pan.y) / zoom,
      };
    },
    [pan.x, pan.y, zoom],
  );

  // Right-click pans even when a draw tool is active, so the user can
  // reposition the canvas mid-sketch without juggling the toolbar.
  const isPanIntent = (e: React.PointerEvent) => {
    if (tool === "select") return true;
    if (e.pointerType === "mouse" && e.button === 2) return true;
    if (e.altKey || e.shiftKey) return true;
    return false;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // Mouse: react to primary (draw / pan) and right (pan-while-drawing).
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2) return;

    // Drawing path — only when a non-select tool is chosen and intent is to
    // draw (not pan via right-click / modifier). Single pointer only;
    // multi-touch still falls through to pan/pinch so two-finger gestures
    // continue to work.
    if (
      !isPanIntent(e) &&
      pointersRef.current.size === 0 &&
      tool !== "select"
    ) {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const { x, y } = screenToWorld(e.clientX, e.clientY);
      drawingRef.current = { kind: tool, startX: x, startY: y };
      if (tool === "pen") {
        setPreviewStroke({
          id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          tool: "pen",
          color,
          size,
          points: [x, y, 1],
        });
      } else if (tool === "arrow") {
        setPreviewShape({
          id: `sh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          kind: "arrow",
          color,
          size,
          geom: [x, y, x, y],
        });
      } else if (tool === "rect") {
        setPreviewShape({
          id: `sh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          kind: "rect",
          color,
          size,
          geom: [x, y, 0, 0],
        });
      }
      return;
    }

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (pointersRef.current.size === 1) {
      draggingRef.current = {
        baseX: pan.x,
        baseY: pan.y,
        startX: e.clientX,
        startY: e.clientY,
      };
      setIsDragging(true);
    } else if (pointersRef.current.size === 2) {
      // Switch from pan → pinch
      draggingRef.current = null;
      const pts = Array.from(pointersRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy) || 1;
      const mx = (pts[0].x + pts[1].x) / 2;
      const my = (pts[0].y + pts[1].y) / 2;
      const r = wrapRef.current?.getBoundingClientRect();
      const lx = r ? mx - r.left : mx;
      const ly = r ? my - r.top : my;
      pinchRef.current = {
        startDist: dist,
        startZoom: zoom,
        startPan: { ...pan },
        worldX: (lx - pan.x) / zoom,
        worldY: (ly - pan.y) / zoom,
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    // Drawing path
    if (drawingRef.current) {
      const { x, y } = screenToWorld(e.clientX, e.clientY);
      const d = drawingRef.current;
      if (d.kind === "pen") {
        setPreviewStroke((cur) =>
          cur ? { ...cur, points: [...cur.points, x, y, 1] } : cur,
        );
      } else if (d.kind === "arrow") {
        setPreviewShape((cur) =>
          cur ? { ...cur, geom: [d.startX, d.startY, x, y] } : cur,
        );
      } else if (d.kind === "rect") {
        setPreviewShape((cur) =>
          cur
            ? {
                ...cur,
                geom: [
                  Math.min(d.startX, x),
                  Math.min(d.startY, y),
                  Math.abs(x - d.startX),
                  Math.abs(y - d.startY),
                ],
              }
            : cur,
        );
      }
      return;
    }

    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy) || 1;
      const next = Math.max(
        0.1,
        Math.min(3, pinchRef.current.startZoom * (dist / pinchRef.current.startDist)),
      );
      const mx = (pts[0].x + pts[1].x) / 2;
      const my = (pts[0].y + pts[1].y) / 2;
      const r = wrapRef.current?.getBoundingClientRect();
      const lx = r ? mx - r.left : mx;
      const ly = r ? my - r.top : my;
      setZoom(next);
      setPan({
        x: lx - pinchRef.current.worldX * next,
        y: ly - pinchRef.current.worldY * next,
      });
      return;
    }
    const d = draggingRef.current;
    if (!d) return;
    setPan({
      x: d.baseX + (e.clientX - d.startX),
      y: d.baseY + (e.clientY - d.startY),
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    // Drawing path: commit preview to the project's flowAnnotations.
    if (drawingRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      drawingRef.current = null;
      const stroke = previewStroke;
      const shape = previewShape;
      setPreviewStroke(null);
      setPreviewShape(null);
      if (!activeProjectId) return;
      if (stroke && stroke.points.length >= 6) {
        void setFlowAnnotations(activeProjectId, (cur) => ({
          ...cur,
          strokes: [...cur.strokes, stroke],
        }));
      } else if (shape) {
        // Suppress accidental zero-size shapes (single click without drag).
        const meaningful =
          shape.kind === "rect"
            ? shape.geom[2] > 4 && shape.geom[3] > 4
            : Math.hypot(
                shape.geom[2] - shape.geom[0],
                shape.geom[3] - shape.geom[1],
              ) > 6;
        if (meaningful) {
          void setFlowAnnotations(activeProjectId, (cur) => ({
            ...cur,
            shapes: [...cur.shapes, shape],
          }));
        }
      }
      return;
    }
    pointersRef.current.delete(e.pointerId);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) {
      draggingRef.current = null;
      setIsDragging(false);
    } else if (pointersRef.current.size === 1) {
      // Re-base pan from the surviving pointer so the canvas doesn't jump.
      const remaining = Array.from(pointersRef.current.values())[0];
      draggingRef.current = {
        baseX: pan.x,
        baseY: pan.y,
        startX: remaining.x,
        startY: remaining.y,
      };
    }
  };

  if (!items.length) {
    return (
      <div className="absolute inset-2 grid place-items-center px-6 text-center bg-[var(--bg-soft)] rounded-[var(--radius-lg)] border border-[var(--border)]">
        <div className="max-w-[440px]">
          <h2 className="text-[18px] font-semibold tracking-tight">
            No pages yet
          </h2>
          <p className="mt-2 text-[13px] text-[var(--fg-muted)]">
            Add pages and screens, then come back here to read the whole
            flow before you start building.
          </p>
        </div>
      </div>
    );
  }

  const pickedCount = frames.filter((f) => f.rep).length;

  return (
    <div
      ref={wrapRef}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
 onContextMenu={(e) => {
 if (tool !== "select") e.preventDefault();
      }}
      className="absolute inset-2 overflow-hidden bg-[var(--bg-soft)] select-none rounded-[var(--radius-lg)] border border-[var(--border)]"
      style={{
        cursor:
          tool !== "select"
            ? "crosshair"
            : isDragging
              ? "grabbing"
              : "grab",
        touchAction: "none",
      }}
    >
      {/* Dotted background grid for canvas feel */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, var(--border) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          opacity: 0.55,
        }}
      />

      {/* World */}
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: totalW,
          height: totalH,
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          willChange: "transform",
        }}
      >
        {/* Connector arrows */}
        {frames.length > 1 && (
          <svg
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            width={totalW}
            height={totalH}
            style={{ overflow: "visible" }}
          >
            {frames.map((f, i) => {
              if (i === 0) return null;
              const prev = frames[i - 1];
              const x1 = prev.x + prev.w;
              const y1 = prev.y + prev.h / 2;
              const x2 = f.x;
              const y2 = f.y + f.h / 2;
              const midX = (x1 + x2) / 2;
              const tipX = x2 - 6;
              return (
                <g key={`c-${i}`} opacity={0.7}>
                  <path
                    d={`M ${x1 + 4} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${tipX - 4} ${y2}`}
                    stroke="var(--fg-subtle)"
                    strokeWidth={1.6}
                    fill="none"
                    strokeDasharray="6 5"
                  />
                  <path
                    d={`M ${tipX - 7} ${y2 - 5} L ${tipX + 1} ${y2} L ${tipX - 7} ${y2 + 5} Z`}
                    fill="var(--fg-subtle)"
                  />
                </g>
              );
            })}
          </svg>
        )}

        {/* Frames */}
        {frames.map(({ page, rep, count, x, y, w, h }, i) => (
          <div
            key={page.id}
            data-frame
            className="absolute"
            style={{ left: x, top: y, width: w, height: h }}
          >
            {/* Page header above the frame */}
            <div className="absolute left-0 right-0 -top-10 flex items-center gap-2 text-[12px] text-[var(--fg-muted)] truncate">
              <span className="tabular-nums text-[12px] font-medium text-[var(--fg-subtle)]">
                {i + 1}
              </span>
              <span className="font-medium text-[var(--fg)] truncate">
                <PageLabel name={page.name} />
              </span>
              <span className="text-[var(--fg-subtle)]">·</span>
              <span>{count} versions</span>
            </div>

            <div
              role={rep ? "button" : undefined}
              tabIndex={rep && tool === "select" ? 0 : undefined}
              onDoubleClick={() => {
                if (!rep) return;
                if (tool !== "select") return;
                setFocused(rep.id);
                setViewMode("single");
              }}
              onKeyDown={(e) => {
                if (!rep) return;
                if (e.key === "Enter") {
                  setFocused(rep.id);
                  setViewMode("single");
                }
              }}
              className={cn(
                "group relative block w-full h-full rounded-[20px] overflow-hidden bg-[var(--bg-soft)]",
                "border border-[var(--border)] shadow-[var(--shadow-pop)] transition-shadow",
                // Cursor inherits the canvas cursor (grab/grabbing) so the
                // user feels the pan affordance even over a frame.
                rep ? "hover:shadow-[var(--shadow-modal)]" : "opacity-60",
              )}
              style={{ cursor: "inherit" }}
            >
              <div className="relative w-full h-full rounded-[inherit] overflow-hidden">
                {rep ? (
                  <Thumb
 blobId={rep.thumbBlobId ?? rep.blobId}
 fit="contain"
 className="absolute inset-0"
 imageWidth={rep.width}
 imageHeight={rep.height}
 annotations={rep.annotations}
 rounded="inherit"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-[12px] text-[var(--fg-subtle)]">
                    No screen yet
                  </div>
                )}

                {/* Verdict pill, top-left */}
                {rep && rep.verdict !== "unset" && (
                  <div
                    className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-1.5 h-[20px] rounded-[var(--radius-sm)] text-[11px] font-medium bg-[var(--surface)]/85 backdrop-blur-sm border border-[var(--border)] text-[var(--fg)]"
                    style={{
                      boxShadow:
                        rep.verdict === "winner"
                          ? `inset 0 0 0 1px var(--winner)`
                          : `inset 0 0 0 1px ${VERDICT_COLOR[rep.verdict]}55`,
                    }}
                  >
                    {rep.verdict === "winner" ? (
                      <Crown size={11} className="text-[var(--winner)]" />
                    ) : (
                      <span
                        className="dot"
                        style={{ background: VERDICT_COLOR[rep.verdict] }}
                      />
                    )}
                    {VERDICT_LABEL[rep.verdict]}
                  </div>
                )}

                {/* Version label, top-right */}
                {rep && (
                  <div className="absolute top-2.5 right-2.5 px-1.5 h-[20px] inline-flex items-center rounded-[var(--radius-sm)] text-[11px] font-medium bg-[var(--surface)]/85 backdrop-blur-sm border border-[var(--border)]">
                    {rep.label}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Whiteboard layer — strokes / shapes the user drew on top of the
            flow itself. World-coord SVG so it pans / zooms with the
            frames. Sits above the frames so marks land on the artwork. */}
        <svg
          aria-hidden
          className="absolute top-0 left-0 pointer-events-none"
          width={totalW}
          height={totalH}
          style={{ overflow: "visible" }}
        >
          <defs>
            {Array.from(
              new Set([
                ...flowAnnotations.shapes
                  .filter((s) => s.kind === "arrow")
                  .map((s) => s.color),
                previewShape && previewShape.kind === "arrow"
                  ? previewShape.color
                  : "",
              ]),
            )
              .filter(Boolean)
              .map((c) => (
                <marker
                  key={`arrow-${c}`}
                  id={`flow-arrow-${c.replace("#", "")}`}
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={c} />
                </marker>
              ))}
          </defs>
          {[...flowAnnotations.strokes, ...(previewStroke ? [previewStroke] : [])].map(
            (st) => {
              if (st.points.length < 4) return null;
              let d = `M ${st.points[0]} ${st.points[1]}`;
              for (let i = 3; i < st.points.length; i += 3) {
                d += ` L ${st.points[i]} ${st.points[i + 1]}`;
              }
              return (
                <path
                  key={st.id}
                  d={d}
                  stroke={st.color}
                  strokeWidth={st.size}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              );
            },
          )}
          {[...flowAnnotations.shapes, ...(previewShape ? [previewShape] : [])].map(
            (sh) => {
              if (sh.kind === "rect") {
                const [x, y, w, h] = sh.geom;
                return (
                  <rect
                    key={sh.id}
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    stroke={sh.color}
                    strokeWidth={sh.size}
                    fill="none"
                    rx={4}
                  />
                );
              }
              const [x1, y1, x2, y2] = sh.geom;
              return (
                <line
                  key={sh.id}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={sh.color}
                  strokeWidth={sh.size}
                  strokeLinecap="round"
                  markerEnd={`url(#flow-arrow-${sh.color.replace("#", "")})`}
                />
              );
            },
          )}
        </svg>
      </div>

      {/* Drawing toolbar — left side, floats above the canvas. Inert when
          collapsed to "select" so panning isn't intercepted. */}
      <FlowDrawingToolbar
        tool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        size={size}
        setSize={setSize}
        canUndo={
          flowAnnotations.strokes.length + flowAnnotations.shapes.length > 0
        }
        onUndo={() => {
          if (!activeProjectId) return;
          void setFlowAnnotations(activeProjectId, (cur) => {
            const lastStroke = cur.strokes[cur.strokes.length - 1];
            const lastShape = cur.shapes[cur.shapes.length - 1];
            // Pop whichever was added most recently. We approximate with id
            // suffix (timestamp-encoded) since we don't store explicit order.
            const strokeTs = lastStroke
              ? Number(lastStroke.id.split("_")[1] || 0)
              : -1;
            const shapeTs = lastShape
              ? Number(lastShape.id.split("_")[1] || 0)
              : -1;
            if (strokeTs >= shapeTs && lastStroke) {
              return { ...cur, strokes: cur.strokes.slice(0, -1) };
            }
            if (lastShape) {
              return { ...cur, shapes: cur.shapes.slice(0, -1) };
            }
            return cur;
          });
        }}
        onClear={() => {
          if (!activeProjectId) return;
          void setFlowAnnotations(activeProjectId, {
            strokes: [],
            shapes: [],
            notes: [],
          });
        }}
      />

      {/* Toolbar — top center, floats above the canvas */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 px-1 h-9 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-pop)]">
        <span className="px-2 text-[11.5px] text-[var(--fg-muted)] tabular-nums select-none">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => zoomAroundCenter(zoom / 1.2)}
          className="h-7 w-7 grid place-items-center rounded-[var(--radius-sm)] hover:bg-[var(--bg-soft)] text-[var(--fg-muted)] hover:text-[var(--fg)] focus-ring"
          aria-label="Zoom out"
        >
          <Minus size={12} />
        </button>
        <button
          type="button"
          onClick={() => zoomAroundCenter(zoom * 1.2)}
          className="h-7 w-7 grid place-items-center rounded-[var(--radius-sm)] hover:bg-[var(--bg-soft)] text-[var(--fg-muted)] hover:text-[var(--fg)] focus-ring"
          aria-label="Zoom in"
        >
          <Plus size={12} />
        </button>
        <span className="mx-1 h-4 w-px bg-[var(--border)]" />
        <button
          type="button"
          onClick={fitCamera}
          className="h-7 px-2 text-[11.5px] rounded-[var(--radius-sm)] hover:bg-[var(--bg-soft)] inline-flex items-center gap-1 text-[var(--fg-muted)] hover:text-[var(--fg)] focus-ring"
        >
          <Minimize2 size={11} /> Fit
        </button>
        <button
          type="button"
          onClick={actualSize}
          className="h-7 px-2 text-[11.5px] rounded-[var(--radius-sm)] hover:bg-[var(--bg-soft)] inline-flex items-center gap-1 text-[var(--fg-muted)] hover:text-[var(--fg)] focus-ring"
        >
          <Maximize2 size={11} /> 100%
        </button>
        <span className="mx-1 h-4 w-px bg-[var(--border)]" />
        <span className="px-2 text-[11.5px] text-[var(--fg-muted)] select-none">
          {pickedCount}/{frames.length} pages picked
        </span>
      </div>
    </div>
  );
}

function FlowDrawingToolbar({
  tool,
  setTool,
  color,
  setColor,
  size,
  setSize,
  canUndo,
  onUndo,
  onClear,
}: {
  tool: FlowTool;
  setTool: (t: FlowTool) => void;
  color: string;
  setColor: (c: string) => void;
  size: number;
  setSize: (n: number) => void;
  canUndo: boolean;
  onUndo: () => void;
  onClear: () => void;
}) {
  const tools: { key: FlowTool; icon: React.ReactNode; label: string }[] = [
    { key: "select", icon: <MousePointer2 size={14} />, label: "Pan / select (V)" },
    { key: "pen", icon: <Pencil size={14} />, label: "Pen (P)" },
    { key: "arrow", icon: <ArrowUpRight size={14} />, label: "Arrow (A)" },
    { key: "rect", icon: <Square size={14} />, label: "Rectangle (R)" },
  ];

  // Keyboard shortcuts for tool switching while no input is focused.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "v" || e.key === "V") setTool("select");
      else if (e.key === "p" || e.key === "P") setTool("pen");
      else if (e.key === "a" || e.key === "A") setTool("arrow");
      else if (e.key === "r" || e.key === "R") setTool("rect");
      else if (e.key === "Escape") setTool("select");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTool]);

  // Single capsule pill at bottom-center, matching the Quick Look style:
  // rounded-full, semi-transparent surface + backdrop blur, dot separators
  // between groups instead of full borders.
  return (
    <div
      className={cn(
        "absolute left-1/2 -translate-x-1/2 bottom-4 z-10",
        "inline-flex items-center gap-1 px-2 h-10 rounded-full",
        "bg-[var(--surface)]/85 backdrop-blur-md border border-[var(--border)]",
      )}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      {tools.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => setTool(t.key)}
          aria-label={t.label}
          title={t.label}
          className={cn(
            "h-8 w-8 grid place-items-center rounded-full focus-ring transition-colors",
            tool === t.key
              ? "bg-[var(--brand)] text-[var(--brand-fg)]"
              : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]",
          )}
        >
          {t.icon}
        </button>
      ))}

      <span className="mx-1 h-1 w-1 rounded-full bg-[var(--border)]" />

      {/* Color swatches */}
      {FLOW_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setColor(c)}
          aria-label={`Color ${c}`}
          className={cn(
            "h-5 w-5 rounded-full border focus-ring transition-transform",
            color === c
              ? "border-[var(--fg)] scale-110"
              : "border-[var(--border)] hover:border-[var(--fg-muted)]",
          )}
          style={{ background: c }}
        />
      ))}

      <span className="mx-1 h-1 w-1 rounded-full bg-[var(--border)]" />

      {/* Size — three steps */}
      {[2, 4, 8].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => setSize(n)}
          aria-label={`Brush ${n}`}
          className={cn(
            "h-7 w-7 grid place-items-center rounded-full hover:bg-[var(--bg-soft)] focus-ring",
            size === n && "bg-[var(--bg-soft)]",
          )}
        >
          <span
            className="block rounded-full"
            style={{
              background: "currentColor",
              width: Math.min(12, n + 2),
              height: Math.min(12, n + 2),
            }}
          />
        </button>
      ))}

      <span className="mx-1 h-1 w-1 rounded-full bg-[var(--border)]" />

      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo last mark"
        title="Undo last mark"
        className={cn(
          "h-8 w-8 grid place-items-center rounded-full focus-ring",
          canUndo
            ? "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]"
            : "text-[var(--fg-subtle)] opacity-40 cursor-not-allowed",
        )}
      >
        <Undo2 size={14} />
      </button>
      <button
        type="button"
        onClick={() => {
          if (!canUndo) return;
          if (
            typeof window !== "undefined" &&
            !window.confirm("Clear all flow marks?")
          )
            return;
          onClear();
        }}
        disabled={!canUndo}
        aria-label="Clear all marks"
        title="Clear all marks"
        className={cn(
          "h-8 w-8 grid place-items-center rounded-full focus-ring",
          canUndo
            ? "text-[var(--danger)] hover:bg-[var(--bg-soft)]"
            : "text-[var(--fg-subtle)] opacity-40 cursor-not-allowed",
        )}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
