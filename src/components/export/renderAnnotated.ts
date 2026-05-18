"use client";
 
import { getStroke } from "perfect-freehand";
import type { Stroke, Shape, Version } from "@/lib/types";
 
/**
 * Render the source image + annotations onto a single canvas, return a PNG blob.
 */
export async function renderAnnotated(
 source: Blob,
 version: Version,
): Promise<Blob> {
 const url = URL.createObjectURL(source);
 try {
 const img = new Image();
    img.src = url;
 await img.decode();
 const w = img.naturalWidth;
 const h = img.naturalHeight;
 const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
 const ctx = canvas.getContext("2d");
 if (!ctx) throw new Error("2d context unavailable");
    ctx.drawImage(img, 0, 0);
 drawShapes(ctx, version.annotations.shapes);
 drawStrokes(ctx, version.annotations.strokes);
 drawNotes(ctx, version.annotations.notes);
 const out = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
 "image/png",
      );
    });
 return out;
  } finally {
 URL.revokeObjectURL(url);
  }
}
 
function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
 for (const s of strokes) {
 const pts: number[][] = [];
 for (let i = 0; i < s.points.length; i += 3) {
      pts.push([s.points[i], s.points[i + 1], s.points[i + 2]]);
    }
 if (pts.length === 0) continue;
 const outline = getStroke(pts, {
      size: s.size,
      thinning: s.tool === "highlight" ? 0.05 : 0.5,
      smoothing: 0.5,
      streamline: 0.5,
      last: true,
    });
 if (outline.length === 0) continue;
    ctx.save();
    ctx.fillStyle = s.color;
    ctx.globalAlpha = s.tool === "highlight" ? 0.32 : 1;
    ctx.beginPath();
    outline.forEach(([x, y], i) => {
 if (i === 0) ctx.moveTo(x, y);
 else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
 
function drawShapes(ctx: CanvasRenderingContext2D, shapes: Shape[]) {
 for (const s of shapes) {
 if (s.kind === "rect") {
 const [x, y, w, h] = s.geom;
      ctx.save();
      ctx.fillStyle = hexWithAlpha(s.color, 0.12);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
 roundRect(ctx, x, y, w, h, 6);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else if (s.kind === "arrow") {
 const [x1, y1, x2, y2] = s.geom;
 const dx = x2 - x1;
 const dy = y2 - y1;
 const len = Math.hypot(dx, dy) || 1;
 const ux = dx / len;
 const uy = dy / len;
 const headLen = 16 + s.size * 1.5;
 const baseX = x2 - ux * headLen;
 const baseY = y2 - uy * headLen;
 const perpX = -uy * (headLen * 0.5);
 const perpY = ux * (headLen * 0.5);
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(baseX, baseY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(baseX + perpX, baseY + perpY);
      ctx.lineTo(baseX - perpX, baseY - perpY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}
 
function drawNotes(
 ctx: CanvasRenderingContext2D,
 notes: { x: number; y: number; width: number; text: string; color: string }[],
) {
 for (const n of notes) {
 const padding = 12;
 const fontSize = 14;
 const lineH = 19;
    ctx.save();
    ctx.font = `500 ${fontSize}px ui-sans-serif, system-ui, -apple-system, "PingFang SC", sans-serif`;
 const lines = wrapText(ctx, n.text || "(empty note)", n.width - padding * 2);
 const h = padding * 2 + Math.max(1, lines.length) * lineH;
    ctx.fillStyle = n.color;
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
 roundRect(ctx, n.x, n.y, n.width, h, 8);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = "#1a1100";
    ctx.textBaseline = "top";
    lines.forEach((ln, i) => {
      ctx.fillText(ln, n.x + padding, n.y + padding + i * lineH);
    });
    ctx.restore();
  }
}
 
function wrapText(
 ctx: CanvasRenderingContext2D,
 text: string,
 maxWidth: number,
): string[] {
 const out: string[] = [];
 for (const para of text.split(/\n/)) {
 let line = "";
 for (const ch of para) {
 const test = line + ch;
 if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
 if (line) out.push(line);
 else out.push("");
  }
 return out;
}
 
function roundRect(
 ctx: CanvasRenderingContext2D,
 x: number,
 y: number,
 w: number,
 h: number,
 r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
 
function hexWithAlpha(color: string, alpha: number): string {
 // Accept hex (#rgb / #rrggbb) and convert to rgba
 if (color.startsWith("#")) {
 let r: number, g: number, b: number;
 if (color.length === 4) {
      r = parseInt(color[1] + color[1], 16);
      g = parseInt(color[2] + color[2], 16);
      b = parseInt(color[3] + color[3], 16);
    } else {
      r = parseInt(color.slice(1, 3), 16);
      g = parseInt(color.slice(3, 5), 16);
      b = parseInt(color.slice(5, 7), 16);
    }
 return `rgba(${r},${g},${b},${alpha})`;
  }
 return color;
}
