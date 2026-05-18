"use client";
 
import * as React from "react";
import { getStroke } from "perfect-freehand";
import type { Annotations, Shape, Stroke, StickyNote } from "@/lib/types";
 
/**
 * Read-only SVG overlay used by Thumb / cards / filmstrip.
 *
 * Strokes, shapes and sticky-note pins live in image-space coordinates,
 * so we put them inside a viewBox sized to the image. The overlay then
 * stretches with the image regardless of the layout's display size.
 */
export function AnnotationOverlay({
 width,
 height,
 annotations,
 className,
 showNotes = true,
 fit = "contain",
}: {
 width: number;
 height: number;
 annotations: Annotations;
 className?: string;
 showNotes?: boolean;
 /** Match the parent image's CSS object-fit so overlay coords align. */
 fit?: "contain" | "cover";
}) {
 if (!width || !height) return null;
 const hasStrokes = annotations.strokes.length > 0;
 const hasShapes = annotations.shapes.length > 0;
 const hasNotes = showNotes && annotations.notes.length > 0;
 if (!hasStrokes && !hasShapes && !hasNotes) return null;
 return (
    <svg
 viewBox={`0 0 ${width} ${height}`}
 preserveAspectRatio={
        fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"
      }
 className={`absolute inset-0 w-full h-full pointer-events-none ${className ?? ""}`}
 shapeRendering="geometricPrecision"
    >
      {annotations.strokes.map((s) => (
        <StrokeNode key={s.id} stroke={s} />
      ))}
      {annotations.shapes.map((s) => (
        <ShapeNode key={s.id} shape={s} />
      ))}
      {hasNotes &&
        annotations.notes.map((n) => <NotePin key={n.id} note={n} />)}
    </svg>
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
 
function NotePin({ note }: { note: StickyNote }) {
 // Render a small filled dot in the note's color so the viewer knows there's
 // a note attached at that spot, without trying to render the full sticky
 // (which would be illegible at thumbnail scale). Size scales with the
 // viewBox so it looks roughly the same regardless of image dims.
 return (
    <g>
      <circle
 cx={note.x + 12}
 cy={note.y + 12}
 r={10}
 fill={note.color}
 opacity={0.92}
      />
      <circle
 cx={note.x + 12}
 cy={note.y + 12}
 r={3}
 fill="white"
 opacity={0.85}
      />
    </g>
  );
}
