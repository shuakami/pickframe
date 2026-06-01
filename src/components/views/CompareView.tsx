"use client";

import * as React from "react";
import { useStore } from "@/lib/store";
import { Thumb } from "../primitives/Thumb";
import { Button } from "../primitives/Button";
import * as ContextMenu from "@radix-ui/react-context-menu";
import {
  ChevronDown,
  X,
  Crown,
  Plus,
  Minus,
  Minimize2,
  Maximize2,
  ArrowLeft,
  ArrowUpRight,
  ImageIcon,
  ClipboardCopy,
  Download,
  CircleDashed,
  ChevronRight,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  VERDICT_COLOR,
  VERDICT_LABEL,
  VERDICTS,
  type Verdict,
} from "@/lib/types";
import { copyImageToClipboard, saveImageToDisk } from "@/lib/imageActions";

/**
 * Compare — a pannable, zoomable canvas (same camera as Flow) that lays out
 * every pinned version side by side at its true aspect ratio. Unlike the old
 * fixed grid it has no version cap and no wheel-trapped horizontal scrollbar:
 * drag to pan, scroll to zoom, exactly like Flow.
 *
 * Interactions:
 *  - Drag empty canvas to pan; scroll to zoom around cursor; shift+scroll or
 *    trackpad two-finger to pan; pinch to zoom on touch.
 *  - Hover a frame for its actions (Pick this / Open / Remove).
 *  - Double-click a frame to open it in Single view.
 */

const FRAME_HEIGHT = 560; // px at zoom = 1
const GUTTER = 56; // gap between frames
const VPAD = 72; // top/bottom padding inside the world
const HPAD = 64; // left/right padding inside the world

export function CompareView() {
  const compareIds = useStore((s) => s.compareIds);
  const versions = useStore((s) => s.versions);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const setVerdict = useStore((s) => s.setVerdict);
  const toggleCompare = useStore((s) => s.toggleCompare);
  const setFocused = useStore((s) => s.setFocused);
  const setViewMode = useStore((s) => s.setViewMode);

  const [pickerOpen, setPickerOpen] = React.useState(false);
  // Which frame is hovered/focused — drives its action chips. Done in state
  // rather than `group-hover:` because Tailwind v4 gates hover variants behind
  // `@media (hover: hover)`, so they never show on touch / pen.
  const [activeFrameId, setActiveFrameId] = React.useState<string | null>(null);

  const compareVersions = React.useMemo(
    () =>
      compareIds
        .map((id) => versions.find((v) => v.id === id))
        .filter(Boolean) as typeof versions,
    [compareIds, versions],
  );

  const candidates = React.useMemo(
    () =>
      versions
        .filter((v) => v.projectId === activeProjectId)
        .filter((v) => !compareIds.includes(v.id))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [versions, activeProjectId, compareIds],
  );

  // Frame layout: left-to-right, each frame keeps the image's aspect ratio.
  const frames = React.useMemo(() => {
    return compareVersions.reduce<
      {
        v: (typeof compareVersions)[number];
        x: number;
        y: number;
        w: number;
        h: number;
      }[]
    >((acc, v) => {
      const aspect =
        v.width > 0 && v.height > 0 ? v.width / v.height : 9 / 19.5;
      const h = FRAME_HEIGHT;
      const w = Math.max(180, Math.round(h * aspect));
      const prev = acc[acc.length - 1];
      const x = prev ? prev.x + prev.w + GUTTER : HPAD;
      acc.push({ v, x, y: VPAD, w, h });
      return acc;
    }, []);
  }, [compareVersions]);

  const totalW =
    frames.length > 0
      ? frames[frames.length - 1].x + frames[frames.length - 1].w + HPAD
      : HPAD * 2;
  const totalH = FRAME_HEIGHT + VPAD * 2;

  // Camera (pan in viewport px, zoom is a multiplier).
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  // While panning/zooming we keep the world on its own GPU layer
  // (translate3d + will-change) for smoothness; at rest we drop to a plain 2D
  // transform so the browser re-rasterizes the images crisply at the current
  // zoom instead of GPU-upscaling a cached low-res bitmap (which looked blurry).
  const [isZooming, setIsZooming] = React.useState(false);
  const zoomIdleRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const markZooming = React.useCallback(() => {
    setIsZooming(true);
    if (zoomIdleRef.current) clearTimeout(zoomIdleRef.current);
    zoomIdleRef.current = setTimeout(() => setIsZooming(false), 180);
  }, []);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const draggingRef = React.useRef<{
    baseX: number;
    baseY: number;
    startX: number;
    startY: number;
  } | null>(null);

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

  // Re-fit when the scene changes (project / number of frames / total size).
  const fitKey = `${activeProjectId ?? "_"}:${frames.length}:${totalW}`;
  const lastFitKeyRef = React.useRef<string | null>(null);
  React.useLayoutEffect(() => {
    if (lastFitKeyRef.current === fitKey) return;
    lastFitKeyRef.current = fitKey;
    fitCamera();
  }, [fitKey, fitCamera]);

  // Wheel: plain scroll zooms around the cursor; shift / trackpad pans.
  const onWheel = (e: React.WheelEvent) => {
    markZooming();
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

  // Pointer-based pan (1 pointer) + pinch zoom (2 pointers).
  const pointersRef = React.useRef<Map<number, { x: number; y: number }>>(
    new Map(),
  );
  const pinchRef = React.useRef<{
    startDist: number;
    startZoom: number;
    worldX: number;
    worldY: number;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    // Only the left button pans. Right-click is reserved for the context menu;
    // middle / back / forward are ignored.
    if (e.pointerType === "mouse" && e.button !== 0) return;
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
      draggingRef.current = null;
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const mx = (pts[0].x + pts[1].x) / 2;
      const my = (pts[0].y + pts[1].y) / 2;
      const r = wrapRef.current?.getBoundingClientRect();
      const lx = r ? mx - r.left : mx;
      const ly = r ? my - r.top : my;
      pinchRef.current = {
        startDist: dist,
        startZoom: zoom,
        worldX: (lx - pan.x) / zoom,
        worldY: (ly - pan.y) / zoom,
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
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
      const remaining = Array.from(pointersRef.current.values())[0];
      draggingRef.current = {
        baseX: pan.x,
        baseY: pan.y,
        startX: remaining.x,
        startY: remaining.y,
      };
    }
  };

  if (compareVersions.length === 0) {
    return (
      <div className="absolute inset-0 grid place-items-center px-6 text-center">
        <div className="max-w-[400px]">
          <h2 className="text-[18px] font-semibold tracking-tight">
            Pick 2 or more to compare
          </h2>
          <p className="mt-2 text-[13px] text-[var(--fg-muted)]">
            Shift- or ⌘-click cards on the board, then hit&nbsp;
            <b>Compare</b> — or use <b>Compare all</b> on a page header to
            line up every version. Add more from the menu below.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setViewMode("board")}>
              <ArrowLeft size={12} />
              Back
            </Button>
            <PickerButton
              candidates={candidates.map((v) => ({
                id: v.id,
                label: v.label,
                blobId: v.thumbBlobId ?? v.blobId,
              }))}
              onPick={(id) => toggleCompare(id)}
              onOpenChange={setPickerOpen}
              open={pickerOpen}
              align="left"
            />
          </div>
        </div>
      </div>
    );
  }

  const interacting = isDragging || isZooming;

  return (
    <div
      ref={wrapRef}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
      className="absolute inset-2 overflow-hidden bg-[var(--bg-soft)] select-none rounded-[var(--radius-lg)] border border-[var(--border)]"
      style={{ cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
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
          transform: interacting
            ? `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`
            : `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          willChange: interacting ? "transform" : "auto",
        }}
      >
        {frames.map(({ v, x, y, w, h }, i) => (
          <div
            key={v.id}
            data-frame
            className="absolute"
            style={{ left: x, top: y, width: w, height: h }}
          >
            {/* Index + label above the frame */}
            <div className="absolute left-0 right-0 -top-9 flex items-center gap-2 text-[13px] truncate">
              <span className="tabular-nums font-medium text-[var(--fg-subtle)]">
                {i + 1}
              </span>
              <span className="font-medium text-[var(--fg)] truncate">
                {v.label}
              </span>
            </div>

            <ContextMenu.Root>
            <ContextMenu.Trigger asChild>
            <div
              role="button"
              tabIndex={0}
              onDoubleClick={() => {
                setFocused(v.id);
                setViewMode("single");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setFocused(v.id);
                  setViewMode("single");
                }
              }}
              onMouseEnter={() => setActiveFrameId(v.id)}
              onMouseLeave={() =>
                setActiveFrameId((cur) => (cur === v.id ? null : cur))
              }
              onFocus={() => setActiveFrameId(v.id)}
              onBlur={() =>
                setActiveFrameId((cur) => (cur === v.id ? null : cur))
              }
              className="relative block w-full h-full rounded-[20px] overflow-hidden bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-pop)] transition-shadow"
              style={{ cursor: "inherit" }}
            >
              <div className="relative w-full h-full rounded-[inherit] overflow-hidden checkered">
                <Thumb
                  blobId={v.blobId}
                  fit="contain"
                  className="absolute inset-0"
                  imageWidth={v.width}
                  imageHeight={v.height}
                  annotations={v.annotations}
                  rounded="inherit"
                />

                {/* Verdict pill, top-left */}
                {v.verdict !== "unset" && (
                  <div
                    className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-1.5 h-[22px] rounded-[var(--radius-sm)] text-[11px] font-medium bg-[var(--surface)]/85 backdrop-blur-sm border border-[var(--border)] text-[var(--fg)]"
                    style={{
                      boxShadow:
                        v.verdict === "winner"
                          ? `inset 0 0 0 1px var(--winner)`
                          : `inset 0 0 0 1px ${VERDICT_COLOR[v.verdict]}55`,
                    }}
                  >
                    {v.verdict === "winner" ? (
                      <Crown size={11} className="text-[var(--winner)]" />
                    ) : (
                      <span
                        className="dot"
                        style={{ background: VERDICT_COLOR[v.verdict] }}
                      />
                    )}
                    {VERDICT_LABEL[v.verdict]}
                  </div>
                )}

                {/* Hover actions, top-right. stopPropagation on pointer down so
                    clicking a button never starts a canvas pan. */}
                <div
                  className={cn(
                    "absolute top-2.5 right-2.5 flex items-center gap-1 transition-opacity",
                    activeFrameId === v.id ? "opacity-100" : "opacity-0",
                  )}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setVerdict(v.id, "winner")}
                    aria-label="Pick this as winner"
                    className="h-[26px] px-2 inline-flex items-center gap-1 rounded-[var(--radius-sm)] text-[11px] font-medium bg-[var(--surface)]/90 backdrop-blur-sm border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--surface)] focus-ring"
                  >
                    <Crown size={11} />
                    Pick
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFocused(v.id);
                      setViewMode("single");
                    }}
                    aria-label="Open in single view"
                    className="h-[26px] w-[26px] grid place-items-center rounded-[var(--radius-sm)] bg-[var(--surface)]/90 backdrop-blur-sm border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] focus-ring"
                  >
                    <ArrowUpRight size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleCompare(v.id)}
                    aria-label="Remove from compare"
                    className="h-[26px] w-[26px] grid place-items-center rounded-[var(--radius-sm)] bg-[var(--surface)]/90 backdrop-blur-sm border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--danger)] focus-ring"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            </div>
            </ContextMenu.Trigger>
            <ContextMenu.Portal>
              <ContextMenu.Content
                className={cn(
                  "z-[60] min-w-[200px] p-1",
                  "bg-[var(--surface)] border border-[var(--border)]",
                  "rounded-[var(--radius-md)] shadow-[var(--shadow-pop)]",
                  "data-[state=open]:animate-cm-in data-[state=closed]:animate-cm-out",
                )}
              >
                <MenuItem
                  onSelect={() => copyImageToClipboard(v.blobId)}
                  icon={<ClipboardCopy size={12} />}
                  label="Copy image"
                />
                <MenuItem
                  onSelect={() =>
                    saveImageToDisk(v.blobId, v.label || "version")
                  }
                  icon={<Download size={12} />}
                  label="Save image…"
                />
                <ContextMenu.Separator className="h-px bg-[var(--border)] my-1 -mx-1" />
                <MenuItem
                  onSelect={() => {
                    setFocused(v.id);
                    setViewMode("single");
                  }}
                  icon={<ImageIcon size={12} />}
                  label="Open in single view"
                />
                <MenuItem
                  onSelect={() => setVerdict(v.id, "winner")}
                  icon={<Crown size={12} className="text-[var(--winner)]" />}
                  label="Pick as winner"
                />
                <ContextMenu.Sub>
                  <ContextMenu.SubTrigger className="flex items-center gap-2 px-2 py-1.5 text-[12.5px] text-[var(--fg)] data-[state=open]:bg-[var(--bg-soft)] hover:bg-[var(--bg-soft)] rounded-[var(--radius-sm)] cursor-default outline-none">
                    <span className="text-[var(--fg-subtle)]">
                      <CircleDashed size={12} />
                    </span>
                    <span className="flex-1">Set verdict</span>
                    <ChevronRight size={12} className="text-[var(--fg-subtle)]" />
                  </ContextMenu.SubTrigger>
                  <ContextMenu.Portal>
                    <ContextMenu.SubContent
                      sideOffset={4}
                      className={cn(
                        "min-w-[160px] p-1",
                        "bg-[var(--surface)] border border-[var(--border)]",
                        "rounded-[var(--radius-md)] shadow-[var(--shadow-pop)]",
                        "data-[state=open]:animate-cm-in data-[state=closed]:animate-cm-out",
                      )}
                    >
                      {VERDICTS.map((vd) => (
                        <MenuItem
                          key={vd}
                          onSelect={() => setVerdict(v.id, vd as Verdict)}
                          icon={
                            vd === "winner" ? (
                              <Crown size={12} className="text-[var(--winner)]" />
                            ) : (
                              <span
                                className="dot"
                                style={{
                                  background:
                                    vd === "unset"
                                      ? "transparent"
                                      : VERDICT_COLOR[vd as Verdict],
                                  outline:
                                    vd === "unset"
                                      ? "1px dashed var(--fg-subtle)"
                                      : undefined,
                                  outlineOffset: vd === "unset" ? -1 : undefined,
                                }}
                              />
                            )
                          }
                          label={VERDICT_LABEL[vd as Verdict]}
                          trailing={
                            v.verdict === vd ? (
                              <Check size={11} className="text-[var(--fg-muted)]" />
                            ) : null
                          }
                        />
                      ))}
                    </ContextMenu.SubContent>
                  </ContextMenu.Portal>
                </ContextMenu.Sub>
                <ContextMenu.Separator className="h-px bg-[var(--border)] my-1 -mx-1" />
                <MenuItem
                  onSelect={() => toggleCompare(v.id)}
                  icon={<X size={12} />}
                  label="Remove from compare"
                  tone="danger"
                />
              </ContextMenu.Content>
            </ContextMenu.Portal>
            </ContextMenu.Root>
          </div>
        ))}
      </div>

      {/* Top-left: back + count */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1 px-1 h-9 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-pop)]">
        <button
          type="button"
          onClick={() => setViewMode("board")}
          className="h-7 px-2 inline-flex items-center gap-1 rounded-[var(--radius-sm)] text-[11.5px] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)] focus-ring"
        >
          <ArrowLeft size={12} />
          Back
        </button>
        <span className="mx-0.5 h-4 w-px bg-[var(--border)]" />
        <span className="px-2 text-[11.5px] text-[var(--fg-muted)] tabular-nums select-none">
          Compare · {compareVersions.length}
        </span>
      </div>

      {/* Top-center: zoom toolbar */}
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
      </div>

      {/* Top-right: add version */}
      <div
        className="absolute top-3 right-3 z-10"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <PickerButton
          candidates={candidates.map((v) => ({
            id: v.id,
            label: v.label,
            blobId: v.thumbBlobId ?? v.blobId,
          }))}
          onPick={(id) => toggleCompare(id)}
          onOpenChange={setPickerOpen}
          open={pickerOpen}
          align="right"
        />
      </div>
    </div>
  );
}

function PickerButton({
  candidates,
  onPick,
  open,
  onOpenChange,
  disabled,
  align = "right",
}: {
  candidates: { id: string; label: string; blobId: string }[];
  onPick: (id: string) => void;
  open: boolean;
  onOpenChange: (b: boolean) => void;
  disabled?: boolean;
  align?: "left" | "right";
}) {
  return (
    <div className="relative">
      <Button
        size="sm"
        variant="outline"
        onClick={() => onOpenChange(!open)}
        disabled={disabled}
      >
        Add version
        <ChevronDown size={12} />
      </Button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => onOpenChange(false)}
          />
          <div
            className={cn(
              "absolute top-9 z-40 w-[260px] max-h-[320px] overflow-y-auto",
              align === "right" ? "right-0" : "left-0",
              "bg-[var(--surface)] border border-[var(--border)]",
              "rounded-[var(--radius-md)] shadow-[var(--shadow-modal)] pop-in py-1.5",
            )}
          >
            {candidates.length === 0 && (
              <div className="px-3 py-3 text-[12px] text-[var(--fg-subtle)]">
                Nothing left to add
              </div>
            )}
            {candidates.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onPick(c.id);
                  onOpenChange(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[var(--bg-soft)]"
              >
                <Thumb
                  blobId={c.blobId}
                  className="w-7 h-9 rounded-[4px] shrink-0"
                />
                <span className="text-[12.5px]">{c.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  onSelect,
  icon,
  label,
  trailing,
  tone,
}: {
  onSelect: () => void;
  icon?: React.ReactNode;
  label: string;
  trailing?: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <ContextMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] text-[12.5px] cursor-default outline-none",
        tone === "danger"
          ? "text-[var(--danger)] data-[highlighted]:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
          : "text-[var(--fg)] data-[highlighted]:bg-[var(--bg-soft)]",
      )}
    >
      <span
        className={cn(
          "shrink-0",
          tone === "danger" ? "" : "text-[var(--fg-subtle)]",
        )}
      >
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {trailing}
    </ContextMenu.Item>
  );
}
