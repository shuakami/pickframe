"use client";

import * as React from "react";

/**
 * Imperative pan/zoom camera for the Compare & Flow canvases.
 *
 * The old implementation called `setPan`/`setZoom` on every pointermove and
 * wheel tick, re-rendering the whole canvas (and every framed image) 60+ times
 * a second — that's what made dragging a board of high-res screens stutter.
 *
 * Here the live camera lives in a ref and is written straight to the world
 * element's `transform` inside a single `requestAnimationFrame`, so a drag
 * touches the DOM once per frame and never goes through React. React state is
 * updated only at gesture *end* (and for discrete actions like Fit/100%), which
 * is also when we drop the GPU layer and switch to a plain 2D transform so the
 * browser re-rasterizes the images crisply at the current zoom — full
 * resolution, no compression, no blur.
 *
 * Bonus: while the camera moves we tuck the floating top chrome (Back / zoom /
 * add) out of the way the moment content slides under it, and pop it back when
 * the pointer returns to the top edge.
 */

export interface PanZoomOptions {
  /** World width in px at zoom = 1. */
  totalW: number;
  /** World height in px at zoom = 1. */
  totalH: number;
  minZoom?: number;
  maxZoom?: number;
  /** Margin used when fitting the world into the viewport. */
  fitMargin?: number;
  /**
   * World-space Y where the visible content starts (e.g. just above the first
   * frame's label). Used to decide when to tuck the top chrome away.
   */
  contentTopWorldY?: number;
  /** Screen-space Y below which content is considered to be under the chrome. */
  chromeTuckThreshold?: number;
  /** Mouse buttons that start a pan. Defaults to [0] (left only). */
  panButtons?: number[];
}

export interface PanZoom {
  wrapRef: React.RefObject<HTMLDivElement | null>;
  worldRef: React.RefObject<HTMLDivElement | null>;
  /** Attach to the element showing the zoom %, updated imperatively mid-gesture. */
  zoomReadoutRef: React.RefObject<HTMLSpanElement | null>;
  /** Attach to the wrapper holding the floating top toolbars (auto-tucks). */
  chromeRef: React.RefObject<HTMLDivElement | null>;

  /** Committed camera — drives the at-rest (crisp) render. */
  zoom: number;
  pan: { x: number; y: number };
  /** True while a gesture is in flight (GPU layer + translate3d). */
  interacting: boolean;
  /** True while a one-pointer pan drag is active (for cursor styling). */
  isPanning: boolean;

  onWheel: (e: React.WheelEvent) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;

  fit: () => void;
  actualSize: () => void;
  zoomBy: (factor: number) => void;

  /** Convert client coords to world coords using the live camera. */
  screenToWorld: (clientX: number, clientY: number) => { x: number; y: number };
}

interface Cam {
  zoom: number;
  panX: number;
  panY: number;
}

export function usePanZoom(opts: PanZoomOptions): PanZoom {
  const {
    minZoom = 0.1,
    maxZoom = 3,
    fitMargin = 64,
    contentTopWorldY = 0,
    chromeTuckThreshold = 52,
    panButtons = [0],
  } = opts;
  // Keep the latest layout numbers in refs so the stable callbacks below always
  // fit/clamp against the current world size without being recreated. Synced in
  // a layout effect (mutating a ref during render is disallowed) — this runs
  // before any consumer's own layout effect (e.g. auto-fit) since this hook is
  // called first.
  const panButtonsRef = React.useRef(panButtons);
  const sizeRef = React.useRef({ totalW: opts.totalW, totalH: opts.totalH });
  const tuckRef = React.useRef({ contentTopWorldY, chromeTuckThreshold });
  React.useLayoutEffect(() => {
    panButtonsRef.current = panButtons;
    sizeRef.current = { totalW: opts.totalW, totalH: opts.totalH };
    tuckRef.current = { contentTopWorldY, chromeTuckThreshold };
  });

  const wrapRef = React.useRef<HTMLDivElement>(null);
  const worldRef = React.useRef<HTMLDivElement>(null);
  const zoomReadoutRef = React.useRef<HTMLSpanElement>(null);
  const chromeRef = React.useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [interacting, setInteracting] = React.useState(false);
  const [isPanning, setIsPanning] = React.useState(false);

  // Live camera (source of truth during a gesture).
  const camRef = React.useRef<Cam>({ zoom: 1, panX: 0, panY: 0 });
  // Keep the live camera synced with committed state so the next gesture (or a
  // screenToWorld during drawing) starts from the right place.
  React.useEffect(() => {
    camRef.current = { zoom, panX: pan.x, panY: pan.y };
  }, [zoom, pan.x, pan.y]);

  const interactingRef = React.useRef(false);
  const peekRef = React.useRef(false);
  const rafRef = React.useRef(0);
  const idleRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clampZoom = React.useCallback(
    (z: number) => Math.max(minZoom, Math.min(maxZoom, z)),
    [minZoom, maxZoom],
  );

  const applyTransform = React.useCallback(() => {
    rafRef.current = 0;
    const { zoom: z, panX, panY } = camRef.current;
    // Only drive the transform imperatively during a gesture (GPU translate3d
    // layer). At rest React owns it and renders a plain 2D translate so the
    // browser re-rasterizes the screens crisply at full resolution.
    const el = worldRef.current;
    if (el && interactingRef.current) {
      el.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${z})`;
    }
    const ro = zoomReadoutRef.current;
    if (ro) ro.textContent = `${Math.round(z * 100)}%`;

    const chrome = chromeRef.current;
    if (chrome) {
      const { contentTopWorldY: ctw, chromeTuckThreshold: thr } =
        tuckRef.current;
      const contentTopScreen = panY + ctw * z;
      const intrude = contentTopScreen < thr;
      chrome.dataset.tuck = intrude && !peekRef.current ? "true" : "false";
    }
  }, []);

  const schedule = React.useCallback(() => {
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(applyTransform);
    }
  }, [applyTransform]);

  const beginInteract = React.useCallback(() => {
    if (!interactingRef.current) {
      interactingRef.current = true;
      setInteracting(true);
    }
  }, []);

  const commit = React.useCallback(() => {
    const c = camRef.current;
    setZoom(c.zoom);
    setPan({ x: c.panX, y: c.panY });
  }, []);

  const endInteract = React.useCallback(() => {
    if (idleRef.current) {
      clearTimeout(idleRef.current);
      idleRef.current = null;
    }
    interactingRef.current = false;
    commit();
    setInteracting(false);
  }, [commit]);

  // Debounced end for momentum-free inputs (wheel / pinch) where there's no
  // explicit "up" to settle on.
  const endInteractSoon = React.useCallback(() => {
    if (idleRef.current) clearTimeout(idleRef.current);
    idleRef.current = setTimeout(endInteract, 180);
  }, [endInteract]);

  React.useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (idleRef.current) clearTimeout(idleRef.current);
    };
  }, []);

  // ---- Wheel: scroll to zoom around cursor; shift / trackpad to pan. --------
  const onWheel = React.useCallback(
    (e: React.WheelEvent) => {
      const isPinch = e.ctrlKey || e.metaKey;
      const isTrackpadPan = !isPinch && Math.abs(e.deltaX) > 0;
      const cam = camRef.current;

      beginInteract();
      if (e.shiftKey && !isPinch) {
        camRef.current = { ...cam, panX: cam.panX - e.deltaY };
      } else if (isTrackpadPan) {
        camRef.current = {
          ...cam,
          panX: cam.panX - e.deltaX,
          panY: cam.panY - e.deltaY,
        };
      } else {
        const r = wrapRef.current?.getBoundingClientRect();
        if (!r) return;
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        const wx = (mx - cam.panX) / cam.zoom;
        const wy = (my - cam.panY) / cam.zoom;
        const next = clampZoom(cam.zoom * (1 - e.deltaY * 0.0018));
        camRef.current = {
          zoom: next,
          panX: mx - wx * next,
          panY: my - wy * next,
        };
      }
      schedule();
      endInteractSoon();
    },
    [beginInteract, clampZoom, schedule, endInteractSoon],
  );

  // ---- Pointer pan (1 pointer) + pinch zoom (2 pointers). -------------------
  const pointersRef = React.useRef<Map<number, { x: number; y: number }>>(
    new Map(),
  );
  const dragRef = React.useRef<{
    baseX: number;
    baseY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const pinchRef = React.useRef<{
    startDist: number;
    startZoom: number;
    worldX: number;
    worldY: number;
  } | null>(null);

  const updatePeek = React.useCallback((clientY: number) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const nearTop = clientY - r.top < 64;
    if (nearTop !== peekRef.current) {
      peekRef.current = nearTop;
      const chrome = chromeRef.current;
      if (chrome) chrome.dataset.peek = nearTop ? "true" : "false";
    }
  }, []);

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      const target = e.target as Node | null;
      if (target && wrapRef.current && !wrapRef.current.contains(target)) return;
      if (
        e.pointerType === "mouse" &&
        !panButtonsRef.current.includes(e.button)
      )
        return;

      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      beginInteract();
      const cam = camRef.current;
      if (pointersRef.current.size === 1) {
        dragRef.current = {
          baseX: cam.panX,
          baseY: cam.panY,
          startX: e.clientX,
          startY: e.clientY,
        };
        setIsPanning(true);
      } else if (pointersRef.current.size === 2) {
        dragRef.current = null;
        const pts = Array.from(pointersRef.current.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
        const mx = (pts[0].x + pts[1].x) / 2;
        const my = (pts[0].y + pts[1].y) / 2;
        const r = wrapRef.current?.getBoundingClientRect();
        const lx = r ? mx - r.left : mx;
        const ly = r ? my - r.top : my;
        pinchRef.current = {
          startDist: dist,
          startZoom: cam.zoom,
          worldX: (lx - cam.panX) / cam.zoom,
          worldY: (ly - cam.panY) / cam.zoom,
        };
      }
    },
    [beginInteract],
  );

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      // Hover near the top edge re-reveals tucked chrome even mid-gesture.
      if (!dragRef.current && pointersRef.current.size < 2) {
        updatePeek(e.clientY);
        schedule();
      }
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointersRef.current.size === 2 && pinchRef.current) {
        const pts = Array.from(pointersRef.current.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
        const next = clampZoom(
          pinchRef.current.startZoom * (dist / pinchRef.current.startDist),
        );
        const mx = (pts[0].x + pts[1].x) / 2;
        const my = (pts[0].y + pts[1].y) / 2;
        const r = wrapRef.current?.getBoundingClientRect();
        const lx = r ? mx - r.left : mx;
        const ly = r ? my - r.top : my;
        camRef.current = {
          zoom: next,
          panX: lx - pinchRef.current.worldX * next,
          panY: ly - pinchRef.current.worldY * next,
        };
        schedule();
        return;
      }

      const d = dragRef.current;
      if (!d) return;
      camRef.current = {
        ...camRef.current,
        panX: d.baseX + (e.clientX - d.startX),
        panY: d.baseY + (e.clientY - d.startY),
      };
      schedule();
    },
    [clampZoom, schedule, updatePeek],
  );

  const onPointerUp = React.useCallback(
    (e: React.PointerEvent) => {
      pointersRef.current.delete(e.pointerId);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (pointersRef.current.size < 2) pinchRef.current = null;
      if (pointersRef.current.size === 0) {
        dragRef.current = null;
        setIsPanning(false);
        endInteract();
      } else if (pointersRef.current.size === 1) {
        const remaining = Array.from(pointersRef.current.values())[0];
        const cam = camRef.current;
        dragRef.current = {
          baseX: cam.panX,
          baseY: cam.panY,
          startX: remaining.x,
          startY: remaining.y,
        };
      }
    },
    [endInteract],
  );

  // ---- Discrete camera moves (buttons / auto-fit). --------------------------
  const fit = React.useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const { totalW, totalH } = sizeRef.current;
    const s = Math.min(
      1,
      Math.min((r.width - fitMargin) / totalW, (r.height - fitMargin) / totalH),
    );
    const nextPan = {
      x: (r.width - totalW * s) / 2,
      y: (r.height - totalH * s) / 2,
    };
    camRef.current = { zoom: s, panX: nextPan.x, panY: nextPan.y };
    setZoom(s);
    setPan(nextPan);
    schedule(); // refresh chrome auto-tuck for the new camera
  }, [fitMargin, schedule]);

  const actualSize = React.useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const { totalW } = sizeRef.current;
    const nextPan = { x: (r.width - totalW) / 2, y: 40 };
    camRef.current = { zoom: 1, panX: nextPan.x, panY: nextPan.y };
    setZoom(1);
    setPan(nextPan);
    schedule();
  }, [schedule]);

  const zoomBy = React.useCallback(
    (factor: number) => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cam = camRef.current;
      const cx = r.width / 2;
      const cy = r.height / 2;
      const wx = (cx - cam.panX) / cam.zoom;
      const wy = (cy - cam.panY) / cam.zoom;
      const next = clampZoom(cam.zoom * factor);
      const nextPan = { x: cx - wx * next, y: cy - wy * next };
      camRef.current = { zoom: next, panX: nextPan.x, panY: nextPan.y };
      setZoom(next);
      setPan(nextPan);
      schedule();
    },
    [clampZoom, schedule],
  );

  const screenToWorld = React.useCallback(
    (clientX: number, clientY: number) => {
      const r = wrapRef.current?.getBoundingClientRect();
      const cam = camRef.current;
      if (!r) return { x: 0, y: 0 };
      return {
        x: (clientX - r.left - cam.panX) / cam.zoom,
        y: (clientY - r.top - cam.panY) / cam.zoom,
      };
    },
    [],
  );

  return {
    wrapRef,
    worldRef,
    zoomReadoutRef,
    chromeRef,
    zoom,
    pan,
    interacting,
    isPanning,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    fit,
    actualSize,
    zoomBy,
    screenToWorld,
  };
}
